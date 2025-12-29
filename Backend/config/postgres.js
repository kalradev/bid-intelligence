const { Pool } = require('pg');
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
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
    console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
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
};

