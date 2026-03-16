-- Histórico de conversa por lead/telefone (contexto para a IA)
CREATE TABLE IF NOT EXISTS agent_conversations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conv_tenant_phone ON agent_conversations(tenant_id, phone);

-- Estado de pausa do agente por lead/telefone
CREATE TABLE IF NOT EXISTS agent_pauses (
  tenant_id         TEXT NOT NULL,
  phone             TEXT NOT NULL,
  paused_until      TEXT,        -- NULL quando pause_definitive = 1
  pause_definitive  INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, phone)
);
