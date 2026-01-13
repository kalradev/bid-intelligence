const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/uploadMiddleware');
const { analyzeRFP, enrichOEMs } = require('../controllers/rfpController');
const { getStoredFilePath, UPLOAD_DIR } = require('../utils/fileStorage');
const { queryRFPDocument } = require('../services/pineconeService');

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
 * GET /api/rfp/document/:fileHash
 * Serve stored document file
 */
router.get('/document/:fileHash', (req, res) => {
    try {
        const { fileHash } = req.params;
        const { fileName } = req.query;
        
        if (!fileHash) {
            return res.status(400).json({ error: 'File hash is required' });
        }
        
        console.log(`📄 Requesting document: ${fileHash}`);
        console.log(`   File name: ${fileName || 'not provided'}`);
        
        // Try to find the file
        const filePath = getStoredFilePath(fileHash, fileName || 'document.pdf');
        
        if (!filePath || !fs.existsSync(filePath)) {
            console.error(`❌ Document not found: ${fileHash}`);
            console.error(`   Searched path: ${filePath}`);
            console.error(`   Upload directory: ${UPLOAD_DIR}`);
            
            // List files in upload directory for debugging
            if (fs.existsSync(UPLOAD_DIR)) {
                const files = fs.readdirSync(UPLOAD_DIR);
                console.error(`   Files in upload directory: ${files.length}`);
                if (files.length > 0) {
                    console.error(`   First 5 files: ${files.slice(0, 5).join(', ')}`);
                }
            }
            
            return res.status(404).json({ 
                error: 'Document not found',
                fileHash: fileHash,
                searchedPath: filePath
            });
        }
        
        console.log(`✅ Found document: ${filePath}`);
        
        // Determine content type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        const contentTypeMap = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.webp': 'image/webp'
        };
        
        const contentType = contentTypeMap[ext] || 'application/octet-stream';
        
        // Get file stats
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   File size: ${(fileSize / 1024).toFixed(2)} KB`);
        
        // Set headers for embedding in iframe/embed tag
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', fileSize);
        // Use inline for embedding, but add X-Frame-Options to allow embedding
        res.setHeader('Content-Disposition', `inline; filename="${fileName || path.basename(filePath)}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Add CORS headers if needed
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Range');
        
        // Support range requests for PDF streaming
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
            };
            res.writeHead(206, head);
            file.pipe(res);
            return;
        }
        
        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        
        fileStream.on('error', (err) => {
            console.error('Error streaming file:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error streaming document' });
            }
        });
        
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Error serving document:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error serving document', message: error.message });
        }
    }
});

/**
 * POST /api/rfp/get-sources
 * Get source references for a query from Pinecone
 * Proxies to Flask backend which uses the same embeddings as document storage
 */
