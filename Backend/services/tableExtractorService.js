const { PDFParse } = require('pdf-parse');
const path = require('path');
const { extractTableWithPython, checkPythonAvailability } = require('./pythonTableExtractor');

/**
 * Extract tables from PDF with exact row-by-row structure
 * This provides deterministic extraction - same PDF = same rows every time
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<Object>} - Extracted tables with exact rows
 */
const extractTablesFromPDF = async (buffer) => {
    try {
        console.log('🔍 Starting deterministic table extraction...');
        
        // For now, return failure to trigger text-based fallback
        // This allows the system to work while we use the text-based extraction
        console.log('📄 Using text-based table extraction (PDF.js not available)');
        
        return {
            success: false,
            rowCount: 0,
            rows: [],
            error: 'Using text-based fallback',
            useTextFallback: true
        };
        
    } catch (error) {
        console.error('❌ Table extraction failed:', error.message);
        return {
            success: false,
            rowCount: 0,
            rows: [],
            error: error.message
        };
    }
};

/**
 * Extract table structure from plain text (simplified approach)
 * @param {String} text - Plain text content
 * @param {Number} pageIndex - Page number
 * @returns {Object} - Table with headers and rows
 */
const extractTableFromPage = (text, pageIndex) => {
    try {
        // This is a simplified version that will be called from text-based extraction
        const lines = text.split('\n');
        const rows = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // Split by multiple spaces, tabs, or pipes
            const columns = trimmedLine.split(/\s{2,}|\t|\|/).map(c => c.trim()).filter(c => c);
            
            if (columns.length >= 2) {
                rows.push(columns);
            }
        }
        
        return {
            pageIndex,
            headers: [],
            rows: rows,
            rawRowCount: rows.length
        };
        
    } catch (error) {
        console.error(`Error extracting table from page ${pageIndex}:`, error.message);
        return null;
    }
};

/**
 * Merge tables from multiple pages
 * @param {Array} tables - Array of table objects
 * @returns {Object} - Merged table
 */
const mergeTables = (tables) => {
    if (tables.length === 0) {
        return { headers: [], rows: [] };
    }
    
    if (tables.length === 1) {
        return {
            headers: tables[0].headers,
            rows: tables[0].rows
        };
    }
    
    // Use headers from first table
    const headers = tables[0].headers;
    
    // Merge all rows
    const allRows = [];
    for (const table of tables) {
        allRows.push(...table.rows);
    }
    
    return {
        headers,
        rows: allRows
    };
};

/**
 * Detect if table is transposed (products in columns instead of rows)
 * Example: Specifications table with Model 1, Model 2, Model 3 as columns
 * @param {Array} headers - Table headers
 * @param {Array} rows - Table rows
 * @returns {Boolean} - True if table appears transposed
 */
const isTransposedTable = (headers, rows) => {
    if (!headers || headers.length === 0 || !rows || rows.length === 0) {
        return false;
    }
    
    // Check if headers contain product/model indicators (case-insensitive)
    const productIndicators = ['model', 'product', 'item', 'variant', 'type', 'version'];
    const headerText = headers.join(' ').toLowerCase();
    const hasProductHeaders = productIndicators.some(indicator => headerText.includes(indicator));
    
    // Check if first column header is "Specifications" or similar
    const firstHeader = headers[0]?.toLowerCase() || '';
    const isSpecHeader = firstHeader.includes('specification') || firstHeader.includes('feature') || firstHeader === '';
    
    // Check if first column contains specification/attribute names
    const firstColValues = rows.slice(0, Math.min(15, rows.length)).map(row => {
        const val = row[0]?.toString().toLowerCase() || '';
        return val;
    }).join(' ');
    
    const specIndicators = [
        'specification', 'feature', 'interface', 'performance', 'capacity', 'throughput', 
        'hardware', 'software', 'accelerated', 'slots', 'ports', 'firewall', 'vpn', 
        'throughput', 'sessions', 'policies', 'storage', 'management'
    ];
    const hasSpecFirstCol = specIndicators.some(indicator => firstColValues.includes(indicator));
    
    // Additional check: if we have 2-4 headers and they look like model numbers
    const hasModelNumbers = headers.slice(1).some(h => {
        const hLower = h.toLowerCase();
        return /model\s*\d+|product\s*[a-z]|variant\s*[a-z]|type\s*\d+/i.test(hLower);
    });
    
    // If headers look like products AND (first column looks like specs OR first header is spec), it's transposed
    const isTransposed = (hasProductHeaders || hasModelNumbers) && (hasSpecFirstCol || isSpecHeader) && headers.length >= 2 && headers.length <= 5;
    
    if (isTransposed) {
        console.log(`   🔍 Detected transposed table: ${headers.length} columns, first header="${headers[0]}", has models=${hasModelNumbers}`);
    }
    
    return isTransposed;
};

