const { Pool } = require('pg');
<<<<<<< HEAD
require('dotenv').config();

// Debug: Log connection details
console.log('🔍 PostgreSQL Connection Config:');
console.log('   Host:', process.env.DB_HOST || 'localhost');
console.log('   Port:', process.env.DB_PORT || 5432);
console.log('   Database:', process.env.DB_NAME || 'Bid ');
console.log('   User:', process.env.DB_USER || 'postgres');
console.log('   Password:', process.env.DB_PASSWORD ? '***' : 'NOT SET');

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'Bid ',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345',
=======
const envConfig = require('./env.config');

// Create PostgreSQL connection pool
const pool = new Pool({
    host: envConfig.DB_HOST || 'localhost',
    port: parseInt(envConfig.DB_PORT || '5432'),
    database: envConfig.DB_NAME || 'bid_intelligence', // Use exact database name as specified
    user: envConfig.DB_USER || 'postgres',
    password: envConfig.DB_PASSWORD || '',
>>>>>>> convert
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

<<<<<<< HEAD
// Test connection on startup
=======
// Test connection
>>>>>>> convert
pool.on('connect', () => {
    console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
<<<<<<< HEAD
    console.error('❌ PostgreSQL connection error:', err);
});

// Test connection - delay to ensure env vars are loaded
setTimeout(() => {
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('❌ PostgreSQL connection test failed:', err.message);
            console.error('   Attempted Database:', process.env.DB_NAME);
            console.error('   Host:', process.env.DB_HOST);
            console.error('   User:', process.env.DB_USER);
        } else {
            console.log('✅ PostgreSQL connection successful');
            console.log('   Connected to Database:', process.env.DB_NAME);
        }
    });
}, 100); // Small delay to ensure env vars are loaded

// Export query function for easy use
const query = (text, params) => {
    return pool.query(text, params);
};

module.exports = {
    pool,
    query
=======
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
>>>>>>> convert
};

