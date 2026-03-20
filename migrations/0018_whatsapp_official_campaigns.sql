-- Adiciona suporte à API Oficial do WhatsApp nos disparos
ALTER TABLE campaigns ADD COLUMN api_source TEXT NOT NULL DEFAULT 'evolution';
ALTER TABLE campaigns ADD COLUMN template_id INTEGER REFERENCES whatsapp_templates(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN template_variables TEXT;
