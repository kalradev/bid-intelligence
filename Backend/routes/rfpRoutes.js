const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { analyzeRFP, enrichOEMs } = require('../controllers/rfpController');

/**
 * POST /api/rfp/analyze
 * Upload and analyze RFP document
 */
router.post('/analyze', upload.single('file'), analyzeRFP);

/**
 * POST /api/rfp/enrich-oems
 * Enrich products with OEM information using web search
 */
router.post('/enrich-oems', enrichOEMs);

/**
 * GET /api/rfp/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'RFP Analysis API is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
