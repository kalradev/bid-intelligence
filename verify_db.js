const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'Backend', 'data', 'cache.db');
console.log('Checking database at:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });
    const count = db.prepare('SELECT COUNT(*) as count FROM file_cache').get().count;
    console.log(`Total records in file_cache: ${count}`);
    
    if (count > 0) {
        const records = db.prepare('SELECT original_filename, created_at FROM file_cache ORDER BY created_at DESC LIMIT 5').all();
        console.log('\nLast 5 records:');
        records.forEach(r => {
            console.log(`- ${r.original_filename} (cached at: ${r.created_at})`);
        });
    }
} catch (error) {
    console.error('Error checking database:', error.message);
}
