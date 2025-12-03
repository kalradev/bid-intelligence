/**
 * Deterministic BOQ Service
 * Orchestrates the new deterministic extraction flow:
 * PDF → Table Extraction → Row Mapping → Deduplication → OEM Enrichment
 */

const { extractBOQTable } = require('./tableExtractorService');
const { mapRowsToProducts, validateProducts } = require('./rowMappingService');
const { deduplicatePipeline, sortProductsByQuality } = require('./deduplicationService');
const { enrichProducts, getEnrichmentStats } = require('./oemEnrichmentService');

/**
 * Main deterministic BOQ extraction pipeline
 * @param {Buffer} buffer - PDF file buffer
 * @param {String} plainText - Plain text (for fallback)
 * @param {String} fileName - Original file name
 * @returns {Promise<Object>} - Complete BOQ analysis with deterministic results
 */
const extractBOQDeterministic = async (buffer, plainText, fileName) => {
    console.log('\n🚀 ============================================');
    console.log('   DETERMINISTIC BOQ EXTRACTION - NEW FLOW');
    console.log('   ============================================\n');
    
    const startTime = Date.now();
    
    try {
        // STEP 1: Extract exact table rows (deterministic)
        console.log('📋 STEP 1: Table Extraction (Deterministic)');
        const tableResult = await extractBOQTable(buffer, plainText);
        
        if (!tableResult.success || tableResult.rowCount === 0) {
            console.log('⚠️ Table extraction failed or found no rows');
            return {
                success: false,
                method: 'deterministic',
                error: 'No table data found',
                fallbackRequired: true
            };
        }
        
        console.log(`✅ Extracted ${tableResult.rowCount} rows deterministically\n`);
        
        // STEP 2: Map each row to product schema (LLM per-row)
        console.log('🔄 STEP 2: Row-by-Row Product Mapping');
        const documentContext = `File: ${fileName}`;
        const mappedProducts = await mapRowsToProducts(
            tableResult.rows,
            tableResult.headers,
            documentContext
        );
        
        console.log(`✅ Mapped ${mappedProducts.length} products\n`);
        
        if (mappedProducts.length === 0) {
            return {
                success: false,
                method: 'deterministic',
                error: 'No valid products mapped',
                fallbackRequired: true
            };
        }
        
        // STEP 3: Validate product schemas
        console.log('🔍 STEP 3: JSON Schema Validation');
        const validProducts = validateProducts(mappedProducts);
        console.log('');
        
        // STEP 4: Deduplicate products
        console.log('🔧 STEP 4: Deduplication');
        const deduplicationResult = deduplicatePipeline(validProducts, {
            threshold: 0.85,
            removeExact: true,
            removeFuzzy: true
        });
        
        const uniqueProducts = deduplicationResult.products;
        console.log('');
        
        // STEP 5: OEM Enrichment (for "Unspecified" OEMs)
        console.log('🏭 STEP 5: OEM Enrichment');
        const enrichedProducts = await enrichProducts(uniqueProducts);
        console.log('');
        
        // STEP 6: Sort by quality
        const finalProducts = sortProductsByQuality(enrichedProducts);
        
        // Calculate statistics
        const statistics = calculateStatistics(finalProducts);
        
        const endTime = Date.now();
        const processingTime = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log('✅ ============================================');
        console.log('   DETERMINISTIC EXTRACTION COMPLETE!');
        console.log('   ============================================');
        console.log(`   📊 Total Products: ${finalProducts.length}`);
        console.log(`   🏭 Unique OEMs: ${statistics.uniqueOEMs}`);
        console.log(`   🇮🇳 Indian OEMs: ${statistics.indianOEMs}`);
        console.log(`   🌍 Global OEMs: ${statistics.globalOEMs}`);
        console.log(`   ✅ MII Compliance: ${statistics.miiPercentage}%`);
        console.log(`   ⏱️  Processing Time: ${processingTime}s`);
        console.log('   ============================================\n');
        
        return {
            success: true,
            method: 'deterministic',
            products: finalProducts,
            statistics,
            metadata: {
                extractionMethod: 'deterministic-table-based',
                rowsExtracted: tableResult.rowCount,
                productsInitial: mappedProducts.length,
                productsAfterValidation: validProducts.length,
                productsAfterDeduplication: uniqueProducts.length,
                productsFinal: finalProducts.length,
                duplicatesRemoved: deduplicationResult.metadata.duplicatesRemoved,
                processingTimeSeconds: processingTime,
                headers: tableResult.headers,
                deterministic: true // KEY: This extraction is deterministic
            }
        };
        
    } catch (error) {
        console.error('❌ Deterministic extraction error:', error);
        return {
            success: false,
            method: 'deterministic',
            error: error.message,
            fallbackRequired: true
        };
    }
};

