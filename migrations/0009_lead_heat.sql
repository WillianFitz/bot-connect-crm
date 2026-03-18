-- Add heat scoring columns to leads table
ALTER TABLE leads ADD COLUMN heat_score INTEGER DEFAULT NULL;
ALTER TABLE leads ADD COLUMN heat_label TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN heat_summary TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN heat_signals TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN heat_analyzed_at TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_heat ON leads (tenant_id, heat_score);
