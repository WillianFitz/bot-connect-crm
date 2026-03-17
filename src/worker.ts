export interface Env {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  MEDIA_PUBLIC_URL: string;
  BOT_SERVICE_URL: string;
  OPENAI_API_KEY: string;
  ADMIN_API_KEY: string;
  EXTRACTOR_SERVICE_URL: string;
  EVOLUTION_API_URL: string;
  EVOLUTION_API_KEY: string;
  JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
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

async function getTenantId(request: Request, env: Env): Promise<string> {
  const authHeader = request.headers.get("Authorization");
  if (env.JWT_SECRET && authHeader?.startsWith("Bearer ")) {
    const payload = await verifyJwt(authHeader.slice(7), env.JWT_SECRET);
    if (payload) return payload.tenantId;
  }
  const header = request.headers.get("x-tenant-id");
  if (!header) return "tenant_demo";
  return header;
}

async function signAdminJwt(secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { role: "admin", iat: now, exp: now + 60 * 60 * 8 };
  const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const enc = (o: object) => b64(new TextEncoder().encode(JSON.stringify(o)));
  const msg = `${enc(header)}.${enc(body)}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return `${msg}.${b64(new Uint8Array(sig))}`;
}

async function verifyAdminJwt(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payloadJson = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { role?: string; exp?: number };
    if (payload.role !== "admin") return false;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return false;
    const msg = `${parts[0]}.${parts[1]}`;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
    const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return parts[2] === b64(new Uint8Array(sig));
  } catch {
    return false;
  }
}

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  // Preferred: short-lived admin JWT via Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ") && env.JWT_SECRET) {
    if (await verifyAdminJwt(authHeader.slice(7), env.JWT_SECRET)) return true;
  }
  // Fallback: static x-admin-key (only accepted when JWT_SECRET is not set)
  if (!env.JWT_SECRET) {
    const key = request.headers.get("x-admin-key");
    return !!key && key === env.ADMIN_API_KEY;
  }
  return false;
}

async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  const body = await readBody<{ key?: string }>(request);
  if (!body.key || body.key !== env.ADMIN_API_KEY) {
    return json({ error: "Chave inválida" }, { status: 401 });
  }
  if (!env.JWT_SECRET) {
    return json({ error: "JWT_SECRET não configurado no servidor" }, { status: 500 });
  }
  const token = await signAdminJwt(env.JWT_SECRET);
  return json({ ok: true, token });
}

const PBKDF2_ITERATIONS = 120000;
const SALT_LEN = 16;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("pbkdf2:")) {
    const legacyHash = await legacySha256Hash(password);
    return legacyHash === stored;
  }
  const [, itersStr, saltHex, hashHex] = stored.split(":");
  const iterations = parseInt(itersStr || "0", 10) || PBKDF2_ITERATIONS;
  const salt = new Uint8Array(saltHex!.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  const got = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return got === hashHex;
}

async function legacySha256Hash(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signJwt(payload: { tenantId: string; username: string }, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + 60 * 60 * 24 };
  const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const enc = (o: object) => b64(new TextEncoder().encode(JSON.stringify(o)));
  const msg = `${enc(header)}.${enc(body)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return `${msg}.${b64(new Uint8Array(sig))}`;
}

async function verifyJwt(token: string, secret: string): Promise<{ tenantId: string; username: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [, payloadB64] = parts;
    const payloadJson = atob(payloadB64!.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { tenantId?: string; username?: string; exp?: number };
    if (!payload.tenantId || !payload.username || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    const msg = `${parts[0]}.${parts[1]}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
    const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const expected = b64(new Uint8Array(sig));
    if (parts[2] !== expected) return null;
    return { tenantId: payload.tenantId, username: payload.username };
  } catch {
    return null;
  }
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
  options?: { temperature?: number; top_p?: number },
) {
  const body: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages,
    temperature: options?.temperature ?? 0.7,
  };
  if (options?.top_p != null) body.top_p = options.top_p;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
  if (!(await isAdmin(request, env))) {
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
  if (!(await isAdmin(request, env))) {
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
  if (!(await isAdmin(request, env))) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = url.searchParams.get("id");
  if (!id) return json({ error: "ID obrigatório" }, { status: 400 });

  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

async function handleClientLogin(request: Request, env: Env): Promise<Response> {
  const body = await readBody<{ username?: string; password?: string }>(request);
  if (!body.username || !body.password) {
    return json({ error: "username e password são obrigatórios" }, { status: 400 });
  }

  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
  const rateKey = `login:${body.username}:${ip}`;
  const windowStart = Date.now() - LOGIN_RATE_LIMIT_WINDOW_MS;
  await env.DB.prepare(
    "DELETE FROM login_attempts WHERE key = ? AND window_start < ?",
  )
    .bind(rateKey, new Date(windowStart).toISOString())
    .run();
  const rateRow = await env.DB.prepare(
    "SELECT attempts FROM login_attempts WHERE key = ? LIMIT 1",
  )
    .bind(rateKey)
    .first<{ attempts: number }>();
  const attempts = Number(rateRow?.attempts ?? 0);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    return json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429 },
    );
  }

  const row = await env.DB.prepare(
    "SELECT tenant_id, username, password_hash FROM users WHERE username = ? LIMIT 1",
  )
    .bind(body.username)
    .first<{ tenant_id: string; username: string; password_hash: string }>();

  const invalidCreds = async () => {
    await env.DB.prepare(
      `INSERT INTO login_attempts (key, attempts, window_start) VALUES (?, 1, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1`,
    )
      .bind(rateKey)
      .run();
    return json({ error: "Credenciais inválidas" }, { status: 401 });
  };

  if (!row) {
    return invalidCreds();
  }

  const ok = await verifyPassword(body.password, row.password_hash);
  if (!ok) {
    return invalidCreds();
  }

  await env.DB.prepare("DELETE FROM login_attempts WHERE key = ?").bind(rateKey).run();

  const out: { ok: true; tenantId: string; username: string; token?: string } = {
    ok: true,
    tenantId: row.tenant_id,
    username: row.username,
  };
  if (env.JWT_SECRET) {
    out.token = await signJwt({ tenantId: row.tenant_id, username: row.username }, env.JWT_SECRET);
  }
  return json(out);
}

async function handleWhatsappConnection(request: Request, env: Env, method: string, url: URL) {
  const tenantId = await getTenantId(request, env);
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
      const workerOrigin = new URL(request.url).origin;
      const webhookUrl = `${workerOrigin}/api/webhook/evolution`;

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
          webhook: {
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
          },
        }),
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        console.error("[worker] Evolution API error (QR create):", JSON.stringify(data));
        return json(
          {
            qr: null,
            error:
              data?.response?.message?.[0] ||
              "Não foi possível gerar o QR. Verifique a instância na Evolution API.",
          },
          { status: res.status },
        );
      }

      const base64 = data?.qrcode?.base64 || null;
      if (!base64) {
        return json(
          {
            qr: null,
            error:
              "QR ainda não disponível. Tente novamente em alguns segundos ou confira no painel da Evolution.",
          },
          { status: 200 },
        );
      }

      return json({ qr: base64 });
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
        method: "DELETE",
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

    // Marca como disconnected (não deleta a linha para preservar agent_enabled/reply_all)
    await env.DB.prepare(
      `INSERT INTO connections (tenant_id, type, status, agent_enabled, reply_all)
       VALUES (?, 'whatsapp', 'disconnected', 0, 0)
       ON CONFLICT(tenant_id, type) DO UPDATE SET
         status = 'disconnected',
         updated_at = datetime('now')`,
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

    // Se Evolution estiver configurada, sincroniza o estado real
    if (baseUrl && env.EVOLUTION_API_KEY) {
      try {
        const res = await fetch(`${baseUrl}/instance/connectionState/${tenantId}`, {
          method: "GET",
          headers: { apikey: env.EVOLUTION_API_KEY },
        });

        if (res.ok) {
          const evData = (await res.json()) as any;
          const state = evData?.instance?.state;
          const mappedStatus = state === "open" ? "connected" : "disconnected";

          // Regra: Evolution pode forçar "disconnected" a qualquer momento.
          // Mas NÃO pode sobrescrever "disconnected" → "connected" (previne race condition
          // onde Evolution ainda responde "open" depois de um delete/logout explícito do CRM).
          // A transição disconnected→connected só ocorre via webhook connection.update.
          const shouldUpdate = mappedStatus === "disconnected" || !row || row.status !== "disconnected";

          if (shouldUpdate) {
            await env.DB.prepare(
              `INSERT INTO connections (tenant_id, type, status, agent_enabled, reply_all)
               VALUES (?, 'whatsapp', ?, COALESCE(?, 0), COALESCE(?, 0))
               ON CONFLICT(tenant_id, type) DO UPDATE SET
                 status = excluded.status,
                 updated_at = datetime('now')`,
            )
              .bind(tenantId, mappedStatus, row?.agent_enabled ?? 0, row?.reply_all ?? 0)
              .run();

            row = {
              type: "whatsapp",
              status: mappedStatus,
              agent_enabled: row?.agent_enabled ?? 0,
              reply_all: row?.reply_all ?? 0,
            };
          }
        } else if (row) {
          // Instância não existe na Evolution (404/400) → marcar disconnected
          await env.DB.prepare(
            "UPDATE connections SET status = 'disconnected', updated_at = datetime('now') WHERE tenant_id = ? AND type = 'whatsapp'",
          ).bind(tenantId).run();
          row = { ...row, status: "disconnected" };
        }
        // Se row é null e Evolution retornou erro: nenhuma instância ativa, retorna fallback
      } catch {
        // se falhar (rede), devolve o que tiver em D1
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
  const tenantId = await getTenantId(request, env);
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
  const tenantId = await getTenantId(request, env);
  await ensureTenant(env, tenantId);

  if (method === "GET") {
    const searchRaw = url.searchParams.get("q") || "";
    const search = searchRaw.trim().slice(0, 100);
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
  const tenantId = await getTenantId(request, env);
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

  // /api/agents/atendimento/media   — upload/list/delete agent media
  // /api/agents/atendimento/clear-memory — clear conversation memory
  if (parts.length === 4 && parts[2] === "atendimento") {
    const sub = parts[3];

    if (sub === "media") {
      if (method === "GET") {
        const res = await env.DB.prepare(
          "SELECT id, media_id, file_name, media_type, url, created_at FROM agent_media WHERE tenant_id = ? ORDER BY created_at DESC",
        ).bind(tenantId).all();
        return json(res.results || []);
      }

      if (method === "POST") {
        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return json({ error: "Esperado multipart/form-data" }, { status: 400 });
        }

        const file = formData.get("file") as File | null;
        const mediaId = (formData.get("media_id") as string | null)?.trim();
        const fileName = (formData.get("file_name") as string | null)?.trim() || file?.name || mediaId || "file";

        if (!file || !mediaId) {
          return json({ error: "Campos obrigatórios: file, media_id" }, { status: 400 });
        }
        if (!/^[a-z0-9_\-]+$/.test(mediaId)) {
          return json({ error: "media_id inválido: use apenas a-z 0-9 _ -" }, { status: 400 });
        }

        // Build R2 key: tenant/mediaId.ext
        const ext = (file.name.split(".").pop() ?? "").toLowerCase();
        const r2Key = `${tenantId}/${mediaId}${ext ? "." + ext : ""}`;

        // Upload to R2
        try {
          await env.MEDIA_BUCKET.put(r2Key, file.stream(), {
            httpMetadata: { contentType: file.type },
          });
        } catch (err: any) {
          console.error("[R2 upload]", err?.message);
          return json({ error: `Erro no upload R2: ${err?.message}` }, { status: 500 });
        }

        const publicUrl = `${env.MEDIA_PUBLIC_URL.replace(/\/$/, "")}/${r2Key}`;

        // Save metadata to D1
        try {
          const result = await env.DB.prepare(
            `INSERT INTO agent_media (tenant_id, media_id, file_name, media_type, url)
             VALUES (?, ?, ?, ?, ?)`,
          ).bind(tenantId, mediaId, fileName, file.type, publicUrl).run();
          return json({ ok: true, id: result.meta.last_row_id, url: publicUrl });
        } catch (err: any) {
          // Rollback R2 upload on D1 failure
          await env.MEDIA_BUCKET.delete(r2Key).catch(() => {});
          const msg: string = err?.message ?? "";
          if (msg.toLowerCase().includes("unique")) {
            return json({ error: "media_id já existe. Escolha outro nome." }, { status: 409 });
          }
          console.error("[agent_media d1]", msg);
          return json({ error: `Erro ao salvar: ${msg}` }, { status: 500 });
        }
      }

      if (method === "DELETE") {
        const idParam = url.searchParams.get("id");
        if (!idParam) return json({ error: "Parâmetro id obrigatório" }, { status: 400 });

        // Fetch URL to derive R2 key before deleting
        const row = await env.DB.prepare(
          "SELECT url FROM agent_media WHERE id = ? AND tenant_id = ?",
        ).bind(Number(idParam), tenantId).first<{ url: string }>();

        if (row?.url) {
          const base = env.MEDIA_PUBLIC_URL.replace(/\/$/, "");
          const r2Key = row.url.replace(base + "/", "");
          await env.MEDIA_BUCKET.delete(r2Key).catch(() => {});
        }

        await env.DB.prepare(
          "DELETE FROM agent_media WHERE id = ? AND tenant_id = ?",
        ).bind(Number(idParam), tenantId).run();
        return json({ ok: true });
      }

      return new Response("Method not allowed", { status: 405 });
    }

    if (sub === "clear-memory") {
      if (method === "POST") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM agent_conversations WHERE tenant_id = ?").bind(tenantId),
          env.DB.prepare("DELETE FROM agent_pauses WHERE tenant_id = ?").bind(tenantId),
        ]);
        return json({ ok: true });
      }
      return new Response("Method not allowed", { status: 405 });
    }
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
  const tenantId = await getTenantId(request, env);
  await ensureTenant(env, tenantId);

  const row = await env.DB.prepare(
    `SELECT base_prompt FROM agents WHERE tenant_id = ? AND id = 'disparo' LIMIT 1`,
  )
    .bind(tenantId)
    .first<{ base_prompt?: string }>();

  const basePrompt = row?.base_prompt || `Você gera a primeira mensagem que a EMPRESA envia para um LEAD (prospecção). A empresa está entrando em contato com o lead — não use "Como posso ajudar?". Use saudação de quem inicia o contato. Use o nome da empresa LeadFlowAI e peça 1 minuto para uma proposta. Pode usar o nome do lead. Responda EXCLUSIVAMENTE em JSON: {"mensagem": "texto"}.`;

  const disparoOptions = { temperature: 0.9, top_p: 0.95 };
  const content = await callOpenAI(
    env,
    [
      { role: "system", content: basePrompt },
      { role: "user", content: "Gere uma saudação válida conforme as regras." },
    ],
    disparoOptions,
  );

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
  const tenantId = await getTenantId(request, env);
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
    .first<{ base_prompt?: string | null; default_message?: string | null }>();
  const savedPrompt = row?.base_prompt != null ? String(row.base_prompt).trim() : "";
  const defaultMsg = (row?.default_message != null ? String(row.default_message).trim() : "") || "Olá! Tudo bem?";
  if (row && !savedPrompt) {
    return defaultMsg;
  }
  const basePrompt =
    savedPrompt ||
    `Você gera a primeira mensagem que a EMPRESA envia para um LEAD (prospecção). A empresa está entrando em contato com o lead. Responda EXCLUSIVAMENTE em JSON: {"mensagem": "texto"}.`;
  const userPrompt = `Nome/empresa do lead: "${company}". Gere a mensagem seguindo exatamente as instruções do sistema acima. Responda só em JSON: {"mensagem": "sua mensagem"}.`;
  const disparoOptions = { temperature: 0.9, top_p: 0.95 };
  try {
    const content = await callOpenAI(
      env,
      [
        { role: "system", content: basePrompt },
        { role: "user", content: userPrompt },
      ],
      disparoOptions,
    );
    const parsed = JSON.parse(content) as { mensagem?: string };
    return (parsed?.mensagem || content).trim() || defaultMsg;
  } catch {
    return defaultMsg;
  }
}

async function sendWhatsAppMessage(
  env: Env,
  tenantId: string,
  number: string,
  text: string,
  quotedKey?: { id: string; remoteJid: string; fromMe: boolean },
): Promise<{ ok: boolean; error?: string; remoteJid?: string }> {
  const baseUrl = getEvolutionBaseUrl(env);
  if (!baseUrl || !env.EVOLUTION_API_KEY) {
    return { ok: false, error: "Evolution API não configurada" };
  }
  const payload: Record<string, unknown> = { number, text };
  if (quotedKey) {
    payload.quoted = {
      key: { id: quotedKey.id },
      message: { conversation: text },
    };
  }
  console.log(`[sendText] payload → number:${number} text:"${String(text).substring(0, 60)}" hasQuoted:${!!quotedKey}`);
  try {
    const res = await fetch(`${baseUrl}/message/sendText/${tenantId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.EVOLUTION_API_KEY },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let errMsg = res.statusText;
      let existsFalse = false;
      try {
        const data = await res.json() as any;
        if (Array.isArray(data?.response?.message) && data.response.message[0]) {
          const m = data.response.message[0];
          errMsg = typeof m === "string" ? m : JSON.stringify(m);
        } else if (data?.exists === false) {
          existsFalse = true;
        }
        if (existsFalse || errMsg.includes("exists")) {
          errMsg = `number_not_found:${number}`;
        }
      } catch {
        // ignore
      }
      return { ok: false, error: errMsg };
    }
    // Capture the remoteJid from Evolution's response (may be @lid for privacy contacts)
    let remoteJid: string | undefined;
    try {
      const data = await res.json() as any;
      remoteJid = data?.key?.remoteJid || undefined;
    } catch { /* ignore */ }
    return { ok: true, remoteJid };
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
    "SELECT id, name, time_from, time_to, days_blocked, delay_min, delay_max, status FROM campaigns WHERE tenant_id = ? AND (status = 'active' OR status = 'completed')",
  )
    .bind(tenantId)
    .all<{ id: number; name: string; time_from: string; time_to: string; days_blocked: string; delay_min: number; delay_max: number; status: string }>();

  const list = (campaigns.results || []) as Array<{
    id: number;
    name: string;
    time_from: string;
    time_to: string;
    days_blocked: string;
    delay_min: number;
    delay_max: number;
    status: string;
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

    const delayMin = Math.max(0, Number(camp.delay_min) ?? 0);
    const delayMax = Math.max(delayMin, (Number(camp.delay_max) ?? delayMin ?? 5));
    const lastSent = await env.DB.prepare(
      "SELECT sent_at FROM campaign_sends WHERE campaign_id = ? AND status = 'sent' ORDER BY sent_at DESC LIMIT 1",
    )
      .bind(camp.id)
      .first<{ sent_at: string }>();
    if (lastSent?.sent_at && (delayMin > 0 || delayMax > 0)) {
      const last = new Date(lastSent.sent_at).getTime();
      const elapsedSec = (Date.now() - last) / 1000;
      const requiredSec = delayMin + Math.random() * (delayMax - delayMin);
      if (elapsedSec < requiredSec) continue;
    }

    const pendingCountCheck = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM leads l
       WHERE l.tenant_id = ? AND l.phone IS NOT NULL AND trim(l.phone) != ''
         AND NOT EXISTS (SELECT 1 FROM campaign_sends cs WHERE cs.campaign_id = ? AND cs.lead_id = l.id AND cs.status = 'sent')`,
    )
      .bind(tenantId, camp.id)
      .first<{ c: number }>();
    if (Number(pendingCountCheck?.c ?? 0) === 0) continue;

    if (camp.status === "completed") {
      await env.DB.prepare(
        "UPDATE campaigns SET status = 'active' WHERE id = ? AND tenant_id = ?",
      )
        .bind(camp.id, tenantId)
        .run();
    }

    const totalLeadsNow = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM leads WHERE tenant_id = ? AND phone IS NOT NULL AND trim(phone) != ''",
    )
      .bind(tenantId)
      .first<{ c: number }>();
    await env.DB.prepare(
      "UPDATE campaigns SET total_leads = ? WHERE id = ? AND tenant_id = ?",
    )
      .bind(Math.max(0, Number(totalLeadsNow?.c ?? 0)), camp.id, tenantId)
      .run();

    const limitPerRun = 5;
    const pending = await env.DB.prepare(
      `SELECT l.id, l.company, l.phone FROM leads l
       WHERE l.tenant_id = ?
         AND l.phone IS NOT NULL AND trim(l.phone) != ''
         AND NOT EXISTS (SELECT 1 FROM campaign_sends cs WHERE cs.campaign_id = ? AND cs.lead_id = l.id AND cs.status = 'sent')
       ORDER BY l.id ASC LIMIT ?`,
    )
      .bind(tenantId, camp.id, limitPerRun)
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
      // Se o Evolution retornou um @lid, armazena o mapeamento phone → lid
      if (result.ok && result.remoteJid?.endsWith("@lid")) {
        await storeLidMapping(env, tenantId, phone, result.remoteJid);
      }
      if (result.ok) {
        await env.DB.prepare(
          `INSERT INTO campaign_sends (campaign_id, lead_id, status) VALUES (?, ?, 'sent')
           ON CONFLICT(campaign_id, lead_id) DO UPDATE SET status = 'sent', sent_at = datetime('now'), error_message = NULL`,
        )
          .bind(camp.id, lead.id)
          .run();
        await env.DB.prepare(
          "UPDATE campaigns SET sent = sent + 1 WHERE id = ? AND tenant_id = ?",
        )
          .bind(camp.id, tenantId)
          .run();
        sent++;
        const isLastLead = rows.indexOf(lead) === rows.length - 1;
        if (!isLastLead && (delayMin > 0 || delayMax > 0)) {
          const waitSec = Math.min(delayMin + Math.random() * (delayMax - delayMin), 5);
          await new Promise((r) => setTimeout(r, Math.min(waitSec * 1000, 5000)));
        }
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

    const pendingCount = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM leads l
       WHERE l.tenant_id = ? AND l.phone IS NOT NULL AND trim(l.phone) != ''
         AND NOT EXISTS (SELECT 1 FROM campaign_sends cs WHERE cs.campaign_id = ? AND cs.lead_id = l.id AND cs.status = 'sent')`,
    )
      .bind(tenantId, camp.id)
      .first<{ c: number }>();
    if (Number(pendingCount?.c ?? 0) === 0) {
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

async function handleDashboardStats(request: Request, env: Env): Promise<Response> {
  const tenantId = await getTenantId(request, env);
  await ensureTenant(env, tenantId);

  const [leadsTotalRow, leadsWithPhoneRow, leadsByDayRows, campaignsRows, campaignsCountRow] =
    await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as c FROM leads WHERE tenant_id = ?").bind(tenantId).first<{ c: number }>(),
      env.DB.prepare(
        "SELECT COUNT(*) as c FROM leads WHERE tenant_id = ? AND phone IS NOT NULL AND trim(phone) != ''",
      )
        .bind(tenantId)
        .first<{ c: number }>(),
      env.DB.prepare(
        `SELECT date(created_at) as d, COUNT(*) as c FROM leads
         WHERE tenant_id = ? AND created_at >= date('now', '-7 days')
         GROUP BY date(created_at) ORDER BY d ASC`,
      )
        .bind(tenantId)
        .all<{ d: string; c: number }>(),
      env.DB.prepare(
        "SELECT id, name, status, total_leads, sent, errors FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10",
      )
        .bind(tenantId)
        .all<{ id: number; name: string; status: string; total_leads: number; sent: number; errors: number }>(),
      env.DB.prepare("SELECT COUNT(*) as c FROM campaigns WHERE tenant_id = ?").bind(tenantId).first<{ c: number }>(),
    ]);

  const leadsTotal = Number(leadsTotalRow?.c ?? 0);
  const leadsWithPhone = Number(leadsWithPhoneRow?.c ?? 0);
  const campaigns = (campaignsRows?.results ?? []) as Array<{
    id: number;
    name: string;
    status: string;
    total_leads: number;
    sent: number;
    errors: number;
  }>;
  const campaignsActive = campaigns.filter((c) => c.status === "active").length;
  const campaignsTotal = Number(campaignsCountRow?.c ?? 0);
  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalErrors = campaigns.reduce((s, c) => s + c.errors, 0);

  const now = new Date();
  const last7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = (leadsByDayRows?.results ?? []).find((r: { d: string; c: number }) => r.d === dateStr);
    last7Days.push({ date: dateStr, count: found ? Number(found.c) : 0 });
  }

  return json({
    leadsTotal,
    leadsWithPhone,
    leadsLast7Days: last7Days,
    campaigns,
    campaignsActive,
    campaignsTotal,
    totalSent,
    totalErrors,
  });
}

async function handleCampaigns(request: Request, env: Env, method: string, url: URL) {
  const tenantId = await getTenantId(request, env);
  await ensureTenant(env, tenantId);
  const pathname = url.pathname;
  const parts = pathname.split("/").filter(Boolean);
  const idParam = parts.length >= 3 ? parts[2] : null;
  const isSingle = idParam && /^\d+$/.test(idParam);
  const campaignId = isSingle ? Number(idParam) : null;

  if (method === "POST" && parts[2] === "run") {
    const ignoreWindow = url.searchParams.get("ignoreWindow") === "1";
    try {
      return await handleCampaignRun(env, tenantId, ignoreWindow);
    } catch (err: any) {
      const msg = err?.message || String(err);
      return json(
        { ok: false, processed: 0, campaigns: [], errorSummary: [msg] },
        { status: 200 },
      );
    }
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

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return json({ error: "Nome obrigatório" }, { status: 400 });
    }
    const resolvedDelayMin = Number(delay_min ?? 6);
    const resolvedDelayMax = Number(delay_max ?? 15);
    const resolvedTimeFrom = String(time_from ?? "09:00");
    const resolvedTimeTo = String(time_to ?? "18:00");
    if (!Number.isFinite(resolvedDelayMin) || resolvedDelayMin < 0 || resolvedDelayMin > 1440) {
      return json({ error: "delay_min deve ser entre 0 e 1440" }, { status: 400 });
    }
    if (!Number.isFinite(resolvedDelayMax) || resolvedDelayMax < 0 || resolvedDelayMax > 1440) {
      return json({ error: "delay_max deve ser entre 0 e 1440" }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(resolvedTimeFrom)) {
      return json({ error: "time_from deve estar no formato HH:MM" }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(resolvedTimeTo)) {
      return json({ error: "time_to deve estar no formato HH:MM" }, { status: 400 });
    }

    const res = await env.DB.prepare(
      `INSERT INTO campaigns
       (tenant_id, name, delay_min, delay_max, time_from, time_to, days_blocked, funnel_id, crm_column_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        tenantId,
        name.trim(),
        resolvedDelayMin,
        resolvedDelayMax,
        resolvedTimeFrom,
        resolvedTimeTo,
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
  const tenantId = await getTenantId(request, env);
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
  const tenantId = await getTenantId(request, env);
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

      // Verify both resources belong to the current tenant (prevent IDOR)
      const leadOwned = await env.DB.prepare(
        "SELECT id FROM leads WHERE id = ? AND tenant_id = ? LIMIT 1",
      ).bind(body.lead_id, tenantId).first();
      if (!leadOwned) return json({ error: "Lead não encontrado" }, { status: 404 });

      const colOwned = await env.DB.prepare(
        "SELECT id FROM crm_columns WHERE id = ? AND tenant_id = ? LIMIT 1",
      ).bind(body.column_id, tenantId).first();
      if (!colOwned) return json({ error: "Coluna não encontrada" }, { status: 404 });

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
  const tenantId = await getTenantId(request, env);
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
    const fromExtractorTenant = tenantId;

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

// ─── Webhook Evolution API ────────────────────────────────────────────────────

function extractTextFromEvolutionPayload(data: any): string | null {
  // Evolution v2 pode entregar mensagem em data.data ou diretamente em data.message
  const msg = data?.data?.message || data?.message;
  if (!msg) return null;
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.stickerMessage?.caption ||
    null
  );
}

/** Normaliza nome de evento do Evolution: "MESSAGES_UPSERT" → "messages.upsert" */
function normalizeEvolutionEvent(event: string): string {
  return (event || "").toLowerCase().replace(/_/g, ".");
}

function normalizePhoneFromJid(jid: string): string {
  return (jid || "").split("@")[0]?.replace(/\D/g, "") || "";
}

/**
 * Retorna variantes do número brasileiro para cobrir casos com/sem o nono dígito.
 * Ex: "5511999999999" → ["5511999999999", "551199999999"]
 *     "551199999999"  → ["551199999999",  "5511999999999"]
 */
function getBrazilPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(digits);
  if (digits.length === 13 && digits.startsWith("55")) {
    // remove o nono dígito (posição 4)
    variants.add(digits.slice(0, 4) + digits.slice(5));
  } else if (digits.length === 12 && digits.startsWith("55")) {
    // adiciona o nono dígito após o DDD (posição 4)
    variants.add(digits.slice(0, 4) + "9" + digits.slice(4));
  }
  return Array.from(variants);
}

async function isPhoneProspected(env: Env, tenantId: string, phone: string): Promise<boolean> {
  const variants = getBrazilPhoneVariants(phone);
  for (const v of variants) {
    const row = await env.DB.prepare(
      "SELECT id FROM leads WHERE tenant_id = ? AND phone = ? LIMIT 1",
    ).bind(tenantId, v).first();
    if (row) return true;
  }
  return false;
}

/**
 * Resolve um @lid do WhatsApp para o número de telefone real.
 * O @lid é um identificador de privacidade novo — capturado e armazenado quando enviamos mensagens.
 */
async function resolveLidToPhone(env: Env, tenantId: string, lid: string): Promise<string | null> {
  // Consulta mapeamento local armazenado ao enviar campanhas/mensagens
  const row = await env.DB.prepare(
    "SELECT phone FROM lid_mappings WHERE tenant_id = ? AND lid = ? LIMIT 1",
  ).bind(tenantId, lid).first<{ phone: string }>();
  if (row?.phone) return row.phone;
  return null;
}

/**
 * Armazena o mapeamento phone → lid quando o Evolution revela o @lid de um contato.
 */
async function storeLidMapping(env: Env, tenantId: string, phone: string, lid: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO lid_mappings (tenant_id, phone, lid)
     VALUES (?, ?, ?)
     ON CONFLICT(tenant_id, lid) DO UPDATE SET phone = excluded.phone, updated_at = datetime('now')`,
  ).bind(tenantId, phone, lid).run();
}

async function getAgentPause(
  env: Env,
  tenantId: string,
  phone: string,
): Promise<{ paused: boolean; definitive: boolean }> {
  const row = await env.DB.prepare(
    "SELECT paused_until, pause_definitive FROM agent_pauses WHERE tenant_id = ? AND phone = ? LIMIT 1",
  ).bind(tenantId, phone).first<{ paused_until: string | null; pause_definitive: number }>();

  if (!row) return { paused: false, definitive: false };
  if (row.pause_definitive) return { paused: true, definitive: true };
  if (row.paused_until && new Date(row.paused_until) > new Date()) {
    return { paused: true, definitive: false };
  }
  // Pause expired — clean up
  await env.DB.prepare("DELETE FROM agent_pauses WHERE tenant_id = ? AND phone = ?")
    .bind(tenantId, phone).run();
  return { paused: false, definitive: false };
}

async function setPause(
  env: Env,
  tenantId: string,
  phone: string,
  pauseMinutes: number,
  definitive: boolean,
): Promise<void> {
  const pausedUntil = definitive
    ? null
    : new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO agent_pauses (tenant_id, phone, paused_until, pause_definitive)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(tenant_id, phone) DO UPDATE SET
       paused_until = excluded.paused_until,
       pause_definitive = excluded.pause_definitive,
       created_at = datetime('now')`,
  ).bind(tenantId, phone, pausedUntil, definitive ? 1 : 0).run();
}

async function getConversationHistory(
  env: Env,
  tenantId: string,
  phone: string,
  limit = 20,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const res = await env.DB.prepare(
    `SELECT role, content FROM agent_conversations
     WHERE tenant_id = ? AND phone = ?
     ORDER BY created_at DESC LIMIT ?`,
  ).bind(tenantId, phone, limit).all<{ role: string; content: string }>();
  return ((res.results || []) as Array<{ role: string; content: string }>)
    .reverse()
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

async function appendConversation(
  env: Env,
  tenantId: string,
  phone: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO agent_conversations (tenant_id, phone, role, content) VALUES (?, ?, ?, ?)",
  ).bind(tenantId, phone, role, content).run();
}

function resolvePromptDefaults(
  prompt: string,
  agentRow: { agenda_link?: string | null; human_number?: string | null; human_group_id?: string | null },
): string {
  return prompt
    .replace(/\{\{agenda\}\}/g, agentRow.agenda_link || "[link da agenda não configurado]")
    .replace(/\{\{numero_humano\}\}/g, agentRow.human_number || "[número humano não configurado]")
    .replace(/\{\{grupo_humano\}\}/g, agentRow.human_group_id || "[grupo não configurado]");
}

interface MessageSegment {
  type: "text" | "image" | "video" | "audio";
  content: string;
  caption?: string;
}

async function parseResponseSegments(
  env: Env,
  tenantId: string,
  response: string,
): Promise<MessageSegment[]> {
  const segments: MessageSegment[] = [];
  const parts = response.split(/({{media:[^}]+}})/g);
  for (const part of parts) {
    const mediaMatch = part.match(/^{{media:([^}]+)}}$/);
    if (mediaMatch) {
      const mediaId = mediaMatch[1];
      const row = await env.DB.prepare(
        "SELECT media_type, url FROM agent_media WHERE tenant_id = ? AND media_id = ? LIMIT 1",
      ).bind(tenantId, mediaId).first<{ media_type: string; url: string }>();
      if (row) {
        const mt = row.media_type || "";
        let type: "image" | "video" | "audio" = "image";
        if (mt.startsWith("video/")) type = "video";
        else if (mt.startsWith("audio/")) type = "audio";
        segments.push({ type, content: row.url });
      }
    } else {
      const text = part.trim();
      if (text) segments.push({ type: "text", content: text });
    }
  }
  return segments;
}

async function sendWhatsAppMedia(
  env: Env,
  tenantId: string,
  number: string,
  mediaUrl: string,
  mediaType: "image" | "video" | "audio",
  caption?: string,
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = getEvolutionBaseUrl(env);
  if (!baseUrl || !env.EVOLUTION_API_KEY) {
    return { ok: false, error: "Evolution API não configurada" };
  }
  try {
    let endpoint: string;
    let body: Record<string, unknown>;
    if (mediaType === "audio") {
      endpoint = `${baseUrl}/message/sendWhatsAppAudio/${tenantId}`;
      body = { number, audio: mediaUrl };
    } else {
      endpoint = `${baseUrl}/message/sendMedia/${tenantId}`;
      body = { number, mediatype: mediaType, media: mediaUrl, caption: caption || "" };
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.EVOLUTION_API_KEY },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errMsg = res.statusText;
      try {
        const data = await res.json();
        if (Array.isArray((data as any)?.response?.message) && (data as any).response.message[0])
          errMsg = (data as any).response.message[0];
      } catch { /* ignore */ }
      return { ok: false, error: errMsg };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro de rede" };
  }
}

async function handleEvolutionWebhook(request: Request, env: Env): Promise<Response> {
  let data: any;
  try {
    data = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, { status: 400 });
  }

  // Instance name = tenantId in this system
  const tenantId: string = data?.instance || "";
  if (!tenantId) return json({ ok: true });

  const event: string = normalizeEvolutionEvent(data?.event || "");

  // Atualiza status de conexão em tempo real quando Evolution notifica mudança
  if (event === "connection.update") {
    const state: string = data?.data?.state || data?.data?.instance?.state || "";
    const mappedStatus = state === "open" ? "connected" : "disconnected";
    await env.DB.prepare(
      `INSERT INTO connections (tenant_id, type, status, agent_enabled, reply_all)
       VALUES (?, 'whatsapp', ?, 0, 0)
       ON CONFLICT(tenant_id, type) DO UPDATE SET
         status = excluded.status,
         updated_at = datetime('now')`,
    ).bind(tenantId, mappedStatus).run();
    return json({ ok: true });
  }

  // Só processa mensagens recebidas
  if (event !== "messages.upsert") return json({ ok: true });

  // fromMe: ignora mensagens enviadas por nós (campanhas, respostas do agente)
  const fromMe: boolean = !!(
    data?.data?.key?.fromMe ??
    data?.key?.fromMe
  );
  if (fromMe) {
    console.log("[webhook] fromMe=true — ignorando. jid:", data?.data?.key?.remoteJid || data?.key?.remoteJid);
    return json({ ok: true });
  }

  const remoteJid: string = data?.data?.key?.remoteJid || data?.key?.remoteJid || "";
  if (!remoteJid || remoteJid.endsWith("@g.us")) return json({ ok: true }); // ignore groups

  // Captura a key da mensagem original para uso no reply (garante roteamento correto ao @lid)
  const incomingMsgId: string = data?.data?.key?.id || data?.key?.id || "";
  const incomingMsgKey = incomingMsgId
    ? { id: incomingMsgId, remoteJid, fromMe: false }
    : undefined;

  let phone = normalizePhoneFromJid(remoteJid);
  if (!phone) return json({ ok: true });

  const userText = extractTextFromEvolutionPayload(data);
  if (!userText) {
    console.log("[webhook] sem texto extraível — ignorando. event:", data?.event, "jid:", remoteJid);
    return json({ ok: true });
  }

  // @lid: formato de privacidade do WhatsApp — tenta resolver para número real
  const isLid = remoteJid.endsWith("@lid");
  if (isLid) {
    // 1. Tenta mapeamento local (lid_mappings)
    const resolved = await resolveLidToPhone(env, tenantId, remoteJid);
    if (resolved) {
      console.log(`[webhook] @lid ${remoteJid} resolvido via lid_mappings → phone:${resolved}`);
      phone = resolved;
    } else {
      // 2. Tenta achar o lead mais recente que recebeu disparo (campaign_sends mais recente)
      const leadRow = await env.DB.prepare(
        `SELECT l.phone FROM campaign_sends cs
         JOIN leads l ON l.id = cs.lead_id AND l.tenant_id = cs.tenant_id
         WHERE cs.tenant_id = ? AND cs.status = 'sent'
         ORDER BY cs.sent_at DESC LIMIT 1`,
      ).bind(tenantId).first<{ phone: string }>();
      if (leadRow?.phone) {
        const normalized = normalizeBrazilNumber(leadRow.phone);
        if (normalized) {
          console.log(`[webhook] @lid ${remoteJid} resolvido via último lead disparado → phone:${normalized}`);
          phone = normalized;
          await storeLidMapping(env, tenantId, normalized, remoteJid);
        }
      }
    }
  }

  console.log(`[webhook] mensagem recebida — tenant:${tenantId} phone:${phone} jid:${remoteJid} texto:"${userText}"`);

  // Load connection settings
  const conn = await env.DB.prepare(
    "SELECT agent_enabled, reply_all FROM connections WHERE tenant_id = ? AND type = 'whatsapp' LIMIT 1",
  ).bind(tenantId).first<{ agent_enabled: number; reply_all: number }>();

  if (!conn || !conn.agent_enabled) {
    console.log(`[webhook] agent_enabled=0 — ignorando. tenant:${tenantId}`);
    return json({ ok: true });
  }

  // Se não é reply_all, verifica se é lead — mas @lid bypass: não é possível identificar o número
  if (!conn.reply_all && !isLid) {
    const prospected = await isPhoneProspected(env, tenantId, phone);
    if (!prospected) {
      console.log(`[webhook] phone não é lead — ignorando. tenant:${tenantId} phone:${phone}`);
      return json({ ok: true });
    }
  }

  // Check if agent is paused for this phone
  const pause = await getAgentPause(env, tenantId, phone);
  if (pause.paused) {
    console.log(`[webhook] agente pausado para phone:${phone}`);
    return json({ ok: true });
  }

  // Load agent config
  const agent = await env.DB.prepare(
    "SELECT base_prompt, pause_minutes, pause_definitive, agenda_link, human_number, human_group_id FROM agents WHERE tenant_id = ? AND id = 'atendimento' LIMIT 1",
  ).bind(tenantId).first<{
    base_prompt?: string | null;
    pause_minutes?: number | null;
    pause_definitive?: number | null;
    agenda_link?: string | null;
    human_number?: string | null;
    human_group_id?: string | null;
  }>();

  const rawPrompt = agent?.base_prompt || "Você é um agente de atendimento. Responda de forma educada, clara e objetiva.";
  const systemPrompt = resolvePromptDefaults(rawPrompt, {
    agenda_link: agent?.agenda_link,
    human_number: agent?.human_number,
    human_group_id: agent?.human_group_id,
  });

  // Load conversation history
  const history = await getConversationHistory(env, tenantId, phone, 20);

  // Save user message
  await appendConversation(env, tenantId, phone, "user", userText);

  // Call OpenAI
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userText },
  ];

  if (!env.OPENAI_API_KEY) {
    console.error("[webhook] OPENAI_API_KEY não configurado — agente não pode responder");
    return json({ ok: true });
  }

  let aiResponse: string;
  try {
    aiResponse = await callOpenAI(env, messages);
  } catch (err: any) {
    console.error("[webhook] OpenAI error para phone", phone, ":", err?.message);
    return json({ ok: true });
  }

  // Save assistant response
  await appendConversation(env, tenantId, phone, "assistant", aiResponse);

  // Parse response segments (text + media tokens)
  const segments = await parseResponseSegments(env, tenantId, aiResponse);

  // Send each segment via WhatsApp
  // Para @lid: tenta enviar direto ao @lid JID com quoted (forçar Baileys a usar rota @lid)
  // Se falhar (exists:false), cai para phone sem quoted
  const sendNumber = isLid ? remoteJid : phone;
  const sendQuotedKey = incomingMsgKey;
  console.log(`[webhook] enviando ${segments.length} segmento(s) para ${sendNumber} (isLid:${isLid} quoted:${!!sendQuotedKey}). tipos:`, segments.map(s => `${s.type}(${s.content.substring(0,30)})`).join(", "));
  for (const seg of segments) {
    let sendResult: { ok: boolean; error?: string; remoteJid?: string };
    if (seg.type === "text") {
      sendResult = await sendWhatsAppMessage(env, tenantId, sendNumber, seg.content, sendQuotedKey);
      // Se @lid rejeitado (exists:false), tenta fallback com full JID @s.whatsapp.net
      if (!sendResult.ok && isLid && String(sendResult.error ?? "").includes("number_not_found")) {
        // Tenta JID completo para bypassar normalização do Evolution (pode evitar rota @lid interna)
        const fullJid = `${phone}@s.whatsapp.net`;
        console.log(`[webhook] @lid rejeitado, fallback full-JID: ${fullJid}`);
        sendResult = await sendWhatsAppMessage(env, tenantId, fullJid, seg.content, undefined);
        if (!sendResult.ok) {
          console.log(`[webhook] full-JID também falhou, fallback phone:${phone}`);
          sendResult = await sendWhatsAppMessage(env, tenantId, phone, seg.content, undefined);
        }
      }
    } else {
      sendResult = await sendWhatsAppMedia(env, tenantId, phone, seg.content, seg.type, seg.caption);
    }
    if (!sendResult.ok) {
      console.error(`[webhook] falha ao enviar seg ${seg.type} para ${phone}:`, sendResult.error);
    } else {
      console.log(`[webhook] segmento ${seg.type} enviado ok. remoteJid retornado:${sendResult.remoteJid || 'N/A'}`);
      if (sendResult.remoteJid?.endsWith("@lid") && !isLid) {
        await storeLidMapping(env, tenantId, phone, sendResult.remoteJid);
      }
    }
  }

  // Pausa apenas se o agente transferiu para humano:
  // detecta se a resposta menciona o número humano ou grupo humano configurados
  const pauseMinutes = Number(agent?.pause_minutes ?? 0);
  const pauseDefinitive = !!agent?.pause_definitive;
  const humanNumber = agent?.human_number || "";
  const humanGroup = agent?.human_group_id || "";
  const mentionedHuman =
    (humanNumber && aiResponse.includes(humanNumber)) ||
    (humanGroup && aiResponse.includes(humanGroup));

  if (mentionedHuman && (pauseMinutes > 0 || pauseDefinitive)) {
    await setPause(env, tenantId, phone, pauseMinutes, pauseDefinitive);
  }

  return json({ ok: true });
}

// ─── End Webhook ──────────────────────────────────────────────────────────────

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

    const allowedOrigins = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const allowOrigin = allowedOrigins.includes(origin) ? origin : null;
    if (method === "OPTIONS") {
      const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key, x-tenant-id, x-extension-token",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      };
      if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
      return new Response(null, { status: 204, headers });
    }

    let response: Response;

    try {
      if (pathname === "/api/admin/login" && method === "POST") {
        response = await handleAdminLogin(request, env);
      } else if (pathname === "/api/admin/create-tenant-user" && method === "POST") {
        response = await handleAdminCreateTenantUser(request, env);
      } else if (pathname === "/api/admin/users" && method === "GET") {
        response = await handleAdminListUsers(request, env);
      } else if (pathname === "/api/admin/users" && method === "DELETE") {
        response = await handleAdminDeleteUser(request, env, urlForRouting);
      } else if (pathname === "/api/auth/login" && method === "POST") {
        response = await handleClientLogin(request, env);
      } else if (pathname === "/api/dashboard/stats" && method === "GET") {
        response = await handleDashboardStats(request, env);
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
      } else if (pathname === "/api/webhook/evolution" && method === "POST") {
        response = await handleEvolutionWebhook(request, env);
      } else {
        response = notFound();
      }
    } catch (err: any) {
      console.error("[worker] internal error", err?.message || err);
      response = json({ error: "Internal error" }, { status: 500 });
    }

    const headers = new Headers(response.headers);
    if (allowOrigin) headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key, x-tenant-id, x-extension-token");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const tenants = await env.DB.prepare("SELECT id FROM tenants").all<{ id: string }>();
    const list = (tenants.results || []) as Array<{ id: string }>;
    for (const row of list) {
      try {
        await handleCampaignRun(env, row.id, false);
      } catch (err) {
        console.error("[cron] campaign run for tenant", row.id, err);
          }
    }
  },
} satisfies ExportedHandler<Env>;

