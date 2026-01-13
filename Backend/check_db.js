const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'cache.db');
const db = new Database(dbPath);

try {
    const rows = db.prepare('SELECT id, tender_id, corrigendum_number, original_filename, created_at FROM file_cache ORDER BY created_at DESC LIMIT 10').all();
    console.log(JSON.stringify(rows, null, 2));
} catch (err) {
    console.error(err);
} finally {
    db.close();
}
