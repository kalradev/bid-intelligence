require('dotenv').config();
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
    console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Missing'}`);
});

module.exports = app;
