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
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/rfp', rfpRoutes);

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
    console.log(`   Gemini: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    
    // Debug: Show what dotenv loaded
    console.log(`\n📋 Environment Variables Loaded:`);
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Present (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'MISSING'}`);
    console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Present (length: ' + process.env.GEMINI_API_KEY.length + ')' : 'MISSING'}`);
    console.log(`   PORT: ${process.env.PORT}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   MAX_FILE_SIZE_MB: ${process.env.MAX_FILE_SIZE_MB}`);
});

module.exports = app;
