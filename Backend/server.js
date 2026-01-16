// Load environment variables from config file (bypasses .env issues)
console.log('🔧 Loading environment from config/env.config.js...');
const envConfig = require('./config/env.config');

// Set environment variables
Object.keys(envConfig).forEach(key => {
    if (!process.env[key]) {
        process.env[key] = envConfig[key];
    }
});

console.log('✅ Environment loaded from config file');
console.log('📦 Variables loaded:', Object.keys(envConfig).length);
const express = require('express');
const cors = require('cors');
const rfpRoutes = require('./routes/rfpRoutes');
const exactReferenceRoutes = require('./routes/exactReferenceRoutes');
<<<<<<< HEAD
=======
const authRoutes = require('./routes/authRoutes');
>>>>>>> convert
const errorHandler = require('./middleware/errorHandler');

// Initialize PostgreSQL connection if enabled
if (envConfig.USE_POSTGRES === 'true' || envConfig.USE_POSTGRES === true) {
    const { initDatabase } = require('./config/postgres');
    initDatabase().catch(err => {
        console.error('⚠️ PostgreSQL initialization failed:', err.message);
        console.log('   Continuing with in-memory storage...');
    });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/rfp', rfpRoutes);
app.use('/api/reference', exactReferenceRoutes);
<<<<<<< HEAD
=======
app.use('/api/auth', authRoutes);

// Log registered routes
console.log('✅ Routes registered:');
console.log('   - /api/rfp');
console.log('   - /api/reference');
console.log('   - /api/auth (login, register, me, logout)');

// Test endpoint to verify auth routes are working
app.get('/api/auth/test', (req, res) => {
    res.json({
        success: true,
        message: 'Auth routes are working!',
        endpoints: {
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            me: 'GET /api/auth/me',
            logout: 'POST /api/auth/logout'
        }
    });
});
>>>>>>> convert

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Bid Intelligence.ai - RFP Analysis API',
        version: '1.0.0',
        endpoints: {
            analyze: 'POST /api/rfp/analyze',
            health: 'GET /api/rfp/health'
        }
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\n🔑 API Key Status:`);
    console.log(`   OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    
    // Debug: Show what dotenv loaded
    console.log(`\n📋 Environment Variables Loaded:`);
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Present (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'MISSING'}`);
    console.log(`   PORT: ${process.env.PORT}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   MAX_FILE_SIZE_MB: ${process.env.MAX_FILE_SIZE_MB}`);
});

module.exports = app;

// Global Error Handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
    console.error('❌ FATAL: Uncaught Exception:', err);
    // Keep process alive for a moment to flush logs if needed, but usually we should exit.
    // In dev, maybe we can keep it alive, but it's risky.
    // For debugging connection reset, knowing THE ERROR is key.
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
});