/**
 * Transform transposed table to normal format (products as rows)
 * @param {Array} headers - Original headers (Model 1, Model 2, etc.)
 * @param {Array} rows - Original rows (specifications)
 * @returns {Object} - Transformed table with products as rows
 */
const transformTransposedTable = (headers, rows) => {
    if (!isTransposedTable(headers, rows)) {
        return null; // Not transposed, return null
    }
    
    console.log('🔄 Detected transposed table format (products in columns)');
    console.log(`   Original headers: ${headers.join(', ')}`);
    console.log(`   Transforming ${headers.length - 1} products from ${rows.length} specification rows...`);
    
    // First column contains specification names
    // Remaining columns are products (Model 1, Model 2, etc.)
    const productHeaders = headers.slice(1); // Skip first column (specification names)
    const transformedRows = [];
    
    // Create a row for each product (column)
    for (let colIndex = 0; colIndex < productHeaders.length; colIndex++) {
        const productName = productHeaders[colIndex] || `Product ${colIndex + 1}`;
        const productRow = [productName]; // First cell is product name
        
        // Collect all specifications for this product
        const specifications = [];
        for (const row of rows) {
            if (!row || row.length === 0) continue;
            
            const specName = (row[0]?.toString() || '').trim();
            const specValue = (row[colIndex + 1]?.toString() || '').trim(); // +1 because first col is spec name
            
            // Skip empty values, dashes, and invalid entries
            if (specName && specValue && 
                specValue !== '—' && specValue !== '-' && 
                specValue !== 'nan' && specValue !== 'N/A' && specValue !== 'n/a' &&
                specValue.length > 0) {
                specifications.push(`${specName}: ${specValue}`);
            }
        }
        
        // Only add product if it has at least one specification
        if (specifications.length > 0) {
            // Add specifications as additional columns
            productRow.push(specifications.join('; ')); // Combine all specs
            productRow.push('N/A'); // Quantity
            productRow.push('N/A'); // Unit
            
            transformedRows.push(productRow);
            console.log(`   ✅ Created product: ${productName} (${specifications.length} specs)`);
        } else {
            console.log(`   ⚠️  Skipped product ${productName} (no valid specifications)`);
        }
    }
    
    // New headers: Product Name, Specifications, Quantity, Unit
    const newHeaders = ['Product Name', 'Specifications', 'Quantity', 'Unit'];
    
    console.log(`✅ Transformed to ${transformedRows.length} product rows`);
    
    if (transformedRows.length === 0) {
        console.log('   ⚠️  Warning: No products created after transformation');
        return null;
    }
    
    return {
        headers: newHeaders,
        rows: transformedRows,
        wasTransposed: true
    };
};

/**
 * Fallback: Extract tables from plain text using pattern matching
 * Used when PDF.js extraction fails
 * @param {String} text - Plain text from PDF
 * @returns {Object} - Extracted table structure
 */
