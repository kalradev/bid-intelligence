const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Map a single BOQ row to structured product schema using LLM
 * This ensures consistent, validated output for each row
 * @param {Array} row - Table row data [col1, col2, col3, ...]
 * @param {Array} headers - Table headers
 * @param {String} documentContext - Brief document context for better mapping
 * @returns {Promise<Object>} - Mapped product object
 */
const mapRowToProduct = async (row, headers = [], documentContext = '') => {
    try {
        // Create a structured representation of the row
        const rowData = {};
        headers.forEach((header, index) => {
            if (row[index]) {
                rowData[header] = row[index];
            }
        });
        
        // If no headers, use positional data
        const rowText = headers.length > 0 
            ? JSON.stringify(rowData) 
            : row.join(' | ');
        
        const systemPrompt = `You are a BOQ (Bill of Quantities) and Product Specifications data mapper. Your task is to extract product information from table rows and map them to structured product objects.`;
        
        const userPrompt = `Extract product information from this table row.

**CONTEXT:** ${documentContext || 'RFP/Tender Document'}

**TABLE HEADERS:** ${headers.length > 0 ? headers.join(', ') : 'No headers provided'}

**ROW DATA:**
${rowText}

**TASK:**
Map this row to a structured product object. Extract:
1. Product name (the item description, model name, or product identifier)
2. Quantity (if present)
3. Unit (e.g., nos, units, pcs, meters)
4. OEM/Brand (if mentioned in row, otherwise return "Unspecified")
5. Model (extract specific model number/name if present in the row data. Look for model identifiers, product codes, or variant names. If product name is a model identifier like "Model 2", use that. If no model found, return "N/A")
6. Category (infer from product type: Hardware, Software, Civil, Electrical, Furniture, HVAC, Security, Networking, etc.)
7. Specifications (any technical details, performance metrics, features)

**SPECIAL HANDLING FOR SPECIFICATION TABLES:**
- If product name is "Model 1", "Model 2", "Model 3", etc., use that as the product name
- Extract all specifications from the row and include them in the specifications field
- For specification tables, the product name might be in the first column
- Look for model numbers, product codes, or variant names

**CRITICAL RULES:**
- Product name MUST be specific and real (NEVER "N/A", "Not Applicable", "Miscellaneous")
- Product names like "Model 1", "Model 2", "Product A", "Variant X" are VALID product names
- If OEM/Brand not in row, return "Unspecified" (do NOT guess)
- Category must be one of: Hardware, Software, Civil, Electrical, Furniture, HVAC, Security, Networking, Mechanical, Plumbing, Other
- If this row is NOT a product (e.g., header, total, page number, footer), mark isValid as false
- Mark isValid as false for: "Total", "Grand Total", "Sub Total", "Page", "Continued", headers, footers
- Mark isValid as true ONLY for actual product/item rows

**OUTPUT FORMAT (JSON only):**
{
  "productName": "string (specific product name)",
  "quantity": "number or string (if present)",
  "unit": "string (if present)",
  "oem": "string (OEM/brand if in row, else 'Unspecified')",
  "model": "string (CRITICAL: Extract specific model number/name if present in row data. Look for model identifiers, product codes, variant names. If product name is a model identifier like 'Model 2', use that. If no model found, use the product name itself as the model. NEVER return 'N/A')",
  "category": "string (one of the categories above)",
  "specifications": "string (any technical details from row)",
  "isValid": true/false (false if not a product row)
}

Return ONLY valid JSON. No markdown, no explanation.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Using GPT-4o-mini for cost efficiency
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.0, // ZERO temperature for 100% deterministic output
            max_tokens: 1000,
            response_format: { type: 'json_object' }
        });
        
        const responseText = completion.choices[0].message.content;
        
        // OpenAI returns JSON directly when response_format is json_object, but clean it anyway
        const cleanedResponse = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        
        // Parse JSON response
        const mappedProduct = JSON.parse(cleanedResponse);
        
        // DETERMINISTIC VALIDATION: Rule-based, not LLM decision
        const isValidProduct = validateProductRow(mappedProduct, row);
        
        if (!isValidProduct) {
            return null; // Skip invalid rows
        }
        
        // Extract model - ALWAYS return a model, never "N/A"
        let model = mappedProduct.model;
        
        // If LLM didn't extract model, try to extract it dynamically from OEM field
        if (!model || model === 'N/A' || model.trim() === '') {
            if (mappedProduct.oem && mappedProduct.oem !== 'Unspecified') {
                // Generic pattern: Look for alphanumeric model identifiers after brand name
                const oemParts = mappedProduct.oem.split('/').map(p => p.trim());
                for (const part of oemParts) {
                    const words = part.split(/\s+/);
                    if (words.length >= 2) {
                        // Skip first word (usually brand), check remaining for model patterns
                        for (let i = 1; i < words.length; i++) {
                            const potentialModel = words.slice(i).join(' ');
                            if (/[\w\-]+/.test(potentialModel) && potentialModel.length < 50 && potentialModel.length > 2) {
                                model = potentialModel.trim();
                                break;
                            }
                        }
                    }
                    if (model && model !== 'N/A') break;
                }
            }
        }
        
        // If product name is a model identifier (Model 1, Model 2, etc.), use it as model
        if ((!model || model === 'N/A' || model.trim() === '') && /^Model\s*\d+$/i.test(mappedProduct.productName)) {
            model = mappedProduct.productName;
        }
        
        // CRITICAL: Never return "N/A" - use product name as fallback if needed
        if (!model || model === 'N/A' || model.trim() === '') {
            model = mappedProduct.productName || 'Standard Model';
        }
        
        return {
            productName: mappedProduct.productName,
            quantity: mappedProduct.quantity || 'N/A',
            unit: mappedProduct.unit || 'N/A',
            oem: mappedProduct.oem || 'Unspecified',
            model: model,
            category: mappedProduct.category || 'Other',
            specifications: mappedProduct.specifications || '',
            miiStatus: 'Pending Classification', // Will be classified later
            confidence: 85, // High confidence from deterministic extraction
            source: 'table-extraction',
            rawRow: row // Keep original for reference
        };
        
    } catch (error) {
        console.error('❌ Error mapping row:', error.message);
        // Return a safe fallback instead of failing
        return {
            productName: row.join(' ').substring(0, 100), // Use raw row as fallback
            quantity: 'N/A',
            unit: 'N/A',
            oem: 'Unspecified',
            category: 'Other',
            specifications: '',
            miiStatus: 'Pending Classification',
            confidence: 40,
            source: 'fallback',
            rawRow: row,
            error: error.message
        };
    }
};

/**
 * Map multiple rows in parallel with rate limiting
 * @param {Array} rows - Array of table rows
 * @param {Array} headers - Table headers
 * @param {String} documentContext - Document context
 * @returns {Promise<Array>} - Array of mapped products
 */
const mapRowsToProducts = async (rows, headers = [], documentContext = '') => {
    console.log(`🔄 Mapping ${rows.length} rows to products...`);
    
    const products = [];
    const batchSize = 10; // Process 10 rows at a time to avoid rate limits
    
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)} (${batch.length} rows)`);
        
        // Process batch in parallel
        const batchPromises = batch.map(row => 
            mapRowToProduct(row, headers, documentContext)
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        // Filter out null results (invalid rows)
        const validProducts = batchResults.filter(p => p !== null);
        products.push(...validProducts);
        
        // Rate limiting: wait 1 second between batches
        if (i + batchSize < rows.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log(`✅ Successfully mapped ${products.length} valid products from ${rows.length} rows`);
    
    return products;
};

/**
 * DETERMINISTIC: Validate if a row is a valid product (rule-based, no LLM)
 * @param {Object} mappedProduct - Mapped product from LLM
 * @param {Array} rawRow - Original row data
 * @returns {Boolean} - True if valid product
 */
const validateProductRow = (mappedProduct, rawRow) => {
    // Rule 1: Must have isValid flag from LLM
    if (!mappedProduct.isValid) {
        return false;
    }
    
    // Rule 2: Must have product name
    if (!mappedProduct.productName || mappedProduct.productName.trim() === '') {
        return false;
    }
    
    // Rule 3: Check for invalid names (deterministic list)
    const invalidNames = [
        'n/a', 'not applicable', 'tbd', 'to be decided', 
        'miscellaneous', 'others', 'various', 
        'total', 'grand total', 'sub total', 'subtotal',
        'page', 'continued', 'cont.', 'header', 'footer',
        'item', 'description', 'quantity', 'rate', 'amount'
    ];
    
    const productNameLower = mappedProduct.productName.toLowerCase().trim();
    
    for (const invalidName of invalidNames) {
        if (productNameLower === invalidName || productNameLower.includes(invalidName)) {
            return false;
        }
    }
    
    // Rule 4: Product name must be at least 3 characters
    if (mappedProduct.productName.trim().length < 3) {
        return false;
    }
    
    // Rule 5: First column should be a number (S.No) in most BOQs
    if (rawRow && rawRow.length > 0) {
        const firstCol = rawRow[0].toString().trim();
        // If first column is not a number and not empty, might be header
        if (firstCol && !/^\d+\.?\d*$/.test(firstCol) && firstCol.length < 5) {
            // Could be header like "S.No", "Item", etc.
            if (['s.no', 'sr.no', 'item', 'sl.no', 'no.'].includes(firstCol.toLowerCase())) {
                return false;
            }
        }
    }
    
    return true;
};

/**
 * Validate product object against schema
 * @param {Object} product - Product object to validate
 * @returns {Boolean} - True if valid
 */
const validateProductSchema = (product) => {
    const requiredFields = ['productName', 'oem', 'category'];
    
    for (const field of requiredFields) {
        if (!product[field] || product[field] === 'N/A' || product[field] === '') {
            return false;
        }
    }
    
    // Use deterministic validation
    return validateProductRow(product, product.rawRow || []);
};

/**
 * Batch validate products
 * @param {Array} products - Array of product objects
 * @returns {Array} - Array of valid products
 */
const validateProducts = (products) => {
    console.log(`🔍 Validating ${products.length} products...`);
    
    const validProducts = products.filter(product => validateProductSchema(product));
    
    console.log(`✅ ${validProducts.length} products passed validation`);
    if (products.length > validProducts.length) {
        console.log(`⚠️ ${products.length - validProducts.length} products failed validation and were removed`);
    }
    
    return validProducts;
};

module.exports = {
    mapRowToProduct,
    mapRowsToProducts,
    validateProductSchema,
    validateProducts
};

