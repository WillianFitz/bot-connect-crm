-- Permite filtrar leads por pasta em uma campanha
ALTER TABLE campaigns ADD COLUMN folder_id INTEGER REFERENCES lead_folders(id) ON DELETE SET NULL;
