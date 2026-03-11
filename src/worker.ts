export interface Env {
  DB: D1Database;
  BOT_SERVICE_URL: string;
  OPENAI_API_KEY: string;
  ADMIN_API_KEY: string;
  EXTRACTOR_SERVICE_URL: string;
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

  if (method === "GET") {
    const row = await env.DB.prepare(
      "SELECT type, status, agent_enabled, reply_all FROM connections WHERE tenant_id = ? AND type = 'whatsapp' LIMIT 1"
    ).bind(tenantId).first();

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
    const phone = typeof body.phone === "string" ? body.phone : "";
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
    if (!body.company || !body.phone) {
      return json({ error: "Empresa e telefone são obrigatórios" }, { status: 400 });
    }

    await env.DB.prepare(
      "UPDATE leads SET company = ?, phone = ?, folder_id = ? WHERE id = ? AND tenant_id = ?",
    )
      .bind(body.company, body.phone, body.folder_id ?? null, id, tenantId)
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

async function handleCampaigns(request: Request, env: Env, method: string, url: URL) {
  const tenantId = getTenantId(request);
  await ensureTenant(env, tenantId);

  if (method === "GET") {
    const res = await env.DB.prepare(
      "SELECT id, name, delay_min, delay_max, time_from, time_to, days_blocked, funnel_id, crm_column_id, status, total_leads, sent, errors, no_whatsapp, created_at FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC",
    ).bind(tenantId).all();
    return json(res.results || []);
  }

  if (method === "POST") {
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
        JSON.stringify(days_blocked),
        funnel_id,
        crm_column_id,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?",
    )
      .bind(res.lastRowId, tenantId)
      .first();

    return json(created, { status: 201 });
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

    // Dispara chamada opcional para o serviço externo de extração (Railway)
    if (env.EXTRACTOR_SERVICE_URL) {
      try {
        await fetch(`${env.EXTRACTOR_SERVICE_URL}/api/instagram/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            tenantId,
            profile,
            callbackUrl: `${url.origin}/api/tools/instagram/push-leads`,
          }),
        });

        await env.DB.prepare(
          "UPDATE instagram_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
        )
          .bind(jobId, tenantId)
          .run();
      } catch (err: any) {
        await env.DB.prepare(
          "UPDATE instagram_jobs SET status = 'error', error_message = ? WHERE id = ? AND tenant_id = ?",
        )
          .bind(err?.message || String(err), jobId, tenantId)
          .run();
      }
    }

    return json({ ok: true, jobId }, { status: 201 });
  }

  // /api/tools/instagram/push-leads  (chamado pelo serviço externo)
  if (parts.length === 4 && parts[2] === "instagram" && parts[3] === "push-leads") {
    if (method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = await readBody<{
      jobId?: number;
      tenantId?: string;
      leads?: Array<{ company: string; phone: string }>;
      done?: boolean;
      error?: string;
    }>(request);

    const jobId = body.jobId;
    const fromExtractorTenant = body.tenantId || tenantId;

    if (!jobId || !Array.isArray(body.leads)) {
      return json({ error: "jobId e leads são obrigatórios" }, { status: 400 });
    }

    await ensureTenant(env, fromExtractorTenant);

    // Insere leads em lote
    const leads = body.leads;
    let inserted = 0;
    for (const lead of leads) {
      if (!lead.company || !lead.phone) continue;
      await env.DB.prepare(
        "INSERT INTO leads (tenant_id, company, phone, folder_id) VALUES (?, ?, ?, NULL)",
      )
        .bind(fromExtractorTenant, lead.company, lead.phone)
        .run();
      inserted += 1;
    }

    await env.DB.prepare(
      `UPDATE instagram_jobs
       SET total_leads = total_leads + ?, status = ?,
           error_message = COALESCE(?, error_message),
           updated_at = datetime('now')
       WHERE id = ? AND tenant_id = ?`,
    )
      .bind(
        inserted,
        body.error ? "error" : body.done ? "completed" : "running",
        body.error || null,
        jobId,
        fromExtractorTenant,
      )
      .run();

    return json({ ok: true, inserted });
  }

  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    // CORS simples para desenvolvimento
    const origin = request.headers.get("Origin") || "*";
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key, x-tenant-id",
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
        response = await handleAdminDeleteUser(request, env, url);
      } else if (pathname === "/api/auth/login" && method === "POST") {
        response = await handleClientLogin(request, env);
      } else if (pathname.startsWith("/api/connections/whatsapp")) {
        response = await handleWhatsappConnection(request, env, method, url);
      } else if (pathname.startsWith("/api/lead-folders")) {
        response = await handleLeadFolders(request, env, method, url);
      } else if (pathname.startsWith("/api/leads")) {
        response = await handleLeads(request, env, method, url);
      } else if (pathname.startsWith("/api/agents")) {
        response = await handleAgents(request, env, method, url);
      } else if (pathname.startsWith("/api/campaigns")) {
        response = await handleCampaigns(request, env, method, url);
      } else if (pathname.startsWith("/api/crm")) {
        response = await handleCRM(request, env, method, url);
      } else if (pathname.startsWith("/api/tools/instagram")) {
        response = await handleInstagramTools(request, env, method, url);
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
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key, x-tenant-id");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;

