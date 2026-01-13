/**
 * UNIVERSAL EXACT REFERENCE API
 * 
 * Deterministic, word-for-word matching for ANY PDF
 * NO semantic similarity, NO embeddings
 */

const express = require('express');
const router = express.Router();
const { findExactMatch, findAllExactMatches } = require('../services/exactTextMatcher');
const { loadPageByPageData } = require('../services/pageByPageExtractor');
const { getStoredFilePath } = require('../utils/fileStorage');
const fs = require('fs');
const { extractPageByPage, storePageByPageData } = require('../services/pageByPageExtractor');

/**
 * POST /api/reference/exact-match
 * Find exact text match in document
 */
router.post('/exact-match', async (req, res) => {
    try {
        const { query, fileHash } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required',
                reference: null
            });
        }
        
        if (!fileHash) {
            return res.status(400).json({
                success: false,
                error: 'File hash is required',
                reference: null
            });
        }
        
        console.log(`🔍 Exact match search: "${query.substring(0, 50)}..." in ${fileHash.substring(0, 16)}...`);
        
        // Load page-by-page data
        let pageTexts = await loadPageByPageData(fileHash);
        
        // If not found, extract it now
        if (!pageTexts || pageTexts.length === 0) {
            console.log(`📄 Page-by-page data not found, extracting now...`);
            
            const filePath = getStoredFilePath(fileHash);
            if (!filePath || !fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found',
                    reference: null
                });
            }
            
            const buffer = fs.readFileSync(filePath);
            pageTexts = await extractPageByPage(buffer, fileHash);
            
            // Store for future use
            await storePageByPageData(fileHash, pageTexts);
        }
        
        // Find exact match
        const match = findExactMatch(query, pageTexts);
        
        if (match && match.confidence >= 0.85) {
            console.log(`✅ Exact match found: Page ${match.page}, Confidence: ${match.confidence}`);
            
            return res.json({
                success: true,
                reference: {
                    matchedText: match.matchedText,
                    page: match.page,
                    confidence: match.confidence,
                    matchType: match.matchType
                }
            });
        } else {
            console.log(`⚠️  No exact match found (confidence: ${match?.confidence || 0})`);
            
            return res.json({
                success: false,
                error: 'No exact match found',
                reference: null,
                confidence: match?.confidence || 0
            });
        }
        
    } catch (error) {
        console.error('Error in exact match:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            reference: null
        });
    }
});

/**
 * POST /api/reference/exact-matches
 * Find all exact matches (for multiple references)
 */
router.post('/exact-matches', async (req, res) => {
    try {
        const { query, fileHash, maxResults = 3 } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required',
                references: []
            });
        }
        
        if (!fileHash) {
            return res.status(400).json({
                success: false,
                error: 'File hash is required',
                references: []
            });
        }
        
        console.log(`🔍 Finding all exact matches: "${query.substring(0, 50)}..." in ${fileHash.substring(0, 16)}...`);
        
        // Load page-by-page data
        let pageTexts = await loadPageByPageData(fileHash);
        
        // If not found, extract it now
        if (!pageTexts || pageTexts.length === 0) {
            console.log(`📄 Page-by-page data not found, extracting now...`);
            
            const filePath = getStoredFilePath(fileHash);
            if (!filePath || !fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found',
                    references: []
                });
            }
            
            const buffer = fs.readFileSync(filePath);
            pageTexts = await extractPageByPage(buffer, fileHash);
            
            // Store for future use
            await storePageByPageData(fileHash, pageTexts);
        }
        
        // Find all exact matches
        const matches = findAllExactMatches(query, pageTexts, maxResults);
        
        if (matches.length > 0) {
            console.log(`✅ Found ${matches.length} exact matches`);
            
            return res.json({
                success: true,
                references: matches.map(m => ({
                    matchedText: m.matchedText,
                    page: m.page,
                    confidence: m.confidence,
                    matchType: m.matchType
                }))
            });
        } else {
            console.log(`⚠️  No exact matches found`);
            
            return res.json({
                success: false,
                error: 'No exact matches found',
                references: []
            });
        }
        
    } catch (error) {
        console.error('Error finding exact matches:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            references: []
        });
    }
});

module.exports = router;

