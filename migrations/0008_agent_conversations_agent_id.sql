-- Add agent_id to agent_conversations to separate memory per agent type
ALTER TABLE agent_conversations ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'atendimento';
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent ON agent_conversations (tenant_id, agent_id, phone);
