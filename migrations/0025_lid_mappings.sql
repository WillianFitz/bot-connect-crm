-- Mapeamento permanente phone → LID do WhatsApp para roteamento de mensagens
CREATE TABLE IF NOT EXISTS lid_mappings (
  tenant_id  TEXT NOT NULL,
  phone      TEXT NOT NULL,
  lid        TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, lid),
  UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_lid_mappings_tenant_phone ON lid_mappings(tenant_id, phone);
