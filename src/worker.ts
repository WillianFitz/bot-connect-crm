export interface Env {
  DB: D1Database;
  BOT_SERVICE_URL: string;
  OPENAI_API_KEY: string;
  ADMIN_API_KEY: string;
  EXTRACTOR_SERVICE_URL: string;
  EVOLUTION_API_URL: string;
  EVOLUTION_API_KEY: string;
}

type JsonValue = Record<string, unknown> | unknown[] | null;

function json(body: JsonValue, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function notFound(message = "Not found") {
  return json({ error: message }, { status: 404 });
}

async function readBody<T = any>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function getTenantId(request: Request): string {
  // Para SaaS: defina de onde virá o tenant:
  // - header "x-tenant-id"
  // - subdomínio, etc.
  const header = request.headers.get("x-tenant-id");
  if (!header) {
    // Tenant anônimo para testes, será criado automaticamente se não existir.
    return "tenant_demo";
  }
  return header;
}

function isAdmin(request: Request, env: Env): boolean {
  const key = request.headers.get("x-admin-key");
  return !!key && key === env.ADMIN_API_KEY;
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getEvolutionBaseUrl(env: Env): string {
  const raw = (env.EVOLUTION_API_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function normalizeBrazilNumber(input: string): string {
  // Remove qualquer coisa que não seja dígito
  let digits = input.replace(/\D/g, "");

  // Se já começar com 55, consideramos que já está em E.164 brasileiro
  if (digits.startsWith("55")) {
    return digits;
  }

  // Esperamos DDD (2) + número (8 ou 9)
  if (digits.length >= 10) {
    // Caso clássico com 9 extra: 2 (DDD) + 9 + 8
    if (digits.length === 11 && digits[2] === "9") {
      // Remove o 9 logo após o DDD
      digits = digits.slice(0, 2) + digits.slice(3);
    }
    return "55" + digits;
  }

  // Se for menor que isso, devolve como está (deixa Evolution/WA tratar)
  return digits;
}

async function ensureTenant(env: Env, tenantId: string) {
  // Garante que o tenant exista para evitar erros de chave estrangeira
  await env.DB.prepare(
    "INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)",
  )
    .bind(tenantId, tenantId)
    .run();
}

async function callOpenAI(
  env: Env,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Resposta inválida da OpenAI");
  }

  return content;
}

async function handleAdminCreateTenantUser(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readBody<{
    tenantId?: string;
    tenantName: string;
    username: string;
    password: string;
    document: string;
  }>(request);

  if (!body.tenantName || !body.username || !body.password || !body.document) {
    return json({ error: "tenantName, username, password e document são obrigatórios" }, { status: 400 });
  }

  const tenantId = body.tenantId && body.tenantId.trim().length > 0
    ? body.tenantId.trim()
    : `tenant_${crypto.randomUUID()}`;

  await env.DB.prepare(
    "INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)",
  )
    .bind(tenantId, body.tenantName)
    .run();

  const passwordHash = await hashPassword(body.password);

  await env.DB.prepare(
    `INSERT INTO users (tenant_id, username, password_hash, document)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(tenantId, body.username, passwordHash, body.document)
    .run();

  return json({ ok: true, tenantId });
}

async function handleAdminListUsers(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await env.DB.prepare(
    `SELECT u.id, u.tenant_id, t.name as tenant_name, u.username, u.document, u.created_at
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     ORDER BY t.name ASC, u.username ASC`,
  ).all();

  return json(res.results || []);
}

async function handleAdminDeleteUser(request: Request, env: Env, url: URL): Promise<Response> {
  if (!isAdmin(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = url.searchParams.get("id");
  if (!id) return json({ error: "ID obrigatório" }, { status: 400 });

  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function handleClientLogin(request: Request, env: Env): Promise<Response> {
  const body = await readBody<{ username?: string; password?: string }>(request);
  if (!body.username || !body.password) {
    return json({ error: "username e password são obrigatórios" }, { status: 400 });
  }

  const row = await env.DB.prepare(
    "SELECT tenant_id, username, password_hash FROM users WHERE username = ? LIMIT 1",
  )
    .bind(body.username)
    .first<{ tenant_id: string; username: string; password_hash: string }>();

  if (!row) {
    return json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  const incomingHash = await hashPassword(body.password);
  if (incomingHash !== row.password_hash) {
    return json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  return json({
    ok: true,
    tenantId: row.tenant_id,
    username: row.username,
  });
}

async function handleWhatsappConnection(request: Request, env: Env, method: string, url: URL) {
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  const pathname = url.pathname;

  const baseUrl = getEvolutionBaseUrl(env);

  // Código/QR para conexão via Evolution API (self-hosted)
  if (pathname === "/api/connections/whatsapp/qr") {
    if (method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!baseUrl || !env.EVOLUTION_API_KEY) {
      return json(
        { qr: null, error: "EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados" },
        { status: 500 },
      );
    }

    try {
      // Cria (ou tenta criar) a instância com QR code já habilitado
      const res = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName: tenantId,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });

      const data = (await res.json()) as any;
      const base64 = data?.qrcode?.base64 || null;

      if (!res.ok) {
        return json(
          {
            qr: null,
            raw: data,
            error:
              data?.response?.message?.[0] ||
              "Não foi possível gerar o QR. Verifique a instância na Evolution API.",
          },
          { status: res.status },
        );
      }

      if (!base64) {
        return json(
          {
            qr: null,
            raw: data,
            error:
              "QR ainda não disponível. Tente novamente em alguns segundos ou confira no painel da Evolution.",
          },
          { status: 200 },
        );
      }

      return json({ qr: base64, raw: data });
    } catch (err: any) {
      return json(
        { qr: null, error: err?.message || "Erro ao criar instância/QR na Evolution API" },
        { status: 500 },
      );
    }
  }

  // Enviar mensagem de teste para um número informado
  if (pathname === "/api/connections/whatsapp/test") {
    if (method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!baseUrl || !env.EVOLUTION_API_KEY) {
      return json(
        { ok: false, error: "EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados" },
        { status: 500 },
      );
    }

    const body = await readBody<{ number?: string; text?: string }>(request);
    const rawNumber = (body.number || "").trim();
    const number = normalizeBrazilNumber(rawNumber);
    const text =
      (body.text || "").trim() ||
      "✅ Mensagem de teste enviada pelo seu painel LeadFlowAI. Se você recebeu, sua conexão Evolution API está funcionando.";

    if (!number) {
      return json({ ok: false, error: "Número é obrigatório" }, { status: 400 });
    }

    try {
      const res = await fetch(`${baseUrl}/message/sendText/${tenantId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number,
          text,
        }),
      });

      if (!res.ok) {
        let errMsg = res.statusText;
        try {
          const data = await res.json();
          if (Array.isArray(data?.response?.message) && data.response.message[0]) {
            errMsg = data.response.message[0];
          }
        } catch {
          // ignore
        }
        return json({ ok: false, error: errMsg || "Falha ao enviar mensagem" }, { status: res.status });
      }

      return json({ ok: true });
    } catch (err: any) {
      return json(
        { ok: false, error: err?.message || "Erro ao enviar mensagem pela Evolution API" },
        { status: 500 },
      );
    }
  }

  // Logout (desconectar, mantendo instância)
  if (pathname === "/api/connections/whatsapp/logout") {
    if (method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!baseUrl || !env.EVOLUTION_API_KEY) {
      return json(
        { ok: false, error: "EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados" },
        { status: 500 },
      );
    }

    try {
      await fetch(`${baseUrl}/instance/logout/${tenantId}`, {
        method: "POST",
        headers: { apikey: env.EVOLUTION_API_KEY },
      });
    } catch {
      // ignora erro de logout remoto; seguimos para marcar desconectado no D1
    }

    await env.DB.prepare(
      `INSERT INTO connections (tenant_id, type, status, agent_enabled, reply_all)
       VALUES (?, 'whatsapp', 'disconnected', 0, 0)
       ON CONFLICT(tenant_id, type) DO UPDATE SET
         status = 'disconnected',
         agent_enabled = 0,
         reply_all = 0,
         updated_at = datetime('now')`,
    )
      .bind(tenantId)
      .run();

    return json({ ok: true });
  }

  // Delete (apagar instância para trocar de número)
  if (pathname === "/api/connections/whatsapp/instance") {
    if (method !== "DELETE") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!baseUrl || !env.EVOLUTION_API_KEY) {
      return json(
        { ok: false, error: "EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados" },
        { status: 500 },
      );
    }

    try {
      await fetch(`${baseUrl}/instance/delete/${tenantId}`, {
        method: "DELETE",
        headers: { apikey: env.EVOLUTION_API_KEY },
      });
    } catch {
      // ignora erro remoto; limpamos o estado local mesmo assim
    }

    await env.DB.prepare(
      "DELETE FROM connections WHERE tenant_id = ? AND type = 'whatsapp'",
    )
      .bind(tenantId)
      .run();

    return json({ ok: true });
  }

  if (method === "GET") {
    let row = await env.DB.prepare(
      "SELECT type, status, agent_enabled, reply_all FROM connections WHERE tenant_id = ? AND type = 'whatsapp' LIMIT 1"
    ).bind(tenantId).first<{
      type: string;
      status: string;
      agent_enabled: number;
      reply_all: number;
    }>();

    // Se Evolution estiver configurada, tenta sincronizar o estado real
    if (baseUrl && env.EVOLUTION_API_KEY) {
      try {
        const res = await fetch(`${baseUrl}/instance/connectionState/${tenantId}`, {
          method: "GET",
          headers: { apikey: env.EVOLUTION_API_KEY },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const state = data?.instance?.state;
          const mappedStatus = state === "open" ? "connected" : "disconnected";

          // Atualiza/insere no D1 para manter coerência
          await env.DB.prepare(
            `INSERT INTO connections (tenant_id, type, status, agent_enabled, reply_all)
             VALUES (?, 'whatsapp', ?, COALESCE(?, 0), COALESCE(?, 0))
             ON CONFLICT(tenant_id, type) DO UPDATE SET
               status = excluded.status,
               updated_at = datetime('now')`,
          )
            .bind(
              tenantId,
              mappedStatus,
              row?.agent_enabled ?? 0,
              row?.reply_all ?? 0,
            )
            .run();

          row = {
            type: "whatsapp",
            status: mappedStatus,
            agent_enabled: row?.agent_enabled ?? 0,
            reply_all: row?.reply_all ?? 0,
          };
        }
      } catch {
        // se falhar, ignora e devolve o que tiver em D1
      }
    }

    return json(
      row || {
        type: "whatsapp",
        status: "disconnected",
        agent_enabled: 0,
        reply_all: 0,
      },
    );
  }

  if (method === "PUT") {
    const body = await readBody<{
      status?: string;
      agent_enabled?: boolean;
      reply_all?: boolean;
    }>(request);

    const status = body.status ?? "disconnected";
    const agentEnabled = body.agent_enabled ? 1 : 0;
    const replyAll = body.reply_all ? 1 : 0;

    await env.DB.prepare(
      `INSERT INTO connections (tenant_id, type, status, agent_enabled, reply_all)
       VALUES (?, 'whatsapp', ?, ?, ?)
       ON CONFLICT(tenant_id, type) DO UPDATE SET
         status = excluded.status,
         agent_enabled = excluded.agent_enabled,
         reply_all = excluded.reply_all,
         updated_at = datetime('now')`,
    )
      .bind(tenantId, status, agentEnabled, replyAll)
      .run();

    return json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
}

async function handleLeadFolders(request: Request, env: Env, method: string, url: URL) {
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  if (method === "GET") {
    const folders = await env.DB.prepare(
      "SELECT id, name FROM lead_folders WHERE tenant_id = ? ORDER BY name ASC",
    ).bind(tenantId).all();
    return json(folders.results || []);
  }

  if (method === "POST") {
    const body = await readBody<{ name?: string }>(request);
    if (!body.name) return json({ error: "Nome obrigatório" }, { status: 400 });

    const res = await env.DB.prepare(
      "INSERT INTO lead_folders (tenant_id, name) VALUES (?, ?)",
    ).bind(tenantId, body.name).run();
    return json({ id: res.lastRowId, name: body.name });
  }

  if (method === "PUT") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "ID obrigatório" }, { status: 400 });
    const body = await readBody<{ name?: string }>(request);
    if (!body.name) return json({ error: "Nome obrigatório" }, { status: 400 });

    await env.DB.prepare(
      "UPDATE lead_folders SET name = ? WHERE id = ? AND tenant_id = ?",
    ).bind(body.name, id, tenantId).run();
    return json({ ok: true });
  }

  if (method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "ID obrigatório" }, { status: 400 });
    await env.DB.prepare(
      "DELETE FROM lead_folders WHERE id = ? AND tenant_id = ?",
    ).bind(id, tenantId).run();
    return json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
}