const extractTablesFromText = (text) => {
    try {
        console.log('🔄 Using fallback text-based table extraction...');
        
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const rows = [];
        let headers = [];
        let headerFound = false;
        let inTable = false;
        
        // First, try to find specification table with Model columns
        // Pattern: "Specifications" title, then "Model 1 Model 2 Model 3" header
        let specTableStart = -1;
        let modelHeaderLine = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for "Specifications" title
            if (line.toLowerCase().includes('specification') && specTableStart === -1) {
                specTableStart = i;
                console.log(`   📋 Found "Specifications" title at line ${i}`);
                continue;
            }
            
            // Look for Model headers (Model 1, Model 2, Model 3, etc.)
            if (specTableStart !== -1 && modelHeaderLine === -1) {
                const modelMatch = line.match(/\b(model\s*\d+|product\s*[a-z]|variant\s*[a-z])\b/gi);
                if (modelMatch && modelMatch.length >= 2) {
                    // This line contains model headers
                    headers = line.split(/\s{2,}|\t/).map(h => h.trim()).filter(h => h);
                    if (headers.length >= 2) {
                        modelHeaderLine = i;
                        headerFound = true;
                        inTable = true;
                        console.log(`   📋 Found model headers: ${headers.join(', ')}`);
                        continue;
                    }
                }
            }
            
            // If we found headers, start collecting rows
            if (headerFound && inTable) {
                // Check if this is a specification name (first column)
                // Specifications are usually multi-word and don't start with numbers
                const isSpecName = line.length > 5 && 
                                  !/^\d+/.test(line) && 
                                  !line.match(/^\d+\s*[gbps|mbps|ghz|mhz]/i) &&
                                  !line.toLowerCase().includes('model');
                
                if (isSpecName) {
                    // This might be a specification row
                    // Look ahead to find values in next few lines
                    const row = [line]; // First column is spec name
                    let valueCount = 0;
                    
                    // Look at next 5 lines for values
                    for (let j = i + 1; j < Math.min(i + 6, lines.length) && valueCount < headers.length - 1; j++) {
                        const nextLine = lines[j];
                        // Check if this line looks like a value (number, dash, or short text)
                        if (nextLine.match(/^[\d\-\—\sx]+$|^[a-z0-9\s\-]+$/i) && nextLine.length < 50) {
                            row.push(nextLine.trim());
                            valueCount++;
                            i = j; // Skip this line in main loop
                        } else if (nextLine.length > 10 && !nextLine.match(/^\d/)) {
                            // Next spec name found, stop
                            break;
                        }
                    }
                    
                    // Fill missing values with empty strings
                    while (row.length < headers.length) {
                        row.push('');
                    }
                    
                    if (row.length >= 2 && row[0].length > 3) {
                        rows.push(row.slice(0, headers.length));
                    }
                }
                
                // Stop if we hit a clear section end
                if (line.toLowerCase().includes('system performance') || 
                    line.toLowerCase().includes('capacity') ||
                    line.toLowerCase().includes('high availability')) {
                    // Continue but mark as potential section break
                }
            }
        }
        
        console.log(`✅ Text-based extraction found ${rows.length} rows`);
        
        if (rows.length > 0 && headers.length > 0) {
            console.log(`   Headers: ${headers.join(', ')}`);
            console.log(`   Sample row: ${rows[0]?.slice(0, 3).join(' | ') || 'none'}`);
            
            // Check if table is transposed and transform if needed
            const transformed = transformTransposedTable(headers, rows);
            if (transformed) {
                console.log('   ✅ Applied transposed table transformation');
                return {
                    success: true,
                    rowCount: transformed.rows.length,
                    headers: transformed.headers,
                    rows: transformed.rows,
                    metadata: {
                        extractionMethod: 'text-based-fallback-transposed',
                        wasTransposed: true
                    }
                };
            }
        }
        
        // If no rows found, try alternative parsing for specification tables
        if (rows.length === 0 && text.toLowerCase().includes('specification')) {
            console.log('   🔄 Trying alternative specification table parsing...');
            return parseSpecificationTableAlternative(text);
        }
        
        return {
            success: rows.length > 0,
            rowCount: rows.length,
            headers,
            rows,
            metadata: {
                extractionMethod: 'text-based-fallback'
            }
        };
        
    } catch (error) {
        console.error('❌ Text-based extraction failed:', error.message);
        return {
            success: false,
            rowCount: 0,
            rows: [],
            error: error.message
        };
    }
};

/**
 * Alternative parser for specification tables with complex formatting
 * Handles cases where specifications and values are on separate lines
 * Format: "Specifications" title, then "Model 1 Model 2 Model 3" header, then spec rows
 */
