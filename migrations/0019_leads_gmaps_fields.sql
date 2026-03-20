-- Adiciona campos extras aos leads (usados pelo extrator Google Maps)
ALTER TABLE leads ADD COLUMN website TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN notes TEXT DEFAULT NULL;
