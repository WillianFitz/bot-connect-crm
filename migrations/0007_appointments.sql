CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'meeting',
  status TEXT NOT NULL DEFAULT 'pending',
  reminder_minutes INTEGER DEFAULT 30,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id, scheduled_at);

ALTER TABLE campaigns ADD COLUMN scheduled_at TEXT;
ALTER TABLE campaigns ADD COLUMN scheduled_dispatched INTEGER NOT NULL DEFAULT 0;
