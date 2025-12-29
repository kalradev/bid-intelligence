/**
 * UNIVERSAL EXACT REFERENCE API
 * 
 * Deterministic, word-for-word matching for ANY PDF
 * NO semantic similarity, NO embeddings
 */

const express = require('express');
const router = express.Router();
const { findExactMatch, findAllExactMatches, findTextPosition } = require('../services/exactTextMatcher');
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
            
            // Find highlight position
            const pageData = pageTexts.find(p => p.pageNumber === match.page);
            let highlightInfo = null;
            
            if (pageData) {
                const position = findTextPosition(pageData.text, match.matchedText, query);
                highlightInfo = {
                    highlightStart: position.start,
                    highlightEnd: position.end,
                    contextBefore: position.contextBefore,
                    contextAfter: position.contextAfter
                };
            }
            
            return res.json({
                success: true,
                reference: {
                    matchedText: match.matchedText,
                    page: match.page,
                    confidence: match.confidence,
                    matchType: match.matchType,
                    ...highlightInfo
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
            
            // Add highlight positions to each match
            const enrichedMatches = matches.map(m => {
                const pageData = pageTexts.find(p => p.pageNumber === m.page);
                if (pageData) {
                    const position = findTextPosition(pageData.text, m.matchedText, query);
                    return {
                        ...m,
                        highlightStart: position.start,
                        highlightEnd: position.end,
                        contextBefore: position.contextBefore,
                        contextAfter: position.contextAfter
                    };
                }
                return m;
            });
            
            return res.json({
                success: true,
                references: enrichedMatches
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

/**
 * GET /api/reference/test
 * Test endpoint to verify route is working
 */
router.get('/test', (req, res) => {
    return res.json({
        success: true,
        message: 'Reference API is working',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/reference/page/:fileHash/:pageNumber
 * Get page text with optional highlight
 * IMPORTANT: This route must come before any other dynamic routes
 */
router.get('/page/:fileHash/:pageNumber', async (req, res) => {
    try {
        const { fileHash, pageNumber } = req.params;
        const { query } = req.query; // Optional query for highlighting
        
        console.log(`📄 GET /api/reference/page/:fileHash/:pageNumber`);
        console.log(`   Raw params - fileHash: ${fileHash.substring(0, 20)}..., pageNumber: ${pageNumber}`);
        
        // Decode fileHash if it was encoded
        let decodedFileHash;
        try {
            decodedFileHash = decodeURIComponent(fileHash);
            console.log(`   Decoded fileHash: ${decodedFileHash.substring(0, 20)}...`);
        } catch (e) {
            decodedFileHash = fileHash; // Use as-is if decoding fails
            console.log(`   Using fileHash as-is (decoding failed)`);
        }
        
        // Load page data
        let pageTexts = await loadPageByPageData(decodedFileHash);
        
        // If not found, try to extract it from the original file
        if (!pageTexts || pageTexts.length === 0) {
            console.log(`📄 Page data not found, attempting to extract from original file...`);
            
            const filePath = getStoredFilePath(decodedFileHash);
            if (!filePath || !fs.existsSync(filePath)) {
                console.log(`⚠️  Original file also not found: ${filePath}`);
                return res.status(404).json({
                    success: false,
                    error: 'Page data not found. Please re-upload and analyze the document.'
                });
            }
            
            try {
                const buffer = fs.readFileSync(filePath);
                pageTexts = await extractPageByPage(buffer, decodedFileHash);
                
                if (pageTexts && pageTexts.length > 0) {
                    // Store for future use
                    await storePageByPageData(decodedFileHash, pageTexts);
                    console.log(`✅ Extracted and stored ${pageTexts.length} pages`);
                } else {
                    return res.status(404).json({
                        success: false,
                        error: 'Could not extract page data from document.'
                    });
                }
            } catch (extractError) {
                console.error('❌ Error extracting page data:', extractError);
                return res.status(500).json({
                    success: false,
                    error: `Failed to extract page data: ${extractError.message}`
                });
            }
        }
        
        const pageNum = parseInt(pageNumber);
        if (isNaN(pageNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid page number'
            });
        }
        
        const pageData = pageTexts.find(p => p.pageNumber === pageNum);
        
        if (!pageData) {
            console.log(`⚠️  Page ${pageNum} not found. Available pages: ${pageTexts.map(p => p.pageNumber).join(', ')}`);
            return res.status(404).json({
                success: false,
                error: `Page ${pageNum} not found. Available pages: ${pageTexts.map(p => p.pageNumber).join(', ')}`
            });
        }
        
        let highlightPosition = null;
        
        // If query provided, find highlight position
        if (query) {
            try {
                const decodedQuery = decodeURIComponent(query);
                const match = findExactMatch(decodedQuery, [pageData]);
                if (match) {
                    const position = findTextPosition(pageData.text, match.matchedText, decodedQuery);
                    highlightPosition = {
                        start: position.start,
                        end: position.end,
                        matchedText: match.matchedText
                    };
                }
            } catch (queryError) {
                console.warn('Error finding highlight:', queryError.message);
                // Continue without highlight if query processing fails
            }
        }
        
        console.log(`✅ Returning page ${pageNum} (${pageData.text.length} chars, highlight: ${highlightPosition ? 'yes' : 'no'})`);
        
        return res.json({
            success: true,
            page: {
                pageNumber: pageData.pageNumber,
                text: pageData.text,
                wordCount: pageData.wordCount,
                highlight: highlightPosition
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting page:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

module.exports = router;

