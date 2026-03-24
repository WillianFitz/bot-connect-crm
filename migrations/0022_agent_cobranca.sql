-- Renomeia agente de agendamento para cobranca
UPDATE agents SET id = 'cobranca' WHERE id = 'agendamento';
