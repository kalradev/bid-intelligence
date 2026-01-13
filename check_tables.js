const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'cache.db');
const db = new Database(dbPath);

try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', tables);
} catch (err) {
    console.error(err);
} finally {
    db.close();
}
