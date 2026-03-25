-- Índices compostos para queries frequentes que não tinham cobertura otimizada

-- leads(tenant_id, phone): usado em isPhoneProspected, bot webhook, campanha dedup
CREATE INDEX IF NOT EXISTS idx_leads_tenant_phone ON leads(tenant_id, phone);

-- campaigns(tenant_id, status): usado em handleCampaignRun (WHERE tenant_id=? AND status IN (...))
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON campaigns(tenant_id, status);

-- agent_pauses(tenant_id, phone): usado em checkBotPause a cada mensagem recebida
CREATE INDEX IF NOT EXISTS idx_agent_pauses_lookup ON agent_pauses(tenant_id, phone);
