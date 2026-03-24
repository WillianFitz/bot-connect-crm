-- Tipo de campanha: prospecting | billing
ALTER TABLE campaigns ADD COLUMN campaign_type TEXT NOT NULL DEFAULT 'prospecting';
ALTER TABLE campaigns ADD COLUMN payment_link TEXT;
