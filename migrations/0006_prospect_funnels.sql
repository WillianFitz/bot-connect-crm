CREATE TABLE IF NOT EXISTS prospect_funnels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prospect_funnels_tenant ON prospect_funnels(tenant_id);

CREATE TABLE IF NOT EXISTS funnel_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funnel_id INTEGER NOT NULL REFERENCES prospect_funnels(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  wait_seconds INTEGER DEFAULT 60,
  caption TEXT
);
CREATE INDEX IF NOT EXISTS idx_funnel_steps_funnel ON funnel_steps(funnel_id);

CREATE TABLE IF NOT EXISTS funnel_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funnel_id INTEGER NOT NULL REFERENCES prospect_funnels(id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  next_execute_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(funnel_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_funnel_exec_pending ON funnel_executions(tenant_id, status, next_execute_at);

ALTER TABLE campaigns ADD COLUMN funnel_id INTEGER REFERENCES prospect_funnels(id) ON DELETE SET NULL;
