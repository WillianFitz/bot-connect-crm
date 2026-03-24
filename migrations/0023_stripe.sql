-- Campos Stripe nos tenants
ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN stripe_price_id TEXT;
ALTER TABLE tenants ADD COLUMN subscription_status TEXT DEFAULT 'inactive';
-- subscription_status: inactive | trialing | active | past_due | canceled