async function handleLeads(request: Request, env: Env, method: string, url: URL) {
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  if (method === "GET") {
    const search = url.searchParams.get("q") || "";
    const folderId = url.searchParams.get("folderId");
    const countOnly = url.searchParams.get("countOnly") === "1";

    const conditions: string[] = ["l.tenant_id = ?"];
    const params: unknown[] = [tenantId];

    if (search) {
      conditions.push("(company LIKE ? OR phone LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like);
    }

    if (folderId && folderId !== "none") {
      conditions.push("l.folder_id = ?");
      params.push(Number(folderId));
    } else if (folderId === "none") {
      conditions.push("l.folder_id IS NULL");
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    if (countOnly) {
      const countRes = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM leads l ${where}`,
      )
        .bind(...params)
        .first<{ total: number }>();
      return json({ count: Number(countRes?.total ?? 0) });
    }

    const query = `
      SELECT l.id, l.company, l.phone, l.folder_id, lf.name as folder_name, l.created_at
      FROM leads l
      LEFT JOIN lead_folders lf ON lf.id = l.folder_id
      ${where}
      ORDER BY l.created_at DESC
    `;

    const res = await env.DB.prepare(query).bind(...params).all();
    return json(res.results || []);
  }

  if (method === "POST") {
    const body = await readBody<{ company?: unknown; phone?: unknown; folder_id?: unknown }>(request);
    const company = typeof body.company === "string" ? body.company : "";
    const rawPhone = typeof body.phone === "string" ? body.phone : "";
    const phone = normalizeBrazilNumber(rawPhone);
    const folderId =
      typeof body.folder_id === "number"
        ? body.folder_id
        : body.folder_id == null
        ? null
        : Number(body.folder_id);

    if (!company || !phone) {
      return json({ error: "Empresa e telefone são obrigatórios" }, { status: 400 });
    }

    const res = await env.DB.prepare(
      "INSERT INTO leads (tenant_id, company, phone, folder_id) VALUES (?, ?, ?, ?)",
    )
      .bind(tenantId, company, phone, folderId ?? null)
      .run();

    // Não fazemos SELECT adicional para evitar qualquer erro extra do D1.
    // O frontend sempre refaz o GET /leads depois da criação.
    return json({ ok: true, id: res.lastRowId }, { status: 201 });
  }

  if (method === "PUT") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "ID obrigatório" }, { status: 400 });
    const body = await readBody<{ company?: string; phone?: string; folder_id?: number | null }>(request);
    const normalizedPhone = body.phone ? normalizeBrazilNumber(body.phone) : "";
    if (!body.company || !normalizedPhone) {
      return json({ error: "Empresa e telefone são obrigatórios" }, { status: 400 });
    }

    await env.DB.prepare(
      "UPDATE leads SET company = ?, phone = ?, folder_id = ? WHERE id = ? AND tenant_id = ?",
    )
      .bind(body.company, normalizedPhone, body.folder_id ?? null, id, tenantId)
      .run();

    return json({ ok: true });
  }

  if (method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "ID obrigatório" }, { status: 400 });
    await env.DB.prepare(
      "DELETE FROM leads WHERE id = ? AND tenant_id = ?",
    ).bind(id, tenantId).run();
    return json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
}

async function handleAgents(request: Request, env: Env, method: string, url: URL) {
  const pathname = url.pathname;
  const parts = pathname.split("/").filter(Boolean);
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  // /api/agents
  if (parts.length === 2) {
    if (method === "GET") {
      const res = await env.DB.prepare(
        "SELECT id, name, type, base_prompt, default_message, pause_minutes, pause_definitive, agenda_link, human_number, human_group_id FROM agents WHERE tenant_id = ? ORDER BY id ASC",
      ).bind(tenantId).all();
      return json(res.results || []);
    }

    if (method === "PUT") {
      const body = await readBody<any>(request);
      const agents = Array.isArray(body) ? body : [];

      const tx = await env.DB.batch(
        agents.map((a) =>
          env.DB.prepare(
            `INSERT INTO agents (id, tenant_id, name, type, base_prompt, default_message, pause_minutes, pause_definitive, agenda_link, human_number, human_group_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id, tenant_id) DO UPDATE SET
               name = excluded.name,
               type = excluded.type,
               base_prompt = excluded.base_prompt,
               default_message = excluded.default_message,
               pause_minutes = excluded.pause_minutes,
               pause_definitive = excluded.pause_definitive,
               agenda_link = excluded.agenda_link,
               human_number = excluded.human_number,
               human_group_id = excluded.human_group_id,
               updated_at = datetime('now')`,
          ).bind(
            a.id,
            tenantId,
            a.name,
            a.type,
            a.base_prompt,
            a.default_message ?? null,
            a.pause_minutes ?? 0,
            a.pause_definitive ? 1 : 0,
            a.agenda_link ?? null,
            a.human_number ?? null,
            a.human_group_id ?? null,
          ),
        ),
      );

      return json({ ok: true, count: tx.length });
    }

    return new Response("Method not allowed", { status: 405 });
  }

  // /api/agents/:id
  if (parts.length === 3) {
    const id = parts[2];

    if (method === "GET") {
      const agent = await env.DB.prepare(
        "SELECT id, name, type, base_prompt, default_message, pause_minutes, pause_definitive, agenda_link, human_number, human_group_id FROM agents WHERE id = ? AND tenant_id = ?",
      )
        .bind(id, tenantId)
        .first();
      if (!agent) return notFound("Agente não encontrado");
      return json(agent);
    }

    if (method === "PUT") {
      const a = await readBody<any>(request);
      await env.DB.prepare(
        `INSERT INTO agents (id, tenant_id, name, type, base_prompt, default_message, pause_minutes, pause_definitive, agenda_link, human_number, human_group_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id, tenant_id) DO UPDATE SET
           name = excluded.name,
           type = excluded.type,
           base_prompt = excluded.base_prompt,
           default_message = excluded.default_message,
           pause_minutes = excluded.pause_minutes,
           pause_definitive = excluded.pause_definitive,
           agenda_link = excluded.agenda_link,
           human_number = excluded.human_number,
           human_group_id = excluded.human_group_id,
           updated_at = datetime('now')`,
      )
        .bind(
          id,
          tenantId,
          a.name,
          a.type,
          a.base_prompt,
          a.default_message ?? null,
          a.pause_minutes ?? 0,
          a.pause_definitive ? 1 : 0,
          a.agenda_link ?? null,
          a.human_number ?? null,
          a.human_group_id ?? null,
        )
        .run();

      return json({ ok: true });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}

async function handleAIDisparo(request: Request, env: Env): Promise<Response> {
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  const row = await env.DB.prepare(
    `SELECT base_prompt FROM agents WHERE tenant_id = ? AND id = 'disparo' LIMIT 1`,
  )
    .bind(tenantId)
    .first<{ base_prompt?: string }>();

  const basePrompt = row?.base_prompt || `Você é um agente de disparo automático.
Gere uma saudação curta, natural e humana para iniciar uma conversa com um lead.
Responda EXCLUSIVAMENTE em JSON no formato {"mensagem": "texto"}.`;

  const content = await callOpenAI(env, [
    { role: "system", content: basePrompt },
    { role: "user", content: "Gere uma saudação válida conforme as regras." },
  ]);

  // Tentamos devolver JSON parseado; se falhar, devolvemos como string.
  try {
    const parsed = JSON.parse(content);
    return json(parsed);
  } catch {
    return json({ mensagem: content });
  }
}

async function handleAIAgent(
  request: Request,
  env: Env,
  agentId: "atendimento" | "agendamento",
): Promise<Response> {
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  const body = await readBody<{ message?: string }>(request);
  const userMessage = body.message || "";

  const row = await env.DB.prepare(
    `SELECT base_prompt FROM agents WHERE tenant_id = ? AND id = ? LIMIT 1`,
  )
    .bind(tenantId, agentId)
    .first<{ base_prompt?: string }>();

  const basePrompt =
    row?.base_prompt ||
    (agentId === "atendimento"
      ? "Você é um agente de atendimento. Responda de forma educada, clara e objetiva."
      : "Você é um agente de agendamento. Ajude a marcar reuniões, sugerindo horários e confirmando com o lead.");

  const content = await callOpenAI(env, [
    { role: "system", content: basePrompt },
    { role: "user", content: userMessage },
  ]);

  return json({ resposta: content });
}

async function generateDisparoMessage(env: Env, tenantId: string, company: string): Promise<string> {
  const row = await env.DB.prepare(
    "SELECT base_prompt, default_message FROM agents WHERE tenant_id = ? AND id = 'disparo' LIMIT 1",
  )
    .bind(tenantId)
    .first<{ base_prompt?: string; default_message?: string }>();
  const basePrompt =
    row?.base_prompt ||
    `Você gera a primeira mensagem que a EMPRESA envia para um LEAD (prospecção). A empresa está entrando em contato com o lead — não use "Como posso ajudar?" (isso é quando o cliente te chama). Use saudação de quem inicia o contato. Responda EXCLUSIVAMENTE em JSON: {"mensagem": "texto"}.`;
  const userPrompt = `Gere uma mensagem de abertura que a empresa envia para este lead. Nome/empresa do lead: "${company}". Uma única mensagem curta, como quem está iniciando o contato (não como atendimento).`;
  try {
    const content = await callOpenAI(env, [
      { role: "system", content: basePrompt },
      { role: "user", content: userPrompt },
    ]);
    const parsed = JSON.parse(content) as { mensagem?: string };
    return (parsed?.mensagem || content).trim() || (row?.default_message || "Olá! Tudo bem?");
  } catch {
    return (row?.default_message || "Olá! Tudo bem?").trim();
  }
}

async function sendWhatsAppMessage(
  env: Env,
  tenantId: string,
  number: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = getEvolutionBaseUrl(env);
  if (!baseUrl || !env.EVOLUTION_API_KEY) {
    return { ok: false, error: "Evolution API não configurada" };
  }
  const body = JSON.stringify({ number, text });
  try {
    const res = await fetch(`${baseUrl}/message/sendText/${tenantId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.EVOLUTION_API_KEY },
      body,
    });
    if (!res.ok) {
      let errMsg = res.statusText;
      try {
        const data = await res.json();
        if (Array.isArray(data?.response?.message) && data.response.message[0])
          errMsg = data.response.message[0];
      } catch {
        // ignore
      }
      return { ok: false, error: errMsg };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro de rede" };
  }
}

const BR_DAY_MAP: Record<string, string> = { dom: "Dom", seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sáb: "Sáb", sab: "Sáb" };

function normalizeTimeToHHMM(s: string): string {
  const match = (s || "").match(/^\s*(\d{1,2})\s*[:\h]\s*(\d{1,2})/);
  if (!match) return "00:00";
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function handleCampaignRun(env: Env, tenantId: string, ignoreWindow = false): Promise<Response> {
  const now = new Date();
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  let nowTimeStr: string;
  let todayName: string;
  try {
    const timeFmt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const dayFmt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
    });
    const raw = timeFmt.format(now).replace(/\s/g, "");
    nowTimeStr = normalizeTimeToHHMM(raw);
    const dayStr = dayFmt.format(now).toLowerCase().replace(/\./g, "");
    todayName = BR_DAY_MAP[dayStr] || dayNames[now.getUTCDay()];
  } catch {
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    nowTimeStr = `${String(utcHour).padStart(2, "0")}:${String(utcMin).padStart(2, "0")}`;
    todayName = dayNames[now.getUTCDay()];
  }

  const campaigns = await env.DB.prepare(
    "SELECT id, name, time_from, time_to, days_blocked, delay_min, delay_max FROM campaigns WHERE tenant_id = ? AND status = 'active'",
  )
    .bind(tenantId)
    .all<{ id: number; name: string; time_from: string; time_to: string; days_blocked: string; delay_min: number; delay_max: number }>();

  const list = (campaigns.results || []) as Array<{
    id: number;
    name: string;
    time_from: string;
    time_to: string;
    days_blocked: string;
    delay_min: number;
    delay_max: number;
  }>;

  let processed = 0;
  const runResult: { campaignId: number; name: string; sent: number; errors: number; errorDetails: string[] }[] = [];
  const globalErrors: string[] = [];

  for (const camp of list) {
    if (!ignoreWindow) {
      let blocked: string[] = [];
      try {
        blocked = JSON.parse(camp.days_blocked || "[]");
      } catch {
        blocked = [];
      }
      if (blocked.includes(todayName)) continue;
      const from = normalizeTimeToHHMM(camp.time_from || "00:00");
      const to = normalizeTimeToHHMM(camp.time_to || "23:59");
      if (nowTimeStr < from || nowTimeStr > to) continue;
    }

    const pending = await env.DB.prepare(
      `SELECT l.id, l.company, l.phone FROM leads l
       WHERE l.tenant_id = ?
         AND l.phone IS NOT NULL AND trim(l.phone) != ''
         AND NOT EXISTS (SELECT 1 FROM campaign_sends cs WHERE cs.campaign_id = ? AND cs.lead_id = l.id)
       ORDER BY l.id ASC LIMIT 5`,
    )
      .bind(tenantId, camp.id)
      .all<{ id: number; company: string; phone: string }>();

    const rows = (pending.results || []) as Array<{ id: number; company: string; phone: string }>;
    let sent = 0;
    let errs = 0;
    let noWa = 0;
    const campaignErrors: string[] = [];

    for (const lead of rows) {
      const phone = normalizeBrazilNumber(lead.phone || "");
      if (!phone) {
        noWa++;
        await env.DB.prepare(
          "INSERT OR IGNORE INTO campaign_sends (campaign_id, lead_id, status, error_message) VALUES (?, ?, 'error', ?)",
        )
          .bind(camp.id, lead.id, "Sem telefone")
          .run();
        await env.DB.prepare(
          "UPDATE campaigns SET no_whatsapp = no_whatsapp + 1 WHERE id = ? AND tenant_id = ?",
        )
          .bind(camp.id, tenantId)
          .run();
        processed++;
        continue;
      }

      let text: string;
      try {
        text = await generateDisparoMessage(env, tenantId, lead.company || lead.phone);
      } catch {
        text = "Olá! Tudo bem?";
      }

      const result = await sendWhatsAppMessage(env, tenantId, phone, text);

      if (result.ok) {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO campaign_sends (campaign_id, lead_id, status) VALUES (?, ?, 'sent')",
        )
          .bind(camp.id, lead.id)
          .run();
        await env.DB.prepare(
          "UPDATE campaigns SET sent = sent + 1 WHERE id = ? AND tenant_id = ?",
        )
          .bind(camp.id, tenantId)
          .run();
        sent++;
      } else {
        const errMsg = result.error || "Erro ao enviar";
        campaignErrors.push(errMsg);
        globalErrors.push(errMsg);
        await env.DB.prepare(
          "INSERT OR IGNORE INTO campaign_sends (campaign_id, lead_id, status, error_message) VALUES (?, ?, 'error', ?)",
        )
          .bind(camp.id, lead.id, errMsg)
          .run();
        await env.DB.prepare(
          "UPDATE campaigns SET errors = errors + 1 WHERE id = ? AND tenant_id = ?",
        )
          .bind(camp.id, tenantId)
          .run();
        errs++;
      }
      processed++;
    }

    runResult.push({
      campaignId: camp.id,
      name: camp.name,
      sent,
      errors: errs,
      errorDetails: campaignErrors,
    });

    const totalSent = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM campaign_sends WHERE campaign_id = ? AND status = 'sent'",
    )
      .bind(camp.id)
      .first<{ c: number }>();
    const totalLeads = await env.DB.prepare(
      "SELECT total_leads FROM campaigns WHERE id = ? AND tenant_id = ?",
    )
      .bind(camp.id, tenantId)
      .first<{ total_leads: number }>();
    const total = Number(totalLeads?.total_leads ?? 0);
    if (total > 0 && Number(totalSent?.c ?? 0) >= total) {
      await env.DB.prepare(
        "UPDATE campaigns SET status = 'completed' WHERE id = ? AND tenant_id = ?",
      )
        .bind(camp.id, tenantId)
        .run();
    }

  }

  return json({
    ok: true,
    processed,
    campaigns: runResult,
    errorSummary: globalErrors.length > 0 ? globalErrors.slice(0, 3) : undefined,
  });
}

