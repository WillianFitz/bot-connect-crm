-- Adiciona plano e status de bloqueio aos tenants
ALTER TABLE tenants ADD COLUMN plan TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE tenants ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0;
