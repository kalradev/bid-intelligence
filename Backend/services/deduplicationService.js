/**
 * Deduplication Service
 * Ensures no duplicate products in final BOQ list
 * Handles edge cases where table extraction might find duplicate rows
 */

/**
 * Calculate similarity between two strings
 * @param {String} str1 - First string
 * @param {String} str2 - Second string
 * @returns {Number} - Similarity score (0-1)
 */
const calculateSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return 1.0;
    
    // Levenshtein distance for fuzzy matching
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
};

/**
 * Calculate Levenshtein distance
 * @param {String} str1 - First string
 * @param {String} str2 - Second string
 * @returns {Number} - Edit distance
 */
const getEditDistance = (str1, str2) => {
    const costs = [];
    
    for (let i = 0; i <= str1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= str2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
                    newValue = Math.min(
                        Math.min(newValue, lastValue),
                        costs[j]
                    ) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) {
            costs[str2.length] = lastValue;
        }
    }
    
    return costs[str2.length];
};

/**
 * Check if two products are duplicates
 * @param {Object} product1 - First product
 * @param {Object} product2 - Second product
 * @param {Number} threshold - Similarity threshold (0-1)
 * @returns {Boolean} - True if duplicates
 */
const areDuplicates = (product1, product2, threshold = 0.85) => {
    // Compare product names
    const nameSimilarity = calculateSimilarity(
        product1.productName,
        product2.productName
    );
    
    if (nameSimilarity >= threshold) {
        // Also check OEM if both are specified
        if (product1.oem !== 'Unspecified' && product2.oem !== 'Unspecified') {
            const oemSimilarity = calculateSimilarity(product1.oem, product2.oem);
            // If names match but OEMs are different, they're different products
            if (oemSimilarity < 0.5) {
                return false;
            }
        }
        return true;
    }
    
    return false;
};

/**
 * Deduplicate products list
 * @param {Array} products - Array of product objects
 * @param {Number} threshold - Similarity threshold (0-1)
 * @returns {Array} - Deduplicated products
 */
const deduplicateProducts = (products, threshold = 0.85) => {
    console.log(`🔄 Deduplicating ${products.length} products...`);
    
    if (products.length === 0) return products;
    
    const uniqueProducts = [];
    const duplicatesFound = [];
    
    for (const product of products) {
        let isDuplicate = false;
        
        for (const uniqueProduct of uniqueProducts) {
            if (areDuplicates(product, uniqueProduct, threshold)) {
                isDuplicate = true;
                duplicatesFound.push({
                    duplicate: product.productName,
                    original: uniqueProduct.productName,
                    similarity: calculateSimilarity(product.productName, uniqueProduct.productName)
                });
                
                // Merge data if duplicate has better information
                if (product.oem !== 'Unspecified' && uniqueProduct.oem === 'Unspecified') {
                    uniqueProduct.oem = product.oem;
                }
                if (product.specifications && !uniqueProduct.specifications) {
                    uniqueProduct.specifications = product.specifications;
                }
                if (product.confidence > uniqueProduct.confidence) {
                    uniqueProduct.confidence = product.confidence;
                }
                
                break;
            }
        }
        
        if (!isDuplicate) {
            uniqueProducts.push(product);
        }
    }
    
    console.log(`✅ Removed ${duplicatesFound.length} duplicates`);
    console.log(`   Final count: ${uniqueProducts.length} unique products`);
    
    if (duplicatesFound.length > 0 && duplicatesFound.length <= 10) {
        console.log(`   Duplicates found:`);
        duplicatesFound.forEach(dup => {
            console.log(`     - "${dup.duplicate}" → merged with "${dup.original}" (${Math.round(dup.similarity * 100)}% similar)`);
        });
    }
    
    return uniqueProducts;
};

/**
 * Remove exact duplicates (faster check for obvious duplicates)
 * @param {Array} products - Array of product objects
 * @returns {Array} - Products with exact duplicates removed
 */
const removeExactDuplicates = (products) => {
    console.log(`🔄 Removing exact duplicates from ${products.length} products...`);
    
    const seen = new Set();
    const uniqueProducts = [];
    let duplicateCount = 0;
    
    for (const product of products) {
        // Create a unique key from product name and OEM
        const key = `${product.productName.toLowerCase().trim()}|${product.oem.toLowerCase().trim()}`;
        
        if (!seen.has(key)) {
            seen.add(key);
            uniqueProducts.push(product);
        } else {
            duplicateCount++;
        }
    }
    
    console.log(`✅ Removed ${duplicateCount} exact duplicates`);
    console.log(`   Final count: ${uniqueProducts.length} unique products`);
    
    return uniqueProducts;
};

/**
 * Full deduplication pipeline
 * @param {Array} products - Array of product objects
 * @param {Object} options - Deduplication options
 * @returns {Object} - Deduplicated products with metadata
 */
const deduplicatePipeline = (products, options = {}) => {
    const {
        threshold = 0.85,
        removeExact = true,
        removeFuzzy = true
    } = options;
    
    console.log('\n🔧 Starting deduplication pipeline...');
    
    const initialCount = products.length;
    let processedProducts = [...products];
    
    // Step 1: Remove exact duplicates (fast)
    if (removeExact) {
        processedProducts = removeExactDuplicates(processedProducts);
    }
    
    // Step 2: Remove fuzzy duplicates (slower but more thorough)
    if (removeFuzzy) {
        processedProducts = deduplicateProducts(processedProducts, threshold);
    }
    
    const finalCount = processedProducts.length;
    const removedCount = initialCount - finalCount;
    
    console.log('\n✅ Deduplication complete!');
    console.log(`   Initial: ${initialCount} products`);
    console.log(`   Final: ${finalCount} products`);
    console.log(`   Removed: ${removedCount} duplicates`);
    
    return {
        products: processedProducts,
        metadata: {
            initialCount,
            finalCount,
            duplicatesRemoved: removedCount,
            deduplicationRate: initialCount > 0 ? (removedCount / initialCount * 100).toFixed(2) + '%' : '0%'
        }
    };
};

/**
 * Sort products by confidence/quality
 * @param {Array} products - Array of products
 * @returns {Array} - Sorted products (highest quality first)
 */
const sortProductsByQuality = (products) => {
    return products.sort((a, b) => {
        // Priority 1: Has OEM specified
        const aHasOEM = a.oem !== 'Unspecified' ? 1 : 0;
        const bHasOEM = b.oem !== 'Unspecified' ? 1 : 0;
        if (aHasOEM !== bHasOEM) return bHasOEM - aHasOEM;
        
        // Priority 2: Confidence score
        const aConf = a.confidence || 0;
        const bConf = b.confidence || 0;
        if (aConf !== bConf) return bConf - aConf;
        
        // Priority 3: Has specifications
        const aHasSpec = a.specifications ? 1 : 0;
        const bHasSpec = b.specifications ? 1 : 0;
        return bHasSpec - aHasSpec;
    });
};

module.exports = {
    deduplicateProducts,
    removeExactDuplicates,
    deduplicatePipeline,
    areDuplicates,
    calculateSimilarity,
    sortProductsByQuality
};

