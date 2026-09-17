-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT,
    tax_rate REAL DEFAULT 24,
    year_end INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    entry_date TEXT,
    description TEXT,
    lines_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

-- Create index for quick lookup by client
CREATE INDEX IF NOT EXISTS idx_journal_entries_client ON journal_entries(client_id);