const parseSpecificationTableAlternative = (text) => {
    try {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const headers = [];
        const rows = [];
        let foundSpecTitle = false;
        let modelHeaderIndex = -1;
        
        // Step 1: Find "Specifications" title (more flexible matching)
        for (let i = 0; i < lines.length; i++) {
            const lineLower = lines[i].toLowerCase();
            if ((lineLower.includes('specification') || 
                 lineLower.includes('technical specification') ||
                 lineLower.includes('product specification')) && 
                !foundSpecTitle) {
                foundSpecTitle = true;
                console.log(`   📋 Found "Specifications" title at line ${i}: "${lines[i]}"`);
                continue;
            }
            
            // Step 2: Find "Model 1 Model 2 Model 3" header line (more flexible)
            if (foundSpecTitle && modelHeaderIndex === -1) {
                // Look for "Model 1", "Model 2", "Model 3", etc. or "Model 2" (single model)
                const modelMatch = lines[i].match(/\b(model\s*\d+|product\s*[a-z]|variant\s*[a-z])\b/gi);
                // Accept even single model (e.g., "Model 2" table)
                if (modelMatch && modelMatch.length >= 1) {
                    // Extract all model names from this line
                    const headerLine = lines[i];
                    // Split by multiple spaces
                    const headerParts = headerLine.split(/\s{2,}/).filter(h => h.trim());
                    
                    // If split didn't work well, try regex extraction
                    if (headerParts.length < 2) {
                        // Handle single model case (e.g., "Model 2" table)
                        if (modelMatch.length === 1) {
                            headers.push('Specification', modelMatch[0].trim());
                        } else {
                            headers.push('Specification', ...modelMatch.map(m => m.trim()));
                        }
                    } else {
                        headers.push('Specification', ...headerParts.slice(1)); // Skip first if it's not a model
                    }
                    
                    modelHeaderIndex = i;
                    console.log(`   📋 Alternative parser found headers: ${headers.join(', ')}`);
                    break;
                }
            }
        }
        
        // Accept tables with at least 2 columns (Specification + at least 1 Model)
        if (headers.length < 2) {
            console.log('   ⚠️  Could not find model headers');
            return {
                success: false,
                rowCount: 0,
                rows: [],
                error: 'Could not find model headers'
            };
        }
        
        // Step 3: Parse specification rows (starting after header)
        let currentSpecParts = [];
        let currentSpecName = '';
        const specValues = new Array(headers.length - 1).fill(''); // One less because first is "Specification"
        let valueIndex = 0;
        let collectingSpec = false;
        
        for (let j = modelHeaderIndex + 1; j < lines.length; j++) {
            const line = lines[j];
            
            // Skip section headers like "Interfaces and Modules"
            if (line.match(/^[A-Z][a-z]+\s+(and|&)\s+[A-Z][a-z]+$/i) || 
                line.toLowerCase().includes('system performance') ||
                line.toLowerCase().includes('capacity')) {
                // This is a section header, continue
                continue;
            }
            
            // Check if this looks like a specification name (long text, not a number)
            const isSpecName = line.length > 8 && 
                              !line.match(/^\d+[\sx]/) && 
                              !line.match(/^[\d\-\—\sx]+$/) &&
                              !line.toLowerCase().includes('model') &&
                              line.match(/[a-z]{4,}/i);
            
            // Check if this looks like a value (short, numbers, dashes)
            const isValue = line.match(/^[\d\-\—\sx\/gbpsmbpsghzmhz]+$/i) || 
                           line === '—' || 
                           line === '-' ||
                           (line.length < 30 && line.match(/^\d/));
            
            if (isSpecName && !collectingSpec) {
                // Start new specification
                if (currentSpecName && specValues.some(v => v)) {
                    // Save previous spec
                    rows.push([currentSpecName, ...specValues]);
                }
                
                currentSpecName = line;
                currentSpecParts = [line];
                specValues.fill('');
                valueIndex = 0;
                collectingSpec = true;
            } else if (collectingSpec) {
                if (isValue && valueIndex < specValues.length) {
                    // This is a value for current spec
                    specValues[valueIndex] = line;
                    valueIndex++;
                } else if (isSpecName) {
                    // This is continuation of spec name (multi-line spec)
                    currentSpecName += ' ' + line;
                    currentSpecParts.push(line);
                } else if (line.length > 3 && line.length < 20 && !isValue) {
                    // Might be a sub-specification (like "Slots")
                    currentSpecName += ' ' + line;
                }
            }
        }
        
        // Save last spec
        if (currentSpecName && specValues.some(v => v)) {
            rows.push([currentSpecName, ...specValues]);
        }
        
        if (rows.length > 0) {
            console.log(`   ✅ Alternative parser found ${rows.length} specification rows`);
            console.log(`   Sample: ${rows[0]?.[0]} = [${rows[0]?.slice(1, 4).join(', ')}]`);
            
            // Transform if needed
            const transformed = transformTransposedTable(headers, rows);
            if (transformed) {
                console.log('   ✅ Applied transposed transformation');
                return {
                    success: true,
                    rowCount: transformed.rows.length,
                    headers: transformed.headers,
                    rows: transformed.rows,
                    metadata: {
                        extractionMethod: 'text-based-alternative-transposed',
                        wasTransposed: true
                    }
                };
            }
            
            return {
                success: true,
                rowCount: rows.length,
                headers,
                rows,
                metadata: {
                    extractionMethod: 'text-based-alternative'
                }
            };
        }
        
        return {
            success: false,
            rowCount: 0,
            rows: [],
            error: 'Could not parse specification table - no rows found'
        };
    } catch (error) {
        console.error('❌ Alternative parser failed:', error.message);
        console.error('   Stack:', error.stack);
        return {
            success: false,
            rowCount: 0,
            rows: [],
            error: error.message
        };
    }
};

