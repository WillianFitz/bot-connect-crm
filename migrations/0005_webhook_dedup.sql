-- Deduplicação de webhooks: evita processar o mesmo evento duas vezes
CREATE TABLE IF NOT EXISTS webhook_dedup (
  tenant_id  TEXT NOT NULL,
  message_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, message_id)
);
