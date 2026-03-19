-- Message debounce buffer: groups rapid successive messages before AI processing
CREATE TABLE IF NOT EXISTS whatsapp_buffer (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id        TEXT    NOT NULL,
  phone            TEXT    NOT NULL,
  message          TEXT    NOT NULL,
  received_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  processed        INTEGER NOT NULL DEFAULT 0,
  processor_claimed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_buffer_lookup
  ON whatsapp_buffer (tenant_id, phone, processed, processor_claimed);