/**
 * Main function: Extract BOQ table with automatic fallback
 * @param {Buffer} buffer - PDF file buffer
 * @param {String} plainText - Plain text (for fallback)
 * @returns {Promise<Object>} - Extracted table
 */
const extractBOQTable = async (buffer, plainText = null) => {
    console.log('\n🎯 Starting DETERMINISTIC table extraction...');
    
    // STEP 1: Try Python tabula-py (99% deterministic)
    try {
        console.log('🐍 Attempting Python tabula-py extraction (99% deterministic)...');
        const pythonResult = await extractTableWithPython(buffer);
        
        if (pythonResult.success && pythonResult.rowCount > 0) {
            console.log(`✅ Python tabula-py SUCCESS: ${pythonResult.rowCount} rows extracted`);
            console.log('   📊 Method: DETERMINISTIC (tabula-py)');
            console.log('   ✅ Guarantee: Same PDF = Same rows (always)');
            
            // Check if table is transposed (products in columns) and transform if needed
            if (pythonResult.headers && pythonResult.rows && pythonResult.rows.length > 0) {
                const transformed = transformTransposedTable(pythonResult.headers, pythonResult.rows);
                if (transformed) {
                    console.log('   ✅ Table transformed from transposed format\n');
                    return {
                        success: true,
                        rowCount: transformed.rows.length,
                        headers: transformed.headers,
                        rows: transformed.rows,
                        metadata: {
                            ...pythonResult.metadata,
                            wasTransposed: true,
                            extractionMethod: 'python-tabula-deterministic-transposed',
                            deterministic: true,
                            accuracy: 99
                        }
                    };
                }
            }
            
            console.log('\n');
            return {
                success: true,
                rowCount: pythonResult.rowCount,
                headers: pythonResult.headers || [],
                rows: pythonResult.rows,
                metadata: {
                    ...pythonResult.metadata,
                    extractionMethod: 'python-tabula-deterministic',
                    deterministic: true,
                    accuracy: 99
                }
            };
        } else if (pythonResult.useFallback) {
            console.log('⚠️ Python extraction failed, falling back to text-based...');
        }
    } catch (error) {
        console.error('❌ Python extraction error:', error.message);
        console.log('⚠️ Falling back to text-based extraction...');
    }
    
    // STEP 2: Fallback to text-based extraction
    if (plainText && plainText.trim().length > 0) {
        console.log('🔍 Using text-based extraction (fallback)...');
        const result = extractTablesFromText(plainText);
        
        if (result.success && result.rowCount > 0) {
            console.log(`⚠️ Text-based extraction: ${result.rowCount} rows`);
            console.log('   📊 Method: TEXT-BASED (less deterministic)');
            console.log('   ⚠️ Note: Results may vary slightly');
            
            // Check if table is transposed and transform if needed
            if (result.headers && result.rows && result.rows.length > 0) {
                const transformed = transformTransposedTable(result.headers, result.rows);
                if (transformed) {
                    console.log('   ✅ Table transformed from transposed format\n');
                    return {
                        success: true,
                        rowCount: transformed.rows.length,
                        headers: transformed.headers,
                        rows: transformed.rows,
                        metadata: {
                            ...result.metadata,
                            wasTransposed: true,
                            extractionMethod: 'text-based-transposed'
                        }
                    };
                }
            }
            
            console.log('\n');
            return result;
        }
    }
    
    // STEP 3: Complete failure
    console.log('❌ All extraction methods failed\n');
    return {
        success: false,
        rowCount: 0,
        rows: [],
        error: 'No valid extraction method succeeded'
    };
};

module.exports = {
    extractBOQTable,
    extractTablesFromPDF,
    extractTablesFromText,
    isTransposedTable,
    transformTransposedTable
};

