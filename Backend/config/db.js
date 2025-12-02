const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const dbPath = path.join(dataDir, 'cache.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create file_cache table
db.exec(`
    CREATE TABLE IF NOT EXISTS file_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_hash TEXT NOT NULL,
        processing_version INTEGER NOT NULL DEFAULT 1,
        original_filename TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        departmental_summaries TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(file_hash, processing_version)
    );

    CREATE INDEX IF NOT EXISTS idx_file_hash_version ON file_cache(file_hash, processing_version);
`);

console.log(`✅ Database initialized at: ${dbPath}`);

module.exports = db;