async function handleCampaigns(request: Request, env: Env, method: string, url: URL) {
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);
  const pathname = url.pathname;
  const parts = pathname.split("/").filter(Boolean);
  const idParam = parts.length >= 3 ? parts[2] : null;
  const isSingle = idParam && /^\d+$/.test(idParam);
  const campaignId = isSingle ? Number(idParam) : null;

  if (method === "POST" && parts[2] === "run") {
    const ignoreWindow = url.searchParams.get("ignoreWindow") === "1";
    const result = await handleCampaignRun(env, tenantId, ignoreWindow);
    return result;
  }

  if (method === "GET") {
    if (isSingle && campaignId) {
      const row = await env.DB.prepare(
        "SELECT id, name, delay_min, delay_max, time_from, time_to, days_blocked, funnel_id, crm_column_id, status, total_leads, sent, errors, no_whatsapp, created_at FROM campaigns WHERE id = ? AND tenant_id = ?",
      )
        .bind(campaignId, tenantId)
        .first();
      if (!row) return json({ error: "Campanha não encontrada" }, { status: 404 });
      return json(row);
    }
    const res = await env.DB.prepare(
      "SELECT id, name, delay_min, delay_max, time_from, time_to, days_blocked, funnel_id, crm_column_id, status, total_leads, sent, errors, no_whatsapp, created_at FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC",
    ).bind(tenantId).all();
    return json(res.results || []);
  }

  if (method === "POST" && !isSingle) {
    const body = await readBody<any>(request);
    const {
      name,
      delay_min,
      delay_max,
      time_from,
      time_to,
      days_blocked = [],
      funnel_id = null,
      crm_column_id = null,
    } = body;

    if (!name) return json({ error: "Nome obrigatório" }, { status: 400 });

    const res = await env.DB.prepare(
      `INSERT INTO campaigns
       (tenant_id, name, delay_min, delay_max, time_from, time_to, days_blocked, funnel_id, crm_column_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        tenantId,
        name,
        delay_min ?? 6,
        delay_max ?? 15,
        time_from ?? "09:00",
        time_to ?? "18:00",
        JSON.stringify(Array.isArray(days_blocked) ? days_blocked : []),
        funnel_id ?? null,
        crm_column_id ?? null,
      )
      .run();

    const raw = res as { meta?: { last_row_id?: number }; lastRowId?: number };
    const lastId = raw.meta?.last_row_id ?? raw.lastRowId ?? 0;
    const created = await env.DB.prepare(
      "SELECT id, name, delay_min, delay_max, time_from, time_to, days_blocked, funnel_id, crm_column_id, status, total_leads, sent, errors, no_whatsapp, created_at FROM campaigns WHERE id = ? AND tenant_id = ?",
    )
      .bind(lastId, tenantId)
      .first();

    if (!created) return json({ error: "Campanha criada mas não encontrada" }, { status: 500 });
    return json(created, { status: 201 });
  }

  if (method === "PUT" && isSingle && campaignId) {
    const body = await readBody<any>(request);
    const {
      name,
      delay_min,
      delay_max,
      time_from,
      time_to,
      days_blocked,
      status: newStatus,
    } = body;

    const existing = await env.DB.prepare(
      "SELECT id FROM campaigns WHERE id = ? AND tenant_id = ?",
    )
      .bind(campaignId, tenantId)
      .first();
    if (!existing) return json({ error: "Campanha não encontrada" }, { status: 404 });

    const updates: string[] = [];
    const params: unknown[] = [];
    if (name !== undefined) {
      updates.push("name = ?");
      params.push(String(name));
    }
    if (delay_min !== undefined) {
      updates.push("delay_min = ?");
      params.push(Number(delay_min));
    }
    if (delay_max !== undefined) {
      updates.push("delay_max = ?");
      params.push(Number(delay_max));
    }
    if (time_from !== undefined) {
      updates.push("time_from = ?");
      params.push(String(time_from));
    }
    if (time_to !== undefined) {
      updates.push("time_to = ?");
      params.push(String(time_to));
    }
    if (days_blocked !== undefined) {
      updates.push("days_blocked = ?");
      params.push(JSON.stringify(Array.isArray(days_blocked) ? days_blocked : []));
    }
    if (newStatus !== undefined && ["draft", "active", "paused", "completed"].includes(String(newStatus))) {
      updates.push("status = ?");
      params.push(String(newStatus));
      if (newStatus === "active") {
        const countRow = await env.DB.prepare(
          "SELECT COUNT(*) as total FROM leads WHERE tenant_id = ? AND phone IS NOT NULL AND trim(phone) != ''",
        )
          .bind(tenantId)
          .first<{ total: number }>();
        const total = Number(countRow?.total ?? 0);
        updates.push("total_leads = ?");
        params.push(total);
      }
    }
    if (updates.length === 0) return json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    params.push(campaignId, tenantId);
    await env.DB.prepare(
      `UPDATE campaigns SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
    )
      .bind(...params)
      .run();

    const updated = await env.DB.prepare(
      "SELECT id, name, delay_min, delay_max, time_from, time_to, days_blocked, funnel_id, crm_column_id, status, total_leads, sent, errors, no_whatsapp, created_at FROM campaigns WHERE id = ? AND tenant_id = ?",
    )
      .bind(campaignId, tenantId)
      .first();
    return json(updated);
  }

  if (method === "DELETE" && isSingle && campaignId) {
    const existing = await env.DB.prepare(
      "SELECT id FROM campaigns WHERE id = ? AND tenant_id = ?",
    )
      .bind(campaignId, tenantId)
      .first();
    if (!existing) return json({ error: "Campanha não encontrada" }, { status: 404 });
    await env.DB.prepare("DELETE FROM campaigns WHERE id = ? AND tenant_id = ?")
      .bind(campaignId, tenantId)
      .run();
    return json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
}

