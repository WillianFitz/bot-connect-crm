-- Esquema D1 para o bot-connect-crm

PRAGMA foreign_keys = ON;

-- Tabela de empresas (tenants)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,           -- ex.: 'tenant_123'
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Conexões por tenant (ex.: WhatsApp)
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'whatsapp'
  status TEXT NOT NULL DEFAULT 'disconnected', -- 'connected' | 'disconnected'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  agent_enabled INTEGER NOT NULL DEFAULT 0,
  reply_all INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_tenant_type ON connections(tenant_id, type);

-- Pastas de leads por tenant
CREATE TABLE IF NOT EXISTS lead_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lead_folders_tenant ON lead_folders(tenant_id);

-- Leads por tenant
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  folder_id INTEGER REFERENCES lead_folders(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_folder ON leads(folder_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);

-- Agentes de IA por tenant
CREATE TABLE IF NOT EXISTS agents (
  id TEXT NOT NULL, -- 'disparo' | 'atendimento' | 'agendamento'
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  base_prompt TEXT NOT NULL,
  default_message TEXT,
  pause_minutes INTEGER NOT NULL DEFAULT 0,
  pause_definitive INTEGER NOT NULL DEFAULT 0,
  agenda_link TEXT,
  human_number TEXT,
  human_group_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);

-- Ferramentas / extratores por tenant
CREATE TABLE IF NOT EXISTS tools_extractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'maps' | 'instagram' | 'cnpj' | 'whatsapp_groups'
  name TEXT NOT NULL,
  config_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tools_extractors_tenant ON tools_extractors(tenant_id);

-- Colunas do CRM por tenant
CREATE TABLE IF NOT EXISTS crm_columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crm_columns_tenant ON crm_columns(tenant_id);

-- Leads no quadro Kanban do CRM por tenant
CREATE TABLE IF NOT EXISTS crm_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  column_id INTEGER NOT NULL REFERENCES crm_columns(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_column ON crm_leads(column_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant ON crm_leads(tenant_id);

-- Campanhas (disparos) por tenant
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  delay_min INTEGER NOT NULL,
  delay_max INTEGER NOT NULL,
  time_from TEXT NOT NULL,
  time_to TEXT NOT NULL,
  days_blocked TEXT NOT NULL, -- JSON array de dias desativados
  funnel_id INTEGER,          -- futuro uso
  crm_column_id INTEGER,      -- coluna destino no CRM
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'paused' | 'completed'
  total_leads INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  no_whatsapp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);

-- Controle de envios por campanha (evita reenviar ao mesmo lead)
CREATE TABLE IF NOT EXISTS campaign_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  UNIQUE (campaign_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends(campaign_id);

-- Configurações por tenant (ex.: número para notificação de campanhas)
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);

-- Usuários (login) por tenant
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  document TEXT NOT NULL, -- CPF ou CNPJ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Rate limiting de login (key = login:username:ip)
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jobs de extração do Instagram por tenant
CREATE TABLE IF NOT EXISTS instagram_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | error
  total_leads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_instagram_jobs_tenant ON instagram_jobs(tenant_id);

