-- Mapeia LID do WhatsApp para número de telefone
-- LID é o identificador interno que o WhatsApp usa em contas multi-device
-- Os eventos presence.update chegam com o LID enquanto mensagens chegam com o phone
CREATE TABLE IF NOT EXISTS contact_jid_map (
  tenant_id TEXT NOT NULL,
  lid       TEXT NOT NULL,  -- ex: "253828372951115" (de 253828372951115@lid)
  phone     TEXT NOT NULL,  -- ex: "554691209988"
  PRIMARY KEY (tenant_id, lid)
);
