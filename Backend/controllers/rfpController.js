const { extractText } = require('../services/documentExtractor');
const { generateDepartmentalSummaries } = require('../services/aiService'); // OpenAI only
const { enrichProducts, getEnrichmentStats } = require('../services/oemEnrichmentService');
const { extractBOQDeterministic } = require('../services/deterministicBOQService');
const FileCache = require('../models/fileCache');
const { computeFileHash } = require('../utils/hashUtils');
const { PROCESSING_VERSION } = require('../config/version');
const { storeFile } = require('../utils/fileStorage');

/**
 * Analyze RFP document
 * POST /api/rfp/analyze
 */
const analyzeRFP = async (req, res, next) => {
    const startTime = Date.now();

    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded',
                message: 'Please upload a PDF, DOC, DOCX, XLS, XLSX, or image file (PNG, JPG, etc.)'
            });
        }

        const { buffer, mimetype, originalname } = req.file;

        console.log(`Processing file: ${originalname} (${mimetype})`);

        // Compute file hash for cache lookup
        const fileHash = computeFileHash(buffer);
        console.log(`File hash: ${fileHash.substring(0, 16)}... | Version: ${PROCESSING_VERSION}`);

        // Check cache first (with version)
        const cachedResult = FileCache.findByHash(fileHash, PROCESSING_VERSION);
        
        if (cachedResult) {
            const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Cache HIT! Returning cached results for: ${originalname}`);
            
            // ✅ RECALCULATE STATISTICS to ensure they're always correct
            // This fixes any issues with old cached data that had incorrect calculations
            let correctedSummaries = cachedResult.departmental_summaries;
            
            // Recalculate product mapping statistics if products exist
            if (correctedSummaries?.productMapping?.miiProductStatus && 
                Array.isArray(correctedSummaries.productMapping.miiProductStatus) &&
                correctedSummaries.productMapping.miiProductStatus.length > 0) {
                
                console.log('🔄 Recalculating statistics from cached data...');
                const allProducts = correctedSummaries.productMapping.miiProductStatus;
                const stats = getEnrichmentStats(allProducts);
                
                // Update with CORRECT calculations
                correctedSummaries.productMapping.totalOEMs = {
                    count: stats.uniqueOEMCount,
                    indian: stats.uniqueIndianCount,
                    global: stats.uniqueGlobalCount
                };
                
                correctedSummaries.productMapping.productsMapped = stats.enriched;
                correctedSummaries.productMapping.totalItems = stats.total;
                
                // ✅ CORRECT CALCULATION: unmapped = total - mapped (Indian products)
                const mapped = stats.indianOEMs;
                const unmapped = stats.total - mapped;
                
                correctedSummaries.productMapping.makeInIndiaMapping = {
                    status: stats.miiCompliance,
                    mapped: mapped,
                    unmapped: unmapped
                };
                
                // Validate the calculation
                if (mapped + unmapped !== stats.total) {
                    console.warn(`⚠️ WARNING: MII mapping calculation error in cache! ${mapped} + ${unmapped} !== ${stats.total}`);
                } else {
                    console.log(`✅ Cached data statistics recalculated: ${mapped} mapped + ${unmapped} unmapped = ${stats.total} total`);
                }
            }
            
            return res.json({
                success: true,
                cached: true,
                data: {
                    fileName: originalname,
                    fileHash: fileHash, // Include fileHash for chatbot
                    extractedText: cachedResult.extracted_text,
                    departmentalSummaries: correctedSummaries, // Use corrected summaries
                    metadata: {
                        processingTime: `${processingTime}s`,
                        pageCount: cachedResult.metadata?.pageCount || 'N/A',
                        wordCount: cachedResult.metadata?.wordCount || 'N/A',
                        model: cachedResult.metadata?.model || 'N/A',
                        chunked: cachedResult.metadata?.chunked || false,
                        usage: cachedResult.metadata?.usage || null,
                        cachedAt: cachedResult.created_at,
                        lastAccessed: cachedResult.last_accessed_at,
                        statisticsRecalculated: true // Flag to indicate stats were recalculated
                    }
                }
            });
        }

        console.log(`Cache MISS. Processing file...`);

        // Step 1: Extract text from document
        console.log('Extracting text from document...');
        const extractionResult = await extractText(buffer, mimetype, originalname);

        console.log(`Extracted ${extractionResult.wordCount} words from ${extractionResult.metadata.pages || 'unknown'} pages`);
        
        // Step 1.1: Extract page-by-page data for exact matching (for PDFs)
        if (mimetype === 'application/pdf') {
            try {
                const { extractPageByPage, storePageByPageData } = require('../services/pageByPageExtractor');
                console.log('📄 Extracting page-by-page data for exact matching...');
                const pageData = await extractPageByPage(buffer, fileHash);
                await storePageByPageData(fileHash, pageData);
                console.log(`✅ Stored page-by-page data: ${pageData.length} pages`);
            } catch (pageError) {
                console.warn('⚠️  Page-by-page extraction failed (non-critical):', pageError.message);
                // Continue with analysis even if page extraction fails
            }
        }
        
        // DEBUG: Log first 500 chars to check extraction quality
        console.log('--- EXTRACTED TEXT PREVIEW (First 500 chars) ---');
        console.log(extractionResult.text.substring(0, 500));
        console.log('------------------------------------------------');

        // Step 1.5: Try NEW Deterministic BOQ Extraction (Table-based)
        console.log('\n🎯 Attempting NEW deterministic BOQ extraction...');
        console.log(`   File: ${originalname}`);
        console.log(`   Text length: ${extractionResult.text.length} characters`);
        let useDeterministicFlow = false;
        let deterministicResult = null;
        
        // Try deterministic extraction for PDFs and Excel files (both have table structures)
        if (mimetype === 'application/pdf' || 
            mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimetype === 'application/vnd.ms-excel' ||
            mimetype === 'application/excel') {
            try {
                deterministicResult = await extractBOQDeterministic(
                    buffer,
                    extractionResult.text,
                    originalname
                );
                
                if (deterministicResult.success && deterministicResult.products.length > 0) {
                    useDeterministicFlow = true;
                    console.log(`✅ Deterministic extraction SUCCESS: ${deterministicResult.products.length} products`);
                    console.log(`   Method: ${deterministicResult.metadata?.extractionMethod || 'unknown'}`);
                    console.log(`   Was transposed: ${deterministicResult.metadata?.wasTransposed || false}`);
                } else {
                    console.log('⚠️ Deterministic extraction found no products, falling back to LLM method...');
                    if (deterministicResult?.error) {
                        console.log(`   Error: ${deterministicResult.error}`);
                    }
                }
            } catch (error) {
                console.error('❌ Deterministic extraction failed:', error.message);
                console.error('   Stack:', error.stack);
                console.log('⚠️ Falling back to traditional LLM-based extraction...');
            }
        } else {
            console.log('ℹ️ Non-PDF document, using traditional LLM-based extraction...');
        }

        // Step 2: Generate departmental summaries using OpenAI
        console.log('\nGenerating departmental summaries with OpenAI...');
        const aiResult = await generateDepartmentalSummaries(
            extractionResult.text,
            originalname
        );

        // Step 2.5: Merge deterministic BOQ results with AI summaries (if available)
        let enrichedSummaries = aiResult.summaries;
        
        if (useDeterministicFlow && deterministicResult) {
            console.log('\n🔥 Using DETERMINISTIC BOQ results (guaranteed stable output)');
            
            // Replace product mapping with deterministic results
            enrichedSummaries.productMapping = {
                sourceType: 'BOQ',
                totalItems: deterministicResult.statistics.totalProducts,
                totalOEMs: {
                    count: deterministicResult.statistics.uniqueOEMs,
                    indian: deterministicResult.statistics.indianOEMs,
                    global: deterministicResult.statistics.globalOEMs
                },
                productsMapped: deterministicResult.statistics.mapped,
                makeInIndiaMapping: {
                    status: deterministicResult.statistics.miiPercentage >= 50 ? 'Compliant' : 'Partial',
                    mapped: deterministicResult.statistics.indianProducts,
                    unmapped: deterministicResult.statistics.globalProducts + deterministicResult.statistics.unspecifiedProducts
                },
                miiProductStatus: deterministicResult.products,
                extractionMetadata: deterministicResult.metadata
            };
            
            // Update technical totalItems to match
            if (enrichedSummaries.technical) {
                enrichedSummaries.technical.totalItems = deterministicResult.statistics.totalProducts;
            }
            
            console.log('✅ Deterministic BOQ merged into AI summaries');
        } else {
            console.log('\n📝 Using TRADITIONAL LLM-based BOQ extraction');
        }

        // Step 2.6: Auto-enrich ALL products with proper OEM and MII classification (for LLM-based extraction)
        if (!useDeterministicFlow) {
            console.log('🔍 Auto-enriching ALL products with OEM and MII verification...');
        
        // Validate that productMapping exists
        if (!enrichedSummaries) {
            enrichedSummaries = {};
        }
        if (!enrichedSummaries.productMapping) {
            enrichedSummaries.productMapping = {};
        }
        
        if (enrichedSummaries?.productMapping?.miiProductStatus && 
            Array.isArray(enrichedSummaries.productMapping.miiProductStatus) &&
            enrichedSummaries.productMapping.miiProductStatus.length > 0) {
            
            const products = enrichedSummaries.productMapping.miiProductStatus;
            console.log(`📦 Total products found: ${products.length}`);
            
            // ✅ VALIDATION: Remove invalid products (N/A, empty names, hallucinations)
            const validProducts = products.filter(p => {
                const hasValidName = p.productName && 
                                    p.productName.trim() !== '' && 
                                    p.productName !== 'N/A' && 
                                    p.productName !== 'n/a' &&
                                    p.productName !== 'Not Applicable' &&
                                    p.productName.toLowerCase() !== 'miscellaneous' &&
                                    p.productName.toLowerCase() !== 'others';
                
                if (!hasValidName) {
                    console.warn(`⚠️ Filtering out invalid product: "${p.productName || 'EMPTY'}"`);
                    return false;
                }
                return true;
            });
            
            if (validProducts.length < products.length) {
                console.log(`🧹 Filtered out ${products.length - validProducts.length} invalid products`);
                console.log(`✅ Valid products: ${validProducts.length}`);
            }
            
            // ✅ ENRICH ALL VALID PRODUCTS - both specified and unspecified
            // This ensures proper MII classification and OEM verification for ALL
            console.log(`🚀 Enriching ${validProducts.length} valid products (parallel processing)...`);
            const enrichedProducts = await enrichProducts(validProducts);
            
            // Replace with enriched products
            enrichedSummaries.productMapping.miiProductStatus = enrichedProducts;
            
            // ALWAYS recalculate stats with CORRECT formulas (whether enriched or not)
            const allProducts = enrichedSummaries.productMapping.miiProductStatus;
            const stats = getEnrichmentStats(allProducts);
            
            console.log('📊 Statistics Calculated:');
            console.log(`   Total Products: ${stats.total}`);
            console.log(`   Products with Indian OEMs: ${stats.indianOEMs}`);
            console.log(`   Products with Global OEMs: ${stats.globalOEMs}`);
            console.log(`   Unspecified: ${stats.unspecified}`);
            console.log(`   Unique OEMs: ${stats.uniqueOEMCount} (${stats.uniqueIndianCount} Indian + ${stats.uniqueGlobalCount} Global)`);
            console.log(`   MII Compliance: ${stats.miiCompliance}`);
            
            // Validate calculations before saving
            const totalCheck = stats.indianOEMs + stats.globalOEMs + stats.unspecified;
            if (totalCheck !== stats.total) {
                console.warn(`⚠️ WARNING: Product count mismatch! ${totalCheck} !== ${stats.total}`);
            }
            
            if (stats.uniqueOEMCount > stats.total) {
                console.warn(`⚠️ WARNING: More OEMs than products! ${stats.uniqueOEMCount} > ${stats.total}`);
            }
            
            // Update with CORRECT calculations
            enrichedSummaries.productMapping.totalOEMs = {
                count: stats.uniqueOEMCount,
                indian: stats.uniqueIndianCount,
                global: stats.uniqueGlobalCount
            };
            
            enrichedSummaries.productMapping.productsMapped = stats.enriched;
            enrichedSummaries.productMapping.totalItems = stats.total;
            
            // ✅ CORRECT CALCULATION: unmapped = total - mapped (Indian products)
            // This ensures: mapped + unmapped = totalItems (always correct)
            const mapped = stats.indianOEMs;
            const unmapped = stats.total - mapped;
            
            enrichedSummaries.productMapping.makeInIndiaMapping = {
                status: stats.miiCompliance,
                mapped: mapped,
                unmapped: unmapped
            };
            
            // Validate the calculation
            if (mapped + unmapped !== stats.total) {
                console.warn(`⚠️ WARNING: MII mapping calculation error! ${mapped} + ${unmapped} !== ${stats.total}`);
            } else {
                console.log(`✅ MII Mapping verified: ${mapped} mapped + ${unmapped} unmapped = ${stats.total} total`);
            }
            
            // ✅ ENSURE CONSISTENCY: technical.totalItems MUST match productMapping.totalItems
            if (enrichedSummaries.technical) {
                enrichedSummaries.technical.totalItems = stats.total;
                console.log(`✅ Synced technical.totalItems with productMapping: ${stats.total}`);
                
                // Remove compliance and gaps if present
                if (enrichedSummaries.technical.compliancePercent) {
                    delete enrichedSummaries.technical.compliancePercent;
                }
                if (enrichedSummaries.technical.gapsIdentified) {
                    delete enrichedSummaries.technical.gapsIdentified;
                }
                
                // ✅ AUTO-GENERATE KEY SPECIFICATIONS FROM ALL PRODUCTS
                // Extract ONLY the actual technical specifications from document (not OEM/Model/Category)
                if (allProducts.length > 0) {
                    enrichedSummaries.technical.keySpecifications = allProducts
                        .map(product => {
                            // Use ONLY the actual specifications field from the document
                            const specification = product.specifications || '';
                            
                            return {
                                productName: product.productName || 'N/A',
                                specification: specification.trim() || 'No specifications mentioned in document'
                            };
                        })
                        .filter(item => {
                            // Keep all items - show "No specifications" if none found
                            return item.productName && item.productName !== 'N/A';
                        });
                    console.log(`✅ Auto-generated keySpecifications for ALL ${allProducts.length} products (using document specifications only)`);
                }
            }
            
            // ✅ VERIFY OEM VARIETY - Log warning if too many same OEMs
            const oemCounts = {};
            allProducts.forEach(p => {
                if (p.oem && p.oem !== 'Unspecified') {
                    oemCounts[p.oem] = (oemCounts[p.oem] || 0) + 1;
                }
            });
            
            const maxOEMCount = Math.max(...Object.values(oemCounts));
            const maxOEMPercentage = (maxOEMCount / stats.total) * 100;
            
            if (maxOEMPercentage > 70) {
                console.warn(`⚠️ WARNING: One OEM dominates ${maxOEMPercentage.toFixed(0)}% of products. Check for variety issues.`);
                const dominantOEM = Object.keys(oemCounts).find(key => oemCounts[key] === maxOEMCount);
                console.warn(`   Dominant OEM: ${dominantOEM} (${maxOEMCount}/${stats.total} products)`);
            } else {
                console.log(`✅ OEM variety looks good: ${stats.uniqueOEMCount} unique OEMs across ${stats.total} products`);
            }

            console.log(`✅ Auto-enrichment complete. Calculations verified.`);
            
        } else {
            console.log('⚠️ No product mapping data found in AI response. Skipping enrichment.');
            // Initialize empty product mapping if not present
            enrichedSummaries.productMapping = {
                sourceType: 'N/A',
                totalItems: 0,
                totalOEMs: { count: 0, indian: 0, global: 0 },
                productsMapped: 0,
                makeInIndiaMapping: { status: '0%', mapped: 0, unmapped: 0 },
                miiProductStatus: []
            };
        }
        } // End of if (!useDeterministicFlow) block

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // Step 3: Cache the results (with enriched data)
        const cacheData = {
            fileHash,
            processingVersion: PROCESSING_VERSION,
            originalFilename: originalname,
            extractedText: extractionResult.text,
            departmentalSummaries: enrichedSummaries,
            metadata: {
                pageCount: extractionResult.metadata.pages || 'N/A',
                wordCount: extractionResult.wordCount,
                model: aiResult.model,
                chunked: aiResult.chunked || false,
                usage: aiResult.usage,
                autoEnriched: true
            }
        };

        FileCache.create(cacheData);

        // Step 3.5: Store file to disk for document viewing
        try {
            storeFile(buffer, fileHash, originalname);
            console.log(`✅ File stored for document viewing: ${originalname}`);
        } catch (error) {
            console.warn(`⚠️ Could not store file for viewing: ${error.message}`);
        }

        // Step 4: Store document in Pinecone for chatbot queries (async, don't wait)
        // Extract page-by-page text for page number references
        let pageTexts = null;
        if (mimetype === 'application/pdf') {
            try {
                const { PDFParse } = require('pdf-parse');
                // pdf-parse v2 API: instantiate PDFParse with data (buffer)
                const parser = new PDFParse({ data: buffer });
                const pdfText = await parser.getText();
                const pages = await parser.getPages();
                const totalPages = pages.length || extractionResult.metadata.pages || 1;
                
                // For pdf-parse, we need to extract pages individually
                // Since pdf-parse doesn't provide per-page extraction easily,
                // we'll estimate page boundaries based on text length
                const fullText = pdfText || extractionResult.text;
                const avgCharsPerPage = fullText.length / totalPages;
                
                pageTexts = [];
                for (let i = 0; i < totalPages; i++) {
                    const start = Math.floor(i * avgCharsPerPage);
                    const end = Math.floor((i + 1) * avgCharsPerPage);
                    pageTexts.push({
                        pageNumber: i + 1,
                        text: fullText.substring(start, end)
                    });
                }
                console.log(`✅ Extracted text from ${pageTexts.length} pages for page number references`);
            } catch (error) {
                console.warn(`⚠️ Could not extract page-by-page text: ${error.message}`);
                // Fallback: estimate page numbers based on text length
                const totalPages = extractionResult.metadata.pages || 1;
                const avgCharsPerPage = extractionResult.text.length / totalPages;
                pageTexts = [];
                for (let i = 0; i < totalPages; i++) {
                    const start = Math.floor(i * avgCharsPerPage);
                    const end = Math.floor((i + 1) * avgCharsPerPage);
                    pageTexts.push({
                        pageNumber: i + 1,
                        text: extractionResult.text.substring(start, end)
                    });
                }
            }
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                   mimetype === 'application/vnd.ms-excel' ||
                   mimetype === 'application/excel') {
            // For Excel files, use sheets as "pages"
            try {
                const XLSX = require('xlsx');
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                const sheetNames = workbook.SheetNames;
                
                pageTexts = [];
                for (let i = 0; i < sheetNames.length; i++) {
                    const sheetName = sheetNames[i];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                    const sheetText = jsonData.map(row => 
                        row.filter(cell => cell !== '').join(' | ')
                    ).join('\n');
                    
                    pageTexts.push({
                        pageNumber: i + 1,
                        text: `=== Sheet: ${sheetName} ===\n${sheetText}`
                    });
                }
                console.log(`✅ Extracted text from ${pageTexts.length} Excel sheets for page number references`);
            } catch (error) {
                console.warn(`⚠️ Could not extract sheet-by-sheet text: ${error.message}`);
                // Fallback: treat entire Excel as one page
                pageTexts = [{
                    pageNumber: 1,
                    text: extractionResult.text
                }];
            }
        } else {
            // For Word documents and images, estimate pages based on text length
            // ~500 words per page for Word, ~300 words per page for images (OCR text is usually less dense)
            const wordsPerPage = mimetype.startsWith('image/') ? 300 : 500;
            const wordCount = extractionResult.wordCount;
            const totalPages = Math.max(1, Math.ceil(wordCount / wordsPerPage));
            const avgCharsPerPage = extractionResult.text.length / totalPages;
            
            pageTexts = [];
            for (let i = 0; i < totalPages; i++) {
                const start = Math.floor(i * avgCharsPerPage);
                const end = Math.floor((i + 1) * avgCharsPerPage);
                pageTexts.push({
                    pageNumber: i + 1,
                    text: extractionResult.text.substring(start, end)
                });
            }
            console.log(`✅ Estimated ${pageTexts.length} pages for ${mimetype} document`);
        }
        
        try {
            const chatbotUrl = process.env.CHATBOT_API_URL || 'http://localhost:8080';
            // Only delete old data during testing (set DELETE_OLD_DATA_ON_UPLOAD=true in .env for testing)
            const deleteOldData = process.env.DELETE_OLD_DATA_ON_UPLOAD === 'true' || false;
            
            fetch(`${chatbotUrl}/store-rfp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileHash: fileHash,
                    fileName: originalname,
                    text: extractionResult.text,
                    pageTexts: pageTexts, // Include page-by-page text for page number mapping
                    deleteOldData: deleteOldData, // Only delete during testing
                    analysisData: enrichedSummaries, // Top-level analysis data for chatbot
                    metadata: {
                        uploadedAt: new Date().toISOString(),
                        pageCount: extractionResult.metadata.pages || 'N/A',
                        wordCount: extractionResult.wordCount
                    }
                })
            }).then(async response => {
                if (response.ok) {
                    const result = await response.json();
                    console.log(`✅ Document stored in Pinecone for chatbot: ${originalname}`);
                    console.log(`   Document ID: ${fileHash}`);
                    console.log(`   Chunks stored: ${result.data?.chunksCount || 'unknown'}`);
                } else {
                    const errorText = await response.text();
                    console.error(`❌ Failed to store document in Pinecone: ${response.status} ${response.statusText}`);
                    console.error(`   Error details: ${errorText.substring(0, 200)}`);
                    console.error(`   ⚠️  Reference links will not work until document is stored in Pinecone!`);
                    console.error(`   Make sure Flask backend is running on ${chatbotUrl}`);
                }
            }).catch(error => {
                console.error(`❌ Error storing document in Pinecone: ${error.message}`);
                console.error(`   ⚠️  Reference links will not work until document is stored in Pinecone!`);
                console.error(`   Make sure Flask backend is running on ${chatbotUrl}`);
                // Don't fail the request if Pinecone storage fails
            });
        } catch (error) {
            console.warn(`⚠️ Error initiating Pinecone storage: ${error.message}`);
        }

        // Step 5: Return response (with enriched data)
        res.json({
            success: true,
            cached: false,
            data: {
                fileName: originalname,
                fileHash: fileHash, // Include fileHash so frontend can use it for document-specific queries
                extractedText: extractionResult.text,
                departmentalSummaries: enrichedSummaries,
                metadata: {
                    processingTime: `${processingTime}s`,
                    pageCount: extractionResult.metadata.pages || 'N/A',
                    wordCount: extractionResult.wordCount,
                    model: aiResult.model,
                    chunked: aiResult.chunked || false,
                    usage: aiResult.usage,
                    autoEnriched: true
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Enrich product OEMs using web search
 * POST /api/rfp/enrich-oems
 */
const enrichOEMs = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const { products } = req.body;

        // Validate input
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input',
                message: 'Please provide an array of products to enrich'
            });
        }

        console.log(`Starting OEM enrichment for ${products.length} products...`);

        // Enrich products
        const enrichedProducts = await enrichProducts(products);

        // Get statistics
        const stats = getEnrichmentStats(enrichedProducts);

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`✅ OEM enrichment completed in ${processingTime}s`);
        console.log(`Statistics: ${JSON.stringify(stats, null, 2)}`);

        res.json({
            success: true,
            data: {
                products: enrichedProducts,
                stats: stats,
                metadata: {
                    processingTime: `${processingTime}s`,
                    totalProducts: products.length,
                    enrichedCount: stats.enriched
                }
            }
        });

    } catch (error) {
        console.error('Error enriching OEMs:', error);
        next(error);
    }
};

module.exports = {
    analyzeRFP,
    enrichOEMs
};
