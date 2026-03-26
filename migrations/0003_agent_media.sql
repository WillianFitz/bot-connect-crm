-- Mídias do agente de atendimento por tenant
CREATE TABLE IF NOT EXISTS agent_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,       -- slug usado como token: {{media:media_id}}
  file_name TEXT NOT NULL,      -- nome original do arquivo
  media_type TEXT NOT NULL,     -- MIME type (image/jpeg, video/mp4, audio/mpeg, etc.)
  url TEXT NOT NULL,            -- URL pública da mídia (R2)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_media_tenant ON agent_media(tenant_id);