/**
 * Calculate comprehensive statistics for BOQ products
 * @param {Array} products - Array of product objects
 * @returns {Object} - Statistics
 */
const calculateStatistics = (products) => {
    // Count unique OEMs
    const oemSet = new Set();
    const indianOEMs = new Set();
    const globalOEMs = new Set();
    
    let indianProducts = 0;
    let globalProducts = 0;
    let unspecifiedProducts = 0;
    
    for (const product of products) {
        const oem = product.oem || 'Unspecified';
        
        if (oem !== 'Unspecified') {
            oemSet.add(oem);
            
            const miiStatus = product.miiStatus || '';
            if (miiStatus.includes('Indian') || miiStatus.includes('MII-Compliant')) {
                indianOEMs.add(oem);
                indianProducts++;
            } else if (miiStatus.includes('Global')) {
                globalOEMs.add(oem);
                globalProducts++;
            }
        } else {
            unspecifiedProducts++;
        }
    }
    
    const totalProducts = products.length;
    const uniqueOEMs = oemSet.size;
    const miiPercentage = totalProducts > 0 
        ? Math.round((indianProducts / totalProducts) * 100) 
        : 0;
    
    return {
        totalProducts,
        uniqueOEMs,
        indianOEMs: indianOEMs.size,
        globalOEMs: globalOEMs.size,
        indianProducts,
        globalProducts,
        unspecifiedProducts,
        miiPercentage,
        mapped: totalProducts - unspecifiedProducts,
        unmapped: unspecifiedProducts
    };
};

/**
 * Compare two extraction runs to verify determinism
 * @param {Object} result1 - First extraction result
 * @param {Object} result2 - Second extraction result
 * @returns {Object} - Comparison report
 */
const verifyDeterminism = (result1, result2) => {
    const isDeterministic = 
        result1.products.length === result2.products.length &&
        result1.statistics.totalProducts === result2.statistics.totalProducts;
    
    const productCountMatch = result1.products.length === result2.products.length;
    const oemCountMatch = result1.statistics.uniqueOEMs === result2.statistics.uniqueOEMs;
    const miiPercentageMatch = result1.statistics.miiPercentage === result2.statistics.miiPercentage;
    
    return {
        isDeterministic,
        comparison: {
            productCount: {
                run1: result1.products.length,
                run2: result2.products.length,
                match: productCountMatch
            },
            uniqueOEMs: {
                run1: result1.statistics.uniqueOEMs,
                run2: result2.statistics.uniqueOEMs,
                match: oemCountMatch
            },
            miiPercentage: {
                run1: result1.statistics.miiPercentage,
                run2: result2.statistics.miiPercentage,
                match: miiPercentageMatch
            }
        },
        verdict: isDeterministic 
            ? '✅ DETERMINISTIC: Same results on both runs'
            : '⚠️ NON-DETERMINISTIC: Results differ between runs'
    };
};

module.exports = {
    extractBOQDeterministic,
    calculateStatistics,
    verifyDeterminism
};

