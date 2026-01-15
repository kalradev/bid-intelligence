const { Pool } = require('pg');
const envConfig = require('./env.config');

// Create PostgreSQL connection pool
const pool = new Pool({
    host: envConfig.DB_HOST || 'localhost',
    port: parseInt(envConfig.DB_PORT || '5432'),
    database: envConfig.DB_NAME || 'bid_intelligence', // Use exact database name as specified
    user: envConfig.DB_USER || 'postgres',
    password: envConfig.DB_PASSWORD || '',
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
    console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client', err);
    // Don't exit process - let the application handle it
    // process.exit(-1);
});

// Initialize database tables
async function initDatabase() {
    try {
        const client = await pool.connect();
        
        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'bid_manager',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create index on email for faster lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);

        console.log('✅ Users table initialized in PostgreSQL');
        client.release();
    } catch (error) {
        console.error('❌ Error initializing PostgreSQL database:', error);
        throw error;
    }
}

// Initialize on module load if USE_POSTGRES is true
if (envConfig.USE_POSTGRES === 'true' || envConfig.USE_POSTGRES === true) {
    initDatabase().catch(err => {
        console.error('Failed to initialize database:', err);
    });
}

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    initDatabase
};

