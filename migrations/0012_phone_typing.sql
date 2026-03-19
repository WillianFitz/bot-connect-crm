-- Tracks "typing..." presence indicators per phone for smart message debounce
CREATE TABLE IF NOT EXISTS phone_typing (
  tenant_id     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  last_typing_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, phone)
);