async function handleSettings(request: Request, env: Env, method: string) {
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  if (method === "GET") {
    const row = await env.DB.prepare(
      "SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = ?",
    )
      .bind(tenantId, "notification_whatsapp_phone")
      .first<{ value: string | null }>();
    return json({ notification_whatsapp_phone: row?.value ?? "" });
  }

  if (method === "PUT") {
    const body = await readBody<{ notification_whatsapp_phone?: string }>(request);
    const value = body.notification_whatsapp_phone != null ? String(body.notification_whatsapp_phone).trim() : "";
    await env.DB.prepare(
      "INSERT OR REPLACE INTO tenant_settings (tenant_id, key, value) VALUES (?, ?, ?)",
    )
      .bind(tenantId, "notification_whatsapp_phone", value)
      .run();
    return json({ notification_whatsapp_phone: value });
  }

  return new Response("Method not allowed", { status: 405 });
}

async function handleCRM(request: Request, env: Env, method: string, url: URL) {
  const pathname = url.pathname;
  const parts = pathname.split("/").filter(Boolean);
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  // /api/crm/columns
  if (parts.length === 3 && parts[2] === "columns") {
    if (method === "GET") {
      const res = await env.DB.prepare(
        "SELECT id, name, position FROM crm_columns WHERE tenant_id = ? ORDER BY position ASC",
      ).bind(tenantId).all();
      return json(res.results || []);
    }

    if (method === "POST") {
      const body = await readBody<{ name?: string; position?: number }>(request);
      if (!body.name) return json({ error: "Nome obrigatório" }, { status: 400 });
      const res = await env.DB.prepare(
        "INSERT INTO crm_columns (tenant_id, name, position) VALUES (?, ?, ?)",
      )
        .bind(tenantId, body.name, body.position ?? 0)
        .run();
      const created = await env.DB.prepare(
        "SELECT id, name, position FROM crm_columns WHERE id = ? AND tenant_id = ?",
      )
        .bind(res.lastRowId, tenantId)
        .first();
      return json(created, { status: 201 });
    }

    return new Response("Method not allowed", { status: 405 });
  }

  // /api/crm/leads
  if (parts.length === 3 && parts[2] === "leads") {
    if (method === "GET") {
      const res = await env.DB.prepare(
        `SELECT c.id, c.lead_id, c.column_id, c.position,
                l.company, l.phone,
                col.name as column_name
         FROM crm_leads c
         JOIN leads l ON l.id = c.lead_id
         JOIN crm_columns col ON col.id = c.column_id
         WHERE c.tenant_id = ?
         ORDER BY col.position ASC, c.position ASC`,
      ).bind(tenantId).all();
      return json(res.results || []);
    }

    if (method === "POST") {
      const body = await readBody<{ lead_id?: number; column_id?: number }>(request);
      if (!body.lead_id || !body.column_id) {
        return json({ error: "lead_id e column_id são obrigatórios" }, { status: 400 });
      }

      const res = await env.DB.prepare(
        `INSERT INTO crm_leads (tenant_id, lead_id, column_id, position)
         VALUES (?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM crm_leads WHERE tenant_id = ? AND column_id = ?), 0))`,
      )
        .bind(tenantId, body.lead_id, body.column_id, tenantId, body.column_id)
        .run();

      return json({ ok: true, id: res.lastRowId }, { status: 201 });
    }

    if (method === "PUT") {
      const body = await readBody<{ id: number; column_id: number; position: number }>(request);
      if (!body.id) return json({ error: "ID obrigatório" }, { status: 400 });
      await env.DB.prepare(
        "UPDATE crm_leads SET column_id = ?, position = ? WHERE id = ? AND tenant_id = ?",
      )
        .bind(body.column_id, body.position, body.id, tenantId)
        .run();
      return json({ ok: true });
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "ID obrigatório" }, { status: 400 });
      await env.DB.prepare(
        "DELETE FROM crm_leads WHERE id = ? AND tenant_id = ?",
      )
        .bind(id, tenantId)
        .run();
      return json({ ok: true });
    }

    return new Response("Method not allowed", { status: 405 });
  }

  return new Response("Not found", { status: 404 });
}