router.post('/get-sources', async (req, res) => {
    try {
        const { query, documentId } = req.body;
        
        if (!query) {
            return res.status(400).json({ 
                error: 'Query is required',
                sources: []
            });
        }
        
        // If no documentId, return empty
        if (!documentId) {
            console.warn('No documentId provided for source search');
            return res.json({ 
                sources: [],
                query: query,
                message: 'No document specified. Please upload and analyze an RFP document first.'
            });
        }
        
        console.log(`🔍 Searching for sources: "${query.substring(0, 50)}..." in document: ${documentId}`);
        
        // Proxy to Flask backend which uses the same embeddings (sentence-transformers)
        // as the document storage, ensuring compatibility
        const chatbotUrl = process.env.CHATBOT_API_URL || 'http://localhost:8080';
        
        try {
            console.log(`📡 Calling Flask backend: ${chatbotUrl}/get-sources`);
            console.log(`   Query: "${query.substring(0, 50)}..."`);
            console.log(`   Document ID: ${documentId}`);
            
            const flaskResponse = await fetch(`${chatbotUrl}/get-sources`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    documentId: documentId,
                }),
                // Add timeout
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
            console.log(`📥 Flask response status: ${flaskResponse.status}`);
            
            if (!flaskResponse.ok) {
                const errorText = await flaskResponse.text();
                console.error(`❌ Flask backend error: ${flaskResponse.status} - ${errorText}`);
                throw new Error(`Flask backend returned ${flaskResponse.status}: ${errorText.substring(0, 100)}`);
            }
            
            const flaskData = await flaskResponse.json();
            console.log(`📦 Flask response:`, {
                success: flaskData.success,
                count: flaskData.count,
                sourcesLength: flaskData.sources?.length || 0,
                hasSources: !!flaskData.sources
            });
            
            // Format Flask response to match frontend expectations
            const rawSources = flaskData.sources || flaskData.sourcePages || [];
            console.log(`📚 Raw sources count: ${rawSources.length}`);
            
            if (rawSources.length === 0) {
                console.warn(`⚠️ No sources returned from Flask backend`);
                console.warn(`   Query: "${query}"`);
                console.warn(`   Document ID: ${documentId}`);
                console.warn(`   Flask response:`, JSON.stringify(flaskData, null, 2));
            }
            
            // Filter and process sources - only use accurate ones
            const MIN_RELEVANCE = 25; // Minimum 25% relevance (lowered to get at least 3 sources)
            const MAX_SOURCES = 5; // Fetch more candidates
            const MIN_SOURCES = 3; // Always try to return at least 3 sources (user requirement)
            const seenPages = new Set();
            
            // First pass: collect valid sources above threshold
            const validSources = rawSources
                .map((source, idx) => {
                    // Handle different response formats
                    let pageNumber = source.pageNumber || source.page || source.pageNumbers?.split(',')[0];
                    
                    // If pageNumber is still empty, try to extract from metadata
                    if (!pageNumber && source.metadata) {
                        pageNumber = source.metadata.pageNumber || source.metadata.pageNumbers?.split(',')[0];
                    }
                    
                    // CRITICAL: Only use actual page numbers - skip if not available
                    if (!pageNumber || pageNumber === 'None' || pageNumber === 'null' || pageNumber === 'N/A' || pageNumber === '' || pageNumber === '0') {
                        return null; // Skip sources without valid page numbers
                    }
                    
                    const fileName = source.fileName || source.filename || flaskData.fileName || 'document.pdf';
                    const snippet = source.snippet || source.text || source.pageContent || source.content || '';
                    const relevance = source.relevance || 0;
                    
                    // Skip if relevance is too low (but we'll try fallback later)
                    if (relevance < MIN_RELEVANCE) {
                        return null;
                    }
                    
                    // Skip if we've already seen this page
                    const pageKey = `${pageNumber}_${fileName}`;
                    if (seenPages.has(pageKey)) {
                        return null;
                    }
                    seenPages.add(pageKey);
                    
                    return {
                        pageNumber: pageNumber.toString(),
                        fileName: fileName,
                        snippet: snippet.substring(0, 300) + (snippet.length > 300 ? '...' : ''),
                        relevance: Math.round(relevance * 10) / 10, // Round to 1 decimal (already a percentage)
                        chunkIndex: source.chunkIndex || idx
                    };
                })
                .filter(source => source !== null) // Remove null entries
                .sort((a, b) => b.relevance - a.relevance); // Sort by relevance (highest first)
            
            let sources = validSources.slice(0, 3); // Always return top 3 most relevant
            
            // If we don't have enough sources, try to get more (even if below threshold)
            if (sources.length < MIN_SOURCES && rawSources.length > validSources.length) {
                console.log(`   ⚠️  Only found ${sources.length} sources, trying to get more...`);
                // Get additional sources with lower threshold
                for (const source of rawSources) {
                    if (sources.length >= MIN_SOURCES) break;
                    
                    let pageNumber = source.pageNumber || source.page || source.pageNumbers?.split(',')[0];
                    if (!pageNumber && source.metadata) {
                        pageNumber = source.metadata.pageNumber || source.metadata.pageNumbers?.split(',')[0];
                    }
                    
                    if (!pageNumber || pageNumber === 'None' || pageNumber === 'null' || pageNumber === 'N/A' || pageNumber === '' || pageNumber === '0') {
                        continue;
                    }
                    
                    const fileName = source.fileName || source.filename || flaskData.fileName || 'document.pdf';
                    const pageKey = `${pageNumber}_${fileName}`;
                    
                    // Skip if already in sources
                    if (seenPages.has(pageKey)) continue;
                    const alreadyAdded = sources.some(s => s.pageNumber === pageNumber && s.fileName === fileName);
                    if (alreadyAdded) continue;
                    
                    seenPages.add(pageKey);
                    const snippet = source.snippet || source.text || source.pageContent || source.content || '';
                    const relevance = source.relevance || 0;
                    
                    if (snippet && snippet.trim().length > 10) {
                        sources.push({
                            pageNumber: pageNumber.toString(),
                            fileName: fileName,
                            snippet: snippet.substring(0, 300) + (snippet.length > 300 ? '...' : ''),
                            relevance: Math.round(relevance * 10) / 10,
                            chunkIndex: source.chunkIndex || 0
                        });
                        console.log(`   📄 Added fallback source: Page ${pageNumber}, Relevance: ${Math.round(relevance * 10) / 10}%`);
                    }
                }
            }
            
            console.log(`✅ Found ${sources.length} accurate sources from Flask backend (filtered from ${rawSources.length} candidates)`);
            
            if (sources.length === 0) {
                console.warn(`⚠️ No sources found after formatting. This might mean:`);
                console.warn(`   1. Document ${documentId} is not indexed in Pinecone`);
                console.warn(`   2. The query "${query}" doesn't match any content`);
                console.warn(`   3. The document was stored but the namespace doesn't match`);
            }
            
            res.json({
                sources: sources,
                query: query,
                documentId: documentId
            });
            
        } catch (flaskError) {
            console.error('Error calling Flask backend:', flaskError.message);
            
            // If Flask backend is not available, try Node.js Pinecone as fallback
            if (process.env.PINECONE_API_KEY) {
                console.log('⚠️ Flask backend unavailable, trying Node.js Pinecone as fallback...');
                try {
                    const results = await queryRFPDocument(documentId, query, 5);
                    
                    // Filter and process sources - only use accurate ones
                    const MIN_RELEVANCE = 25; // Minimum 25% relevance
                    const MAX_SOURCES = 5; // Fetch more candidates
                    const MIN_SOURCES = 3; // Always try to return at least 3 sources
                    const seenPages = new Set();
                    
                    // First pass: collect valid sources above threshold
                    const validSources = results
                        .map((doc, idx) => {
                            const metadata = doc.metadata || {};
                            let pageNumber = metadata.pageNumber || metadata.pageNumbers?.split(',')[0];
                            
                            // CRITICAL: Only use actual page numbers - skip if not available
                            if (!pageNumber || pageNumber === 'None' || pageNumber === 'null' || pageNumber === 'N/A' || pageNumber === '' || pageNumber === '0') {
                                return null; // Skip sources without valid page numbers
                            }
                            
                            const fileName = metadata.fileName || 'document.pdf';
                            const snippet = doc.pageContent || '';
                            // Convert cosine similarity (0-1) to percentage (0-100)
                            const relevance = doc.score ? Math.round(doc.score * 100 * 10) / 10 : (100 - (idx * 10));
                            
                            // Skip if relevance is too low (but we'll try fallback later)
                            if (relevance < MIN_RELEVANCE) {
                                return null;
                            }
                            
                            // Skip if we've already seen this page
                            const pageKey = `${pageNumber}_${fileName}`;
                            if (seenPages.has(pageKey)) {
                                return null;
                            }
                            seenPages.add(pageKey);
                            
                            return {
                                pageNumber: pageNumber.toString(),
                                fileName: fileName,
                                snippet: snippet.substring(0, 300) + (snippet.length > 300 ? '...' : ''),
                                relevance: relevance,
                                chunkIndex: metadata.chunkIndex || idx,
                                score: doc.score || (1 - idx * 0.1) // Keep original score for sorting
                            };
                        })
                        .filter(source => source !== null) // Remove null entries
                        .sort((a, b) => (b.score || 0) - (a.score || 0)); // Sort by score (highest first)
                    
                    let sources = validSources.slice(0, 3); // Always return top 3 most relevant
                    
                    // If we don't have enough sources, try to get more (even if below threshold)
                    if (sources.length < MIN_SOURCES && results.length > validSources.length) {
                        console.log(`   ⚠️  Only found ${sources.length} sources, trying to get more...`);
                        for (const doc of results) {
                            if (sources.length >= MIN_SOURCES) break;
                            
                            const metadata = doc.metadata || {};
                            let pageNumber = metadata.pageNumber || metadata.pageNumbers?.split(',')[0];
                            
                            if (!pageNumber || pageNumber === 'None' || pageNumber === 'null' || pageNumber === 'N/A' || pageNumber === '' || pageNumber === '0') {
                                continue;
                            }
                            
                            const fileName = metadata.fileName || 'document.pdf';
                            const pageKey = `${pageNumber}_${fileName}`;
                            
                            if (seenPages.has(pageKey)) continue;
                            const alreadyAdded = sources.some(s => s.pageNumber === pageNumber && s.fileName === fileName);
                            if (alreadyAdded) continue;
                            
                            seenPages.add(pageKey);
                            const snippet = doc.pageContent || '';
                            const relevance = doc.score ? Math.round(doc.score * 100 * 10) / 10 : 30;
                            
                            if (snippet && snippet.trim().length > 10) {
                                sources.push({
                                    pageNumber: pageNumber.toString(),
                                    fileName: fileName,
                                    snippet: snippet.substring(0, 300) + (snippet.length > 300 ? '...' : ''),
                                    relevance: relevance,
                                    chunkIndex: metadata.chunkIndex || 0
                                });
                                console.log(`   📄 Added fallback source: Page ${pageNumber}, Relevance: ${relevance}%`);
                            }
                        }
                    }
                    
                    console.log(`✅ Found ${sources.length} sources from Node.js Pinecone fallback`);
                    
                    return res.json({
                        sources: sources,
                        query: query,
                        documentId: documentId
                    });
                } catch (pineconeError) {
                    console.error('Node.js Pinecone fallback also failed:', pineconeError.message);
                }
            }
            
            // Return empty sources if both methods fail
            res.json({
                sources: [],
                query: query,
                documentId: documentId,
                message: 'Unable to fetch sources. Please ensure the Flask chatbot backend is running on port 8080.'
            });
        }
        
    } catch (error) {
        console.error('Error fetching sources:', error);
        
        // Return empty sources instead of error to prevent UI breakage
        res.json({
            sources: [],
            query: req.body.query || '',
            documentId: req.body.documentId || null,
            error: error.message
        });
    }
});

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
