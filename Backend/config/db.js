const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Check if PostgreSQL should be used
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

let db;

if (USE_POSTGRES) {
    // Use PostgreSQL
    const { query } = require('./postgres');
    
    // Create a database interface that matches SQLite's API
    db = {
        query: query,
        prepare: (sql) => {
            // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
            let paramIndex = 0;
            const pgSql = sql.replace(/\?/g, () => {
                paramIndex++;
                return `$${paramIndex}`;
            });
            
            return {
                get: async (...params) => {
                    const result = await query(pgSql, params);
                    return result.rows[0] || null;
                },
                run: async (...params) => {
                    const result = await query(pgSql, params);
                    return {
                        lastInsertRowid: result.rows[0]?.id || null,
                        changes: result.rowCount || 0
                    };
                },
                all: async (...params) => {
                    const result = await query(pgSql, params);
                    return result.rows;
                }
            };
        },
        exec: async (sql) => {
            // Split multiple statements and execute
            const statements = sql.split(';').filter(s => s.trim());
            for (const stmt of statements) {
                if (stmt.trim()) {
                    await query(stmt.trim());
                }
            }
        }
    };
    
    console.log('✅ Using PostgreSQL database');
} else {
    // Use SQLite (default)
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'cache.db');
    db = new Database(dbPath);

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

    console.log(`✅ SQLite database initialized at: ${dbPath}`);
}

module.exports = db;
