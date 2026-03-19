-- Controla quais conversas foram descartadas do inbox
-- Uma conversa descartada reaparece se chegar mensagem mais nova que dismissed_at
CREATE TABLE IF NOT EXISTS inbox_dismissed (
  tenant_id   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, phone)
);
