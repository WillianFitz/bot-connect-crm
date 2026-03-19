-- Inbox de atendimento humano: rastreia conversas transferidas do bot para humano
CREATE TABLE IF NOT EXISTS human_handoffs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       TEXT    NOT NULL,
  phone           TEXT    NOT NULL,
  contact_name    TEXT,
  status          TEXT    NOT NULL DEFAULT 'pending', -- pending | active | resolved
  trigger_reason  TEXT    NOT NULL DEFAULT 'user_request', -- user_request | ai_request | manual
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  resolved_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_handoffs_lookup
  ON human_handoffs (tenant_id, status, phone);

CREATE INDEX IF NOT EXISTS idx_handoffs_open
  ON human_handoffs (tenant_id, status);
