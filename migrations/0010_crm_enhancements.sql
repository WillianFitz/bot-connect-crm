-- CRM enhancements: rich lead metadata + column customization
ALTER TABLE crm_leads ADD COLUMN tags TEXT;         -- JSON array of strings
ALTER TABLE crm_leads ADD COLUMN deal_value REAL;   -- monetary value of the deal
ALTER TABLE crm_leads ADD COLUMN notes TEXT;        -- free-form notes
ALTER TABLE crm_leads ADD COLUMN assignee TEXT;     -- responsible person name
ALTER TABLE crm_leads ADD COLUMN moved_at TEXT DEFAULT (datetime('now')); -- when lead last changed column

ALTER TABLE crm_columns ADD COLUMN color TEXT DEFAULT '#6366f1'; -- hex color for the column
ALTER TABLE crm_columns ADD COLUMN wip_limit INTEGER;             -- max leads allowed (null = no limit)

CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_column ON crm_leads (tenant_id, column_id);