async function handleInstagramTools(request: Request, env: Env, method: string, url: URL) {
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  const pathname = url.pathname;
  const parts = pathname.split("/").filter(Boolean);

  // /api/tools/instagram/jobs
  if (parts.length === 4 && parts[2] === "instagram" && parts[3] === "jobs") {
    if (method === "GET") {
      const res = await env.DB.prepare(
        `SELECT id, profile, status, total_leads, created_at, updated_at, error_message
         FROM instagram_jobs
         WHERE tenant_id = ?
         ORDER BY created_at DESC`,
      )
        .bind(tenantId)
        .all();
      return json(res.results || []);
    }
  }

  // /api/tools/instagram/config
  // Agora usado para armazenar username (opcional) e um token de extensão por tenant
  if (parts.length === 4 && parts[2] === "instagram" && parts[3] === "config") {
    if (method === "GET") {
      const row = await env.DB.prepare(
        "SELECT config_json FROM tools_extractors WHERE tenant_id = ? AND type = 'instagram' LIMIT 1",
      )
        .bind(tenantId)
        .first<{ config_json?: string }>();

      let username: string | null = null;
      let extensionToken: string | null = null;

      if (row?.config_json) {
        try {
          const parsed = JSON.parse(row.config_json) as {
            username?: string;
            extensionToken?: string;
          };
          username = parsed.username || null;
          extensionToken = parsed.extensionToken || null;
        } catch {
          // se der erro de parse, vamos gerar um novo config limpo abaixo
        }
      }

      if (!extensionToken) {
        extensionToken = crypto.randomUUID().replace(/-/g, "");
        const config = JSON.stringify({ username, extensionToken });

        await env.DB.prepare(
          "DELETE FROM tools_extractors WHERE tenant_id = ? AND type = 'instagram'",
        )
          .bind(tenantId)
          .run();

        await env.DB.prepare(
          `INSERT INTO tools_extractors (tenant_id, type, name, config_json)
           VALUES (?, 'instagram', 'default', ?)`,
        )
          .bind(tenantId, config)
          .run();
      }

      return json({
        username,
        hasPassword: false,
        extensionToken,
      });
    }

    return new Response("Method not allowed", { status: 405 });
  }

  // /api/tools/instagram/login-start -> chama serviço do Railway para iniciar login (pode pedir 2FA)
  if (parts.length === 4 && parts[2] === "instagram" && parts[3] === "login-start") {
    return new Response("Instagram login via backend desativado. Use a extensão.", {
      status: 400,
    });
  }

  // /api/tools/instagram/login-verify -> envia código 2FA para o serviço de extração
  if (parts.length === 4 && parts[2] === "instagram" && parts[3] === "login-verify") {
    return new Response("Instagram login via backend desativado. Use a extensão.", {
      status: 400,
    });
  }

  // /api/tools/instagram/start
  if (parts.length === 4 && parts[2] === "instagram" && parts[3] === "start") {
    if (method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = await readBody<{ profile?: string }>(request);
    const profile = (body.profile || "").trim();
    if (!profile) return json({ error: "Perfil é obrigatório" }, { status: 400 });

    const res = await env.DB.prepare(
      `INSERT INTO instagram_jobs (tenant_id, profile, status)
       VALUES (?, ?, 'pending')`,
    )
      .bind(tenantId, profile)
      .run();

    const jobId = res.lastRowId;

    // No modelo com extensão, a própria extensão vai enviar os leads para o webhook.
    // Aqui apenas registramos o job.

    return json({ ok: true, jobId }, { status: 201 });
  }

  // /api/tools/instagram/push-leads  (chamado pelo serviço externo)
  if (parts.length === 4 && parts[2] === "instagram" && parts[3] === "push-leads") {
    if (method !== "POST") return new Response("Method not allowed", { status: 405 });

    // Valida token da extensão por tenant
    const extToken = request.headers.get("x-extension-token") || "";
    const cfgRow = await env.DB.prepare(
      "SELECT config_json FROM tools_extractors WHERE tenant_id = ? AND type = 'instagram' LIMIT 1",
    )
      .bind(tenantId)
      .first<{ config_json?: string }>();

    if (!cfgRow?.config_json) {
      return json(
        { error: "Token da extensão não configurado para este tenant." },
        { status: 401 },
      );
    }

    let expectedToken: string | null = null;
    try {
      const parsed = JSON.parse(cfgRow.config_json) as {
        extensionToken?: string;
      };
      expectedToken = parsed.extensionToken || null;
    } catch {
      return json(
        { error: "Configuração da ferramenta Instagram inválida para este tenant." },
        { status: 401 },
      );
    }

    if (!extToken || !expectedToken || extToken !== expectedToken) {
      return json({ error: "Token da extensão inválido." }, { status: 401 });
    }

    const body = await readBody<{
      jobId?: number;
      tenantId?: string;
      leads?: Array<{ company: string; phone: string }>;
      done?: boolean;
      error?: string;
    }>(request);

    let jobId = body.jobId;
    const fromExtractorTenant = body.tenantId || tenantId;

    if (!Array.isArray(body.leads)) {
      return json({ error: "Leads são obrigatórios" }, { status: 400 });
    }

    await ensureTenant(env, fromExtractorTenant);

    // Se não veio jobId, criamos um automaticamente
    if (!jobId) {
      const resJob = await env.DB.prepare(
        `INSERT INTO instagram_jobs (tenant_id, profile, status)
         VALUES (?, ?, 'running')`,
      )
        .bind(fromExtractorTenant, "via_extensao")
        .run();
      const raw = resJob as { meta?: { last_row_id?: number }; lastRowId?: number };
      jobId = raw.meta?.last_row_id ?? raw.lastRowId ?? 0;
    }

    // Insere leads em lote (D1 não aceita undefined em .bind())
    const leads = body.leads;
    let inserted = 0;
    for (const lead of leads) {
      const company = lead?.company != null ? String(lead.company) : "";
      const phone = lead?.phone != null ? String(lead.phone) : "";
      if (!company.trim() || !phone.trim()) continue;
      await env.DB.prepare(
        "INSERT INTO leads (tenant_id, company, phone, folder_id) VALUES (?, ?, ?, NULL)",
      )
        .bind(fromExtractorTenant, company, phone)
        .run();
      inserted += 1;
    }

    const statusStr = body.error ? "error" : body.done ? "completed" : "running";
    const errMsg = body.error != null ? String(body.error) : null;
    const jobIdNum = Number(jobId) || 0;

    await env.DB.prepare(
      `UPDATE instagram_jobs
       SET total_leads = total_leads + ?, status = ?,
           error_message = COALESCE(?, error_message),
           updated_at = datetime('now')
       WHERE id = ? AND tenant_id = ?`,
    )
      .bind(inserted, statusStr, errMsg, jobIdNum, fromExtractorTenant)
      .run();

    return json({ ok: true, inserted });
  }

  return new Response("Not found", { status: 404 });
}

/** Pathname normalizado para roteamento: usa /api/... e colapsa /api/api/ em /api/. */
function normalisePathname(pathname: string): string {
  const i = pathname.indexOf("/api/");
  if (i < 0) return pathname;
  let p = pathname.slice(i);
  while (p.startsWith("/api/api/")) p = p.replace(/^\/api\/api/, "/api");
  return p;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = normalisePathname(url.pathname);
    const urlForRouting = pathname !== url.pathname ? new URL(pathname + url.search, request.url) : url;
    const method = request.method.toUpperCase();

    // CORS simples para desenvolvimento
    const origin = request.headers.get("Origin") || "*";
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key, x-tenant-id, x-extension-token",
        },
      });
    }

    let response: Response;

    try {
      if (pathname === "/api/admin/create-tenant-user" && method === "POST") {
        response = await handleAdminCreateTenantUser(request, env);
      } else if (pathname === "/api/admin/users" && method === "GET") {
        response = await handleAdminListUsers(request, env);
      } else if (pathname === "/api/admin/users" && method === "DELETE") {
        response = await handleAdminDeleteUser(request, env, urlForRouting);
      } else if (pathname === "/api/auth/login" && method === "POST") {
        response = await handleClientLogin(request, env);
      } else if (pathname === "/api/settings" && (method === "GET" || method === "PUT")) {
        response = await handleSettings(request, env, method);
      } else if (pathname.startsWith("/api/connections/whatsapp")) {
        response = await handleWhatsappConnection(request, env, method, urlForRouting);
      } else if (pathname.startsWith("/api/lead-folders")) {
        response = await handleLeadFolders(request, env, method, urlForRouting);
      } else if (pathname.startsWith("/api/leads")) {
        response = await handleLeads(request, env, method, urlForRouting);
      } else if (pathname.startsWith("/api/agents")) {
        response = await handleAgents(request, env, method, urlForRouting);
      } else if (pathname.startsWith("/api/campaigns")) {
        response = await handleCampaigns(request, env, method, urlForRouting);
      } else if (pathname.startsWith("/api/crm")) {
        response = await handleCRM(request, env, method, urlForRouting);
      } else if (pathname.startsWith("/api/tools/instagram")) {
        response = await handleInstagramTools(request, env, method, urlForRouting);
      } else if (pathname === "/api/ai/disparo" && method === "POST") {
        response = await handleAIDisparo(request, env);
      } else if (pathname === "/api/ai/atendimento" && method === "POST") {
        response = await handleAIAgent(request, env, "atendimento");
      } else if (pathname === "/api/ai/agendamento" && method === "POST") {
        response = await handleAIAgent(request, env, "agendamento");
      } else {
        response = notFound();
      }
    } catch (err: any) {
      // Garante que mesmo erros internos retornem CORS correto
      response = json(
        { error: "Internal error", details: err?.message || String(err) },
        { status: 500 },
      );
    }

    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key, x-tenant-id, x-extension-token");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;

