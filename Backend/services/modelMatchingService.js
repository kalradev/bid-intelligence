/**
 * Model Matching Service
 * Finds specific OEM models that match product specifications
 * Supports both single and multiple OEMs
 * Uses OpenAI API for model matching (paid account with generous limits)
 */

const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Process items in batches with rate limiting to avoid API quota issues
 * Processes max 10 items in parallel (OpenAI paid account), then waits 60 seconds before next batch
 * @param {Array} items - Array of items to process
 * @param {Function} processFn - Async function to process each item: (item) => Promise<result>
 * @param {String} itemLabel - Label for logging (e.g., "OEMs", "products")
 * @returns {Promise<Array>} - Array of results in same order as items
 */
const processInBatchesWithDelay = async (items, processFn, itemLabel = 'items') => {
    if (items.length === 0) return [];
    
    const BATCH_SIZE = 10; // Maximum 10 parallel API calls (OpenAI paid account)
    const DELAY_MS = 60000; // 60 seconds delay between batches
    
    const results = [];
    const totalBatches = Math.ceil(items.length / BATCH_SIZE);
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        
        console.log(`   📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} ${itemLabel})...`);
        
        // Process batch in parallel (max 10 at a time for OpenAI)
        const batchPromises = batch.map(item => processFn(item));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Wait 60 seconds before next batch (except for the last batch)
        if (i + BATCH_SIZE < items.length) {
            console.log(`   ⏳ Waiting 60 seconds before next batch to avoid rate limits...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }
    
    return results;
};

/**
 * Find model that matches specifications for a given OEM
 * @param {String} productName - Product name
 * @param {String} oem - OEM/manufacturer name
 * @param {String} specifications - Product specifications
 * @param {String} category - Product category
 * @returns {Promise<Object>} - Matched model with confidence
 */
const findModelForOEM = async (productName, oem, specifications, category) => {
    try {
        console.log(`   🔍 Finding model for: ${productName} (OEM: ${oem})`);
        
        const systemPrompt = `You are a product specification expert. Your task is to find specific product models that match given requirements. Always return actual model numbers that exist in the market. Never return generic names like "Standard Model".`;
        
        const userPrompt = `Find the specific ${oem} model/product number that best matches these requirements:

**PRODUCT:** ${productName}
**OEM/MANUFACTURER:** ${oem}
**CATEGORY:** ${category}
**SPECIFICATIONS:** ${specifications || 'Not specified'}

**CRITICAL INSTRUCTIONS:**
1. ALWAYS return a SPECIFIC model number/name (NEVER return "Standard Model" or generic names)
2. Use actual product model numbers that exist in the market
3. If specifications are minimal, suggest the most popular/standard model from that OEM
4. The model MUST match the product category and OEM
5. Return actual model numbers like "FortiGate 600E", "Cisco Catalyst 2960-X", NOT generic names

**EXAMPLES OF CORRECT OUTPUTS:**
- Product: "Firewall", OEM: "Fortinet" → "FortiGate 600E" ✅
- Product: "Firewall", OEM: "Palo Alto" → "PA-5220" ✅
- Product: "Router", OEM: "Cisco" → "Cisco ISR 4000 Series" ✅
- Product: "Server", OEM: "Dell" → "Dell PowerEdge R740" ✅
- Product: "Switch", OEM: "Cisco" → "Cisco Catalyst 2960-X" ✅
- Product: "SIEM", OEM: "Splunk" → "Splunk Enterprise" ✅
- Product: "Endpoint Protection", OEM: "Symantec" → "Symantec Endpoint Protection 14.3" ✅
- Product: "Vulnerability Scanner", OEM: "Qualys" → "Qualys VMDR" ✅

**WRONG OUTPUTS (NEVER DO THIS):**
- "Standard Model" ❌
- "Fortinet Standard Model" ❌
- "Generic Firewall" ❌
- "Server" ❌

**OUTPUT FORMAT (JSON only):**
{
  "modelNumber": "string (MUST be specific model like 'FortiGate 600E', NOT 'Standard Model')",
  "matchConfidence": number (0-100, how well it matches specs),
  "reasoning": "string (brief explanation of why this model)"
}

Return ONLY valid JSON. No markdown, no explanation.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Using GPT-4o-mini for cost efficiency while maintaining quality
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.0, // Deterministic matching
            max_tokens: 500,
            response_format: { type: 'json_object' }
        });
        
        const responseText = completion.choices[0].message.content;
        
        // Clean response
        const cleanedResponse = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        
        const matched = JSON.parse(cleanedResponse);
        
        // Validate that we got a real model number (not generic)
        if (!matched.modelNumber || 
            matched.modelNumber.toLowerCase().includes('standard model') ||
            matched.modelNumber.toLowerCase() === 'n/a' ||
            matched.modelNumber.toLowerCase() === 'unknown') {
            
            console.warn(`   ⚠️ AI returned generic model, using intelligent fallback`);
            const fallbackModel = getQuickModelFallback(productName, oem, category);
            return {
                model: fallbackModel,
                confidence: 70,
                source: 'intelligent-fallback',
                reasoning: 'Using category-specific model recommendation'
            };
        }
        
        console.log(`   ✅ Matched model: ${matched.modelNumber} (confidence: ${matched.matchConfidence}%)`);
        
        return {
            model: matched.modelNumber,
            confidence: matched.matchConfidence || 80,
            source: 'spec-matched',
            reasoning: matched.reasoning || 'Matched to specifications'
        };
        
    } catch (error) {
        console.error(`   ❌ Model matching error for ${productName}:`, error.message);
        const fallbackModel = getQuickModelFallback(productName, oem, category);
        return {
            model: fallbackModel,
            confidence: 70,
            source: 'intelligent-fallback',
            reasoning: 'Using category-specific model recommendation'
        };
    }
};

/**
 * Find models for MULTIPLE OEMs (e.g., "VMware / Splunk / ServiceNow")
 * Returns the best model for each OEM
 * @param {String} productName - Product name
 * @param {String} oemsString - OEMs separated by " / "
 * @param {String} specifications - Product specifications
 * @param {String} category - Product category
 * @returns {Promise<Object>} - Models for each OEM
 */
const findModelsForMultipleOEMs = async (productName, oemsString, specifications, category) => {
    try {
        // Split OEMs by " / " separator
        const oems = oemsString.split(' / ').map(oem => oem.trim()).filter(oem => oem.length > 0);
        
        console.log(`   🎯 Finding models for ${oems.length} OEMs: ${oems.join(', ')}`);
        
        // Find model for each OEM in batches (max 3 parallel, 60s delay between batches)
        const processOEM = async (oem) => {
            const modelInfo = await findModelForOEM(productName, oem, specifications, category);
            return {
                oem: oem,
                ...modelInfo
            };
        };
        
        const allModels = await processInBatchesWithDelay(oems, processOEM, 'OEMs');
        
        // Find the best model (highest confidence)
        const bestModel = allModels.reduce((best, current) => {
            return (current.confidence > best.confidence) ? current : best;
        }, allModels[0]);
        
        // Format all models for display
        const modelsDisplay = allModels.map(m => `${m.model}`).join(' / ');
        
        console.log(`   ✅ Best model: ${bestModel.model} (${bestModel.oem}, ${bestModel.confidence}%)`);
        
        return {
            model: modelsDisplay,  // Display all models
            bestModel: bestModel.model,
            bestOEM: bestModel.oem,
            confidence: bestModel.confidence,
            source: 'multi-oem-matched',
            allModels: allModels,  // Keep all model info
            reasoning: `Best: ${bestModel.model} from ${bestModel.oem}`
        };
        
    } catch (error) {
        console.error(`   ❌ Multi-OEM model matching error:`, error.message);
        return {
            model: 'Standard Model',
            confidence: 50,
            source: 'error-fallback',
            reasoning: 'Error matching models for multiple OEMs'
        };
    }
};

/**
 * Search web for OEM and model based on specifications
 * @param {String} productName - Product name
 * @param {String} specifications - Product specifications
 * @param {String} category - Product category
 * @returns {Promise<Object>} - OEM + Model match from web search
 */
const searchOEMAndModel = async (productName, specifications, category) => {
    try {
        console.log(`   🌐 Searching OEM + Model for: ${productName}`);
        
        const systemPrompt = `You are a product research expert. Your task is to recommend the best OEM (manufacturer) and specific model number for products based on specifications. Always return real, established manufacturers and actual model numbers that exist in the market.`;
        
        const userPrompt = `Find the best OEM and model for this product based on specifications:

**PRODUCT:** ${productName}
**CATEGORY:** ${category}
**SPECIFICATIONS:** ${specifications || 'Standard specifications'}

**CRITERIA:**
1. OEM must be a real, established manufacturer in this category
2. Model must be a specific product that matches the specifications
3. Choose industry-leading or commonly used options
4. Ensure specifications are met or exceeded
5. Provide actual model numbers (not generic names)

**CATEGORY-SPECIFIC GUIDANCE:**
- Security Software: Consider Palo Alto, Fortinet, Check Point, Cisco, etc.
- Hardware: Consider Dell, HP, Cisco, Lenovo, etc.
- Networking: Consider Cisco, Juniper, HPE Aruba, etc.
- Storage: Consider NetApp, Dell EMC, HPE, IBM, etc.

**OUTPUT FORMAT (JSON only):**
{
  "oem": "string (full OEM company name)",
  "model": "string (specific model number/name)",
  "matchConfidence": number (0-100),
  "miiStatus": "string (Indian OEM or Global OEM)",
  "reasoning": "string (why this OEM + model)",
  "alternatives": [
    {"oem": "string", "model": "string", "confidence": number}
  ]
}

Return ONLY valid JSON. No markdown, no explanation.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Using GPT-4o-mini for cost efficiency
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.0,
            max_tokens: 800,
            response_format: { type: 'json_object' }
        });
        
        const responseText = completion.choices[0].message.content;
        
        // OpenAI returns JSON directly when response_format is json_object, but clean it anyway
        const cleanedResponse = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        
        const searchResult = JSON.parse(cleanedResponse);
        
        console.log(`   ✅ Found: ${searchResult.oem} ${searchResult.model}`);
        
        return {
            oem: searchResult.oem || 'Unspecified',
            model: searchResult.model || 'Standard Model',
            confidence: searchResult.matchConfidence || 75,
            miiStatus: searchResult.miiStatus || 'Global OEM',
            source: 'web-search',
            reasoning: searchResult.reasoning || 'Based on category and specifications',
            alternatives: searchResult.alternatives || []
        };
        
    } catch (error) {
        console.error(`   ❌ Web search error for ${productName}:`, error.message);
        return {
            oem: 'Unspecified',
            model: 'Standard Model',
            confidence: 50,
            miiStatus: 'Requires Review',
            source: 'error-fallback',
            reasoning: 'Error in web search'
        };
    }
};

/**
 * Complete OEM + Model enrichment for a single product
 * Handles both single and multiple OEMs
 * @param {Object} product - Product object
 * @returns {Promise<Object>} - Enriched product with OEM + Model
 */
const enrichProductWithModel = async (product) => {
    try {
        const { productName, oem, specifications, category } = product;
        
        // Check if this is multiple OEMs (contains " / ")
        const isMultipleOEMs = oem && oem.includes(' / ');
        
        // CASE 1: Multiple OEMs specified (e.g., "VMware / Splunk / ServiceNow")
        if (isMultipleOEMs) {
            console.log(`   🎯 Multiple OEMs detected: ${oem}`);
            
            const modelsInfo = await findModelsForMultipleOEMs(
                productName,
                oem,
                specifications,
                category
            );
            
            return {
                ...product,
                model: modelsInfo.model,  // "VMware vSphere / Splunk Enterprise / ServiceNow ITSM"
                bestModel: modelsInfo.bestModel,
                bestOEM: modelsInfo.bestOEM,
                modelConfidence: modelsInfo.confidence,
                modelSource: 'multi-oem-spec-matched',
                modelReasoning: modelsInfo.reasoning,
                allModels: modelsInfo.allModels
            };
        }
        
        // CASE 2: Single OEM specified in document
        else if (oem && oem !== 'Unspecified' && oem.trim() !== '') {
            console.log(`   📄 Single OEM from document: ${oem}`);
            
            // Find matching model for this OEM
            const modelMatch = await findModelForOEM(
                productName,
                oem,
                specifications,
                category
            );
            
            return {
                ...product,
                model: modelMatch.model,
                modelConfidence: modelMatch.confidence,
                modelSource: 'document-oem-spec-matched',
                modelReasoning: modelMatch.reasoning
            };
        }
        
        // CASE 3: OEM not specified - web search for both OEM + Model
        else {
            console.log(`   🌐 Searching web for OEM + Model`);
            
            const searchResult = await searchOEMAndModel(
                productName,
                specifications,
                category
            );
            
            return {
                ...product,
                oem: searchResult.oem,
                model: searchResult.model,
                modelConfidence: searchResult.confidence,
                miiStatus: searchResult.miiStatus,
                modelSource: 'web-search',
                modelReasoning: searchResult.reasoning,
                alternatives: searchResult.alternatives
            };
        }
        
    } catch (error) {
        console.error(`   ❌ Error enriching ${product.productName}:`, error.message);
        return {
            ...product,
            model: 'Standard Model',
            modelConfidence: 50,
            modelSource: 'error-fallback'
        };
    }
};

/**
 * Enrich multiple products with OEM + Model in parallel
 * @param {Array} products - Array of products
 * @returns {Promise<Array>} - Enriched products with models
 */
const enrichProductsWithModels = async (products) => {
    console.log(`\n🏭 Starting OEM + Model enrichment for ${products.length} products...`);
    
    // Use batching utility (max 10 parallel, 60s delay between batches)
    // Each product enrichment may trigger multiple OpenAI API calls internally,
    // so we limit product-level parallelism to 10 for OpenAI paid account
    const processProduct = async (product) => enrichProductWithModel(product);
    const enrichedProducts = await processInBatchesWithDelay(products, processProduct, 'products');
    
    console.log(`\n✅ Model enrichment complete! ${enrichedProducts.length} products processed`);
    
    // Calculate statistics
    const withDocumentOEM = enrichedProducts.filter(p => p.modelSource === 'document-oem-spec-matched').length;
    const withWebSearchOEM = enrichedProducts.filter(p => p.modelSource === 'web-search').length;
    const withMultipleOEMs = enrichedProducts.filter(p => p.modelSource === 'multi-oem-spec-matched').length;
    const avgConfidence = enrichedProducts.reduce((sum, p) => sum + (p.modelConfidence || 0), 0) / enrichedProducts.length;
    
    console.log(`\n📊 Model Matching Statistics:`);
    console.log(`   Single OEM from document: ${withDocumentOEM} products`);
    console.log(`   Multiple OEMs with models: ${withMultipleOEMs} products`);
    console.log(`   OEM from web search: ${withWebSearchOEM} products`);
    console.log(`   Average match confidence: ${Math.round(avgConfidence)}%`);
    
    return enrichedProducts;
};

/**
 * Quick model lookup for common products (deterministic fallback)
 * Returns SPECIFIC model numbers, never generic "Standard Model"
 * @param {String} productName - Product name
 * @param {String} oem - OEM name
 * @param {String} category - Category
 * @returns {String} - Specific model name
 */
const getQuickModelFallback = (productName, oem, category) => {
    const productLower = productName.toLowerCase();
    const oemLower = oem.toLowerCase();
    const categoryLower = (category || '').toLowerCase();
    
    // ============================================
    // CABLES & ACCESSORIES (HANDLE FIRST)
    // ============================================
    
    // ANKER
    if (oemLower.includes('anker')) {
        if (productLower.includes('usb') && productLower.includes('type-c')) return 'Anker PowerLine III USB-C to USB-C';
        if (productLower.includes('usb') && productLower.includes('3.0')) return 'Anker PowerLine USB 3.0';
        if (productLower.includes('usb') && productLower.includes('2.0')) return 'Anker PowerLine USB 2.0';
        if (productLower.includes('hdmi')) return 'Anker High-Speed HDMI 2.0';
        return 'Anker PowerLine Cable';
    }
    
    // BELKIN
    if (oemLower.includes('belkin')) {
        if (productLower.includes('usb') && productLower.includes('type-c')) return 'Belkin BoostCharge USB-C Cable';
        if (productLower.includes('usb') && productLower.includes('3.0')) return 'Belkin USB 3.0 Cable';
        if (productLower.includes('hdmi')) return 'Belkin Ultra HD HDMI Cable';
        if (productLower.includes('network') || productLower.includes('ethernet')) return 'Belkin Cat6 Ethernet Cable';
        return 'Belkin Cable';
    }
    
    // CABLE MATTERS
    if (oemLower.includes('cable matters')) {
        if (productLower.includes('usb')) return 'Cable Matters USB Cable';
        if (productLower.includes('hdmi')) return 'Cable Matters HDMI 2.0 Cable';
        if (productLower.includes('displayport')) return 'Cable Matters DisplayPort Cable';
        if (productLower.includes('ethernet')) return 'Cable Matters Cat6 Cable';
        return 'Cable Matters Cable';
    }
    
    // STARTECH
    if (oemLower.includes('startech')) {
        if (productLower.includes('sata')) return 'StarTech SATA III 6Gbps Cable';
        if (productLower.includes('usb') && productLower.includes('hub')) return 'StarTech 4-Port USB 3.0 Hub';
        if (productLower.includes('docking')) return 'StarTech USB 3.0 Docking Station';
        if (productLower.includes('adapter')) return 'StarTech Adapter';
        return 'StarTech Cable/Accessory';
    }
    
    // SABRENT
    if (oemLower.includes('sabrent')) {
        if (productLower.includes('sata')) return 'Sabrent SATA Cable';
        if (productLower.includes('docking')) return 'Sabrent USB 3.0 to SATA Docking Station';
        if (productLower.includes('hub')) return 'Sabrent USB Hub';
        return 'Sabrent Accessory';
    }
    
    // TP-LINK
    if (oemLower.includes('tp-link') || oemLower.includes('tplink')) {
        if (productLower.includes('wifi') || productLower.includes('wireless')) return 'TP-Link USB WiFi Adapter AC1300';
        if (productLower.includes('bluetooth')) return 'TP-Link UB500 Bluetooth 5.0 Adapter';
        if (productLower.includes('switch')) return 'TP-Link TL-SG108 Switch';
        if (productLower.includes('router')) return 'TP-Link Archer Router';
        return 'TP-Link Adapter';
    }
    
    // ASUS
    if (oemLower.includes('asus')) {
        if (productLower.includes('wifi') || productLower.includes('wireless')) return 'ASUS USB-AC68 WiFi Adapter';
        if (productLower.includes('bluetooth')) return 'ASUS USB-BT500 Bluetooth 5.0';
        if (productLower.includes('dvd') || productLower.includes('writer')) return 'ASUS ZenDrive External DVD Writer';
        if (productLower.includes('router')) return 'ASUS RT-AX Router';
        if (productLower.includes('monitor')) return 'ASUS ProArt Display';
        if (productLower.includes('laptop')) return 'ASUS ZenBook';
        return 'ASUS Adapter';
    }
    
    // LG
    if (oemLower.includes('lg')) {
        if (productLower.includes('dvd') || productLower.includes('writer')) return 'LG GP65NB60 External DVD Writer';
        if (productLower.includes('monitor')) return 'LG UltraFine Monitor';
        return 'LG DVD Writer';
    }
    
    // SAMSUNG
    if (oemLower.includes('samsung')) {
        if (productLower.includes('dvd')) return 'Samsung SE-218 External DVD Writer';
        if (productLower.includes('monitor')) return 'Samsung Business Monitor';
        if (productLower.includes('ssd')) return 'Samsung 870 EVO SSD';
        return 'Samsung Device';
    }
    
    // MONOPRICE
    if (oemLower.includes('monoprice')) {
        if (productLower.includes('hdmi')) return 'Monoprice Select Series HDMI Cable';
        if (productLower.includes('usb')) return 'Monoprice USB Cable';
        if (productLower.includes('network')) return 'Monoprice Cat6 Cable';
        return 'Monoprice Cable';
    }
    
    // AMAZONBASICS
    if (oemLower.includes('amazon') || oemLower.includes('basics')) {
        if (productLower.includes('hdmi')) return 'AmazonBasics High-Speed HDMI Cable';
        if (productLower.includes('usb')) return 'AmazonBasics USB Cable';
        if (productLower.includes('ethernet')) return 'AmazonBasics Cat6 Ethernet Cable';
        return 'AmazonBasics Cable';
    }
    
    // UGREEN
    if (oemLower.includes('ugreen')) {
        if (productLower.includes('usb') && productLower.includes('hub')) return 'UGREEN USB 3.0 Hub';
        if (productLower.includes('docking')) return 'UGREEN Hard Drive Docking Station';
        return 'UGREEN Accessory';
    }
    
    // THERMALTAKE
    if (oemLower.includes('thermaltake')) {
        if (productLower.includes('docking')) return 'Thermaltake BlacX Duet Hard Drive Docking';
        return 'Thermaltake Docking Station';
    }
    
    // ============================================
    // HARDWARE VENDORS
    // ============================================
    
    // DELL
    if (oemLower.includes('dell')) {
        if (productLower.includes('server') || categoryLower.includes('server')) return 'Dell PowerEdge R740';
        if (productLower.includes('laptop')) return 'Dell Latitude 5520';
        if (productLower.includes('desktop')) return 'Dell OptiPlex 7090';
        if (productLower.includes('storage') || productLower.includes('san')) return 'Dell EMC Unity XT';
        if (productLower.includes('switch')) return 'Dell PowerSwitch S5248F-ON';
        if (productLower.includes('display') || productLower.includes('monitor')) return 'Dell UltraSharp U2720Q';
        return 'Dell PowerEdge R740';
    }
    
    // HP / HPE
    if (oemLower.includes('hp') || oemLower.includes('hewlett')) {
        if (productLower.includes('server') || categoryLower.includes('server')) return 'HPE ProLiant DL380 Gen10';
        if (productLower.includes('laptop')) return 'HP EliteBook 840 G8';
        if (productLower.includes('desktop')) return 'HP ProDesk 600 G6';
        if (productLower.includes('storage') || productLower.includes('san')) return 'HPE MSA 2060';
        if (productLower.includes('switch')) return 'HPE Aruba 2930F';
        return 'HPE ProLiant DL380 Gen10';
    }
    
    // CISCO
    if (oemLower.includes('cisco')) {
        if (productLower.includes('switch') || productLower.includes('layer 3')) return 'Cisco Catalyst 2960-X';
        if (productLower.includes('router')) return 'Cisco ISR 4000 Series';
        if (productLower.includes('firewall')) return 'Cisco Firepower 2100 Series';
        if (productLower.includes('server')) return 'Cisco UCS C220 M5';
        if (productLower.includes('wireless') || productLower.includes('access point')) return 'Cisco Catalyst 9100 Series';
        if (productLower.includes('security') || productLower.includes('ips') || productLower.includes('ids')) return 'Cisco Firepower 4100';
        return 'Cisco Catalyst 2960-X';
    }
    
    // LENOVO
    if (oemLower.includes('lenovo')) {
        if (productLower.includes('server') || categoryLower.includes('server')) return 'Lenovo ThinkSystem SR650';
        if (productLower.includes('laptop')) return 'Lenovo ThinkPad X1 Carbon';
        if (productLower.includes('desktop')) return 'Lenovo ThinkCentre M90a';
        return 'Lenovo ThinkSystem SR650';
    }
    
    // IBM
    if (oemLower.includes('ibm')) {
        if (productLower.includes('server')) return 'IBM Power System S922';
        if (productLower.includes('storage')) return 'IBM FlashSystem 5200';
        if (productLower.includes('soar') || productLower.includes('security')) return 'IBM QRadar SOAR';
        if (productLower.includes('siem')) return 'IBM QRadar SIEM';
        return 'IBM Power System S922';
    }
    
    // ============================================
    // NETWORKING VENDORS
    // ============================================
    
    // JUNIPER
    if (oemLower.includes('juniper')) {
        if (productLower.includes('switch')) return 'Juniper EX4300';
        if (productLower.includes('router')) return 'Juniper MX Series';
        if (productLower.includes('firewall')) return 'Juniper SRX Series';
        return 'Juniper EX4300';
    }
    
    // ARUBA / HPE ARUBA
    if (oemLower.includes('aruba')) {
        if (productLower.includes('switch')) return 'Aruba CX 6300';
        if (productLower.includes('wireless') || productLower.includes('access point')) return 'Aruba AP-515';
        return 'Aruba CX 6300';
    }
    
    // ============================================
    // SECURITY VENDORS
    // ============================================
    
    // FORTINET
    if (oemLower.includes('fortinet')) {
        if (productLower.includes('firewall')) return 'FortiGate 600E';
        if (productLower.includes('endpoint') || productLower.includes('epp')) return 'FortiClient EMS';
        if (productLower.includes('email')) return 'FortiMail 400E';
        if (productLower.includes('web') || productLower.includes('proxy')) return 'FortiProxy 4000E';
        return 'FortiGate 600E';
    }
    
    // PALO ALTO NETWORKS
    if (oemLower.includes('palo alto')) {
        if (productLower.includes('firewall')) return 'PA-5220';
        if (productLower.includes('waf') || productLower.includes('web application')) return 'Palo Alto Prisma Cloud';
        if (productLower.includes('endpoint')) return 'Cortex XDR';
        return 'PA-5220';
    }
    
    // CHECK POINT
    if (oemLower.includes('check point') || oemLower.includes('checkpoint')) {
        if (productLower.includes('firewall')) return 'Check Point 15600';
        if (productLower.includes('endpoint')) return 'Check Point Harmony Endpoint';
        return 'Check Point 15600';
    }
    
    // SYMANTEC / BROADCOM
    if (oemLower.includes('symantec') || oemLower.includes('broadcom')) {
        if (productLower.includes('endpoint') || productLower.includes('antivirus')) return 'Symantec Endpoint Protection 14.3';
        if (productLower.includes('dlp') || productLower.includes('data loss')) return 'Symantec DLP 15.8';
        if (productLower.includes('proxy') || productLower.includes('web')) return 'Symantec ProxySG';
        return 'Symantec Endpoint Protection 14.3';
    }
    
    // MCAFEE / TRELLIX
    if (oemLower.includes('mcafee') || oemLower.includes('trellix')) {
        if (productLower.includes('endpoint')) return 'McAfee Endpoint Security 10.7';
        if (productLower.includes('dlp')) return 'McAfee Total Protection for DLP';
        if (productLower.includes('siem')) return 'McAfee Enterprise Security Manager';
        return 'McAfee Endpoint Security 10.7';
    }
    
    // TREND MICRO
    if (oemLower.includes('trend micro')) {
        if (productLower.includes('endpoint')) return 'Trend Micro Apex One';
        if (productLower.includes('apt') || productLower.includes('sandbox')) return 'Trend Micro Deep Discovery';
        if (productLower.includes('email')) return 'Trend Micro Email Security';
        return 'Trend Micro Apex One';
    }
    
    // SOPHOS
    if (oemLower.includes('sophos')) {
        if (productLower.includes('firewall')) return 'Sophos XG Firewall';
        if (productLower.includes('endpoint')) return 'Sophos Intercept X';
        return 'Sophos XG Firewall';
    }
    
    // QUALYS
    if (oemLower.includes('qualys')) {
        if (productLower.includes('vulnerability') || productLower.includes('scanner')) return 'Qualys VMDR';
        if (productLower.includes('compliance')) return 'Qualys Policy Compliance';
        if (productLower.includes('web')) return 'Qualys Web Application Scanning';
        return 'Qualys VMDR';
    }
    
    // RAPID7
    if (oemLower.includes('rapid7')) {
        if (productLower.includes('vulnerability')) return 'Rapid7 InsightVM';
        if (productLower.includes('siem')) return 'Rapid7 InsightIDR';
        return 'Rapid7 InsightVM';
    }
    
    // CROWDSTRIKE
    if (oemLower.includes('crowdstrike')) {
        return 'CrowdStrike Falcon';
    }
    
    // CARBON BLACK / VMWARE CARBON BLACK
    if (oemLower.includes('carbon black')) {
        return 'VMware Carbon Black Cloud';
    }
    
    // ============================================
    // SIEM / SOC / MONITORING
    // ============================================
    
    // SPLUNK
    if (oemLower.includes('splunk')) {
        if (productLower.includes('siem') || productLower.includes('security')) return 'Splunk Enterprise Security';
        if (productLower.includes('soar')) return 'Splunk SOAR (Phantom)';
        if (productLower.includes('ueba')) return 'Splunk UBA';
        return 'Splunk Enterprise';
    }
    
    // LOGRHYTHM
    if (oemLower.includes('logrhythm')) {
        if (productLower.includes('siem')) return 'LogRhythm NextGen SIEM';
        if (productLower.includes('soar')) return 'LogRhythm RespondX';
        return 'LogRhythm NextGen SIEM';
    }
    
    // ARCSIGHT / MICRO FOCUS
    if (oemLower.includes('arcsight') || (oemLower.includes('micro focus') && productLower.includes('siem'))) {
        return 'ArcSight Enterprise Security Manager';
    }
    
    // QRADAR
    if (oemLower.includes('qradar')) {
        return 'IBM QRadar SIEM';
    }
    
    // ELASTIC / ELASTICSEARCH
    if (oemLower.includes('elastic')) {
        if (productLower.includes('siem') || productLower.includes('security')) return 'Elastic Security (SIEM)';
        return 'Elastic Stack';
    }
    
    // ============================================
    // CLOUD / VIRTUALIZATION / SOFTWARE
    // ============================================
    
    // VMWARE
    if (oemLower.includes('vmware')) {
        if (productLower.includes('virtualization') || productLower.includes('hypervisor')) return 'VMware vSphere 7.0';
        if (productLower.includes('endpoint') || productLower.includes('edr')) return 'VMware Carbon Black Cloud';
        if (productLower.includes('network')) return 'VMware NSX-T';
        if (productLower.includes('workspace')) return 'VMware Workspace ONE';
        return 'VMware vSphere 7.0';
    }
    
    // MICROSOFT
    if (oemLower.includes('microsoft')) {
        if (productLower.includes('office') || productLower.includes('365')) return 'Microsoft 365 E5';
        if (productLower.includes('windows') || productLower.includes('os')) return 'Windows Server 2022';
        if (productLower.includes('sql') || productLower.includes('database')) return 'Microsoft SQL Server 2019';
        if (productLower.includes('azure')) return 'Microsoft Azure';
        if (productLower.includes('endpoint') || productLower.includes('defender')) return 'Microsoft Defender for Endpoint';
        if (productLower.includes('display') || productLower.includes('video')) return 'Microsoft Surface Hub';
        return 'Microsoft 365 E5';
    }
    
    // ORACLE
    if (oemLower.includes('oracle')) {
        if (productLower.includes('database')) return 'Oracle Database 19c';
        if (productLower.includes('server')) return 'Oracle Exadata X9M';
        if (productLower.includes('soar') || productLower.includes('security')) return 'Oracle Security Monitoring and Analytics';
        if (productLower.includes('display') || productLower.includes('video')) return 'Oracle Cloud Infrastructure';
        return 'Oracle Database 19c';
    }
    
    // SERVICENOW
    if (oemLower.includes('servicenow')) {
        if (productLower.includes('itsm') || productLower.includes('service')) return 'ServiceNow IT Service Management';
        if (productLower.includes('security')) return 'ServiceNow Security Operations';
        if (productLower.includes('soar')) return 'ServiceNow Security Orchestration';
        return 'ServiceNow ITSM';
    }
    
    // ATLASSIAN
    if (oemLower.includes('atlassian')) {
        if (productLower.includes('jira')) return 'Atlassian Jira Service Management';
        if (productLower.includes('confluence')) return 'Atlassian Confluence';
        if (productLower.includes('soar')) return 'Atlassian Jira Service Management';
        return 'Atlassian Jira Service Management';
    }
    
    // ============================================
    // STORAGE VENDORS
    // ============================================
    
    // NETAPP
    if (oemLower.includes('netapp')) {
        if (productLower.includes('storage') || productLower.includes('san')) return 'NetApp FAS9000';
        if (productLower.includes('backup')) return 'NetApp SnapCenter';
        return 'NetApp FAS9000';
    }
    
    // EMC / DELL EMC
    if (oemLower.includes('emc') && !oemLower.includes('dell')) {
        return 'Dell EMC Unity XT';
    }
    
    // FUJITSU
    if (oemLower.includes('fujitsu')) {
        if (productLower.includes('storage')) return 'Fujitsu ETERNUS DX';
        if (productLower.includes('server')) return 'Fujitsu PRIMERGY RX2540';
        return 'Fujitsu PRIMERGY RX2540';
    }
    
    // ============================================
    // BACKUP / DISASTER RECOVERY
    // ============================================
    
    // VEEAM
    if (oemLower.includes('veeam')) {
        return 'Veeam Backup & Replication 11';
    }
    
    // VERITAS
    if (oemLower.includes('veritas')) {
        if (productLower.includes('backup')) return 'Veritas NetBackup 9.0';
        return 'Veritas NetBackup 9.0';
    }
    
    // COMMVAULT
    if (oemLower.includes('commvault')) {
        return 'Commvault Complete Backup & Recovery';
    }
    
    // ============================================
    // NETWORK SECURITY / DDOS / OTHERS
    // ============================================
    
    // AKAMAI
    if (oemLower.includes('akamai')) {
        if (productLower.includes('ddos')) return 'Akamai Prolexic';
        if (productLower.includes('waf')) return 'Akamai Kona Site Defender';
        return 'Akamai Prolexic';
    }
    
    // CLOUDFLARE
    if (oemLower.includes('cloudflare')) {
        if (productLower.includes('ddos')) return 'Cloudflare DDoS Protection';
        if (productLower.includes('waf')) return 'Cloudflare WAF';
        return 'Cloudflare DDoS Protection';
    }
    
    // ARBOR NETWORKS / NETSCOUT
    if (oemLower.includes('arbor') || oemLower.includes('netscout')) {
        if (productLower.includes('ddos')) return 'Arbor Networks APS';
        return 'Arbor Networks Spectrum';
    }
    
    // F5 NETWORKS
    if (oemLower.includes('f5')) {
        if (productLower.includes('load balancer') || productLower.includes('bigip')) return 'F5 BIG-IP';
        if (productLower.includes('waf')) return 'F5 Advanced WAF';
        return 'F5 BIG-IP';
    }
    
    // BLUECAT
    if (oemLower.includes('bluecat')) {
        return 'BlueCat Address Manager';
    }
    
    // INFOBLOX
    if (oemLower.includes('infoblox')) {
        return 'Infoblox DDI';
    }
    
    // ATTIVO NETWORKS
    if (oemLower.includes('attivo')) {
        return 'Attivo ThreatDefend';
    }
    
    // VARONIS
    if (oemLower.includes('varonis')) {
        return 'Varonis Data Security Platform';
    }
    
    // FORCEPOINT
    if (oemLower.includes('forcepoint')) {
        if (productLower.includes('dlp')) return 'Forcepoint DLP';
        if (productLower.includes('web') || productLower.includes('proxy')) return 'Forcepoint Web Security';
        return 'Forcepoint DLP';
    }
    
    // DIGITAL GUARDIAN
    if (oemLower.includes('digital guardian')) {
        return 'Digital Guardian DLP';
    }
    
    // ZSCALER
    if (oemLower.includes('zscaler')) {
        return 'Zscaler Internet Access';
    }
    
    // OKTA
    if (oemLower.includes('okta')) {
        return 'Okta Identity Cloud';
    }
    
    // PING IDENTITY
    if (oemLower.includes('ping')) {
        return 'PingFederate';
    }
    
    // SAILPOINT
    if (oemLower.includes('sailpoint')) {
        return 'SailPoint IdentityIQ';
    }
    
    // CYBERARK
    if (oemLower.includes('cyberark')) {
        return 'CyberArk Privileged Access Security';
    }
    
    // THYCOTIC / DELINEA
    if (oemLower.includes('thycotic') || oemLower.includes('delinea')) {
        return 'Thycotic Secret Server';
    }
    
    // CISCO CATALYST (specific for switches)
    if (oemLower.includes('catalyst')) {
        return 'Cisco Catalyst 2960-X';
    }
    
    // ============================================
    // CIVIL / CONSTRUCTION / HVAC
    // ============================================
    
    // VOLTAS (Indian AC manufacturer)
    if (oemLower.includes('voltas')) {
        if (productLower.includes('ac') || productLower.includes('air condition') || productLower.includes('split')) {
            if (productLower.includes('1.5') || productLower.includes('1.5 ton')) return 'Voltas 1.5 Ton Split AC';
            if (productLower.includes('2') || productLower.includes('2 ton')) return 'Voltas 2 Ton Split AC';
            return 'Voltas 1.5 Ton Split AC';
        }
        return 'Voltas AC';
    }
    
    // BLUE STAR (Indian AC manufacturer)
    if (oemLower.includes('blue star') || oemLower.includes('bluestar')) {
        if (productLower.includes('ac') || productLower.includes('air condition')) {
            if (productLower.includes('2') || productLower.includes('2 ton')) return 'Blue Star 2 Ton Split AC';
            return 'Blue Star 1.5 Ton Split AC';
        }
        return 'Blue Star AC';
    }
    
    // CARRIER (Global AC manufacturer)
    if (oemLower.includes('carrier')) {
        if (productLower.includes('ac') || productLower.includes('air condition')) {
            if (productLower.includes('2') || productLower.includes('2 ton')) return 'Carrier 2 Ton Split AC';
            return 'Carrier 1.5 Ton Split AC';
        }
        return 'Carrier AC';
    }
    
    // ARMSTRONG (Ceiling manufacturer)
    if (oemLower.includes('armstrong')) {
        if (productLower.includes('ceiling') || productLower.includes('false ceiling')) {
            return 'Armstrong Ultima Ceiling Tile';
        }
        return 'Armstrong Ceiling Panel';
    }
    
    // LG / SAMSUNG (Interactive panels/displays)
    if (oemLower.includes('lg') && (productLower.includes('panel') || productLower.includes('interactive') || productLower.includes('display'))) {
        if (productLower.includes('55') || productLower.includes('55 inch')) return 'LG 55" Interactive Touch Panel';
        if (productLower.includes('65') || productLower.includes('65 inch')) return 'LG 65" Interactive Touch Panel';
        return 'LG 55" Interactive Touch Panel';
    }
    
    if (oemLower.includes('samsung') && (productLower.includes('panel') || productLower.includes('interactive') || productLower.includes('display'))) {
        if (productLower.includes('55') || productLower.includes('55 inch')) return 'Samsung 55" Interactive Display';
        if (productLower.includes('65') || productLower.includes('65 inch')) return 'Samsung 65" Interactive Display';
        return 'Samsung 55" Interactive Display';
    }
    
    // ============================================
    // FALLBACK: Try to infer from product name + category
    // ============================================
    
    // For civil work items without specific OEM matches
    if (categoryLower.includes('civil') || categoryLower.includes('construction')) {
        // Try to extract size/type from product name
        if (productLower.includes('acoustic')) return 'Acoustic Panel 600x600mm';
        if (productLower.includes('ceiling')) return 'False Ceiling Tile 600x600mm';
        if (productLower.includes('panel')) return 'Acoustic Panel';
        // Return product name itself if it's specific enough
        if (productName && productName.length < 50 && /[a-z]/i.test(productName)) {
            return productName;
        }
    }
    
    // For cooling/AC systems
    if (categoryLower.includes('cooling') || categoryLower.includes('hvac')) {
        if (productLower.includes('2 ton') || productLower.includes('2-ton')) return '2 Ton Split AC';
        if (productLower.includes('1.5 ton') || productLower.includes('1.5-ton')) return '1.5 Ton Split AC';
        if (productLower.includes('split')) return '1.5 Ton Split AC';
        return 'Split AC';
    }
    
    // For interactive panels/displays
    if (categoryLower.includes('it equipment') && (productLower.includes('panel') || productLower.includes('interactive'))) {
        if (productLower.includes('55')) return '55" Interactive Touch Panel';
        if (productLower.includes('65')) return '65" Interactive Touch Panel';
        if (productLower.includes('75')) return '75" Interactive Touch Panel';
        return '55" Interactive Touch Panel';
    }
    
    // For workstations
    if (productLower.includes('workstation') || (categoryLower.includes('it') && productLower.includes('computer'))) {
        if (oemLower.includes('hp')) return 'HP Z2 Tower G9';
        if (oemLower.includes('dell')) return 'Dell Precision 3660';
        if (oemLower.includes('lenovo')) return 'Lenovo ThinkStation P350';
        return 'Workstation';
    }
    
    // Generic fallbacks with actual model-like names (not "Edition")
    if (categoryLower.includes('firewall') || productLower.includes('firewall')) {
        return 'Next-Gen Firewall';
    }
    
    if (categoryLower.includes('server') || productLower.includes('server')) {
        return 'Server System';
    }
    
    if (categoryLower.includes('switch') || productLower.includes('switch')) {
        return 'Network Switch';
    }
    
    if (categoryLower.includes('security software') || categoryLower.includes('endpoint')) {
        return 'Security Suite';
    }
    
    if (categoryLower.includes('siem') || productLower.includes('siem')) {
        return 'SIEM Platform';
    }
    
    if (categoryLower.includes('storage') || productLower.includes('storage')) {
        return 'Storage System';
    }
    
    // Final fallback - use product name if reasonable, otherwise generic
    if (productName && productName.length > 3 && productName.length < 100) {
        return productName;
    }
    
    return 'Standard Model';
};

/**
 * Get multiple OEM+Model options when no perfect match is found
 * Returns 2-3 OEM options with their respective models
 * @param {String} productName - Product name
 * @param {String} specifications - Product specifications
 * @param {String} category - Product category
 * @returns {Promise<Object>} - Multiple OEM+Model options
 */
const getMultipleOEMModelOptions = async (productName, specifications, category) => {
    try {
        console.log(`   🔍 Getting multiple OEM+Model options for: ${productName}`);
        
        // Get category OEMs
        const { getCategoryOEMs, classifyMIIStatus } = require('../data/miiDatabase');
        const categoryOEMs = getCategoryOEMs(category || 'Other');
        
        // Select 2-3 OEM options
        const allOEMs = [
            ...(categoryOEMs.global || []),
            ...(categoryOEMs.indian || [])
        ];
        
        // If we have category OEMs, use them; otherwise use generic options
        let oemOptions = allOEMs.length > 0 ? allOEMs : [];
        
        if (oemOptions.length === 0) {
            // Fallback to generic OEMs based on category
            const categoryLower = (category || '').toLowerCase();
            if (categoryLower.includes('civil') || categoryLower.includes('construction')) {
                oemOptions = ['Armstrong', 'Supreme Industries', 'L&T Construction'];
            } else if (categoryLower.includes('cooling') || categoryLower.includes('hvac') || categoryLower.includes('ac')) {
                oemOptions = ['Voltas', 'Blue Star', 'Carrier'];
            } else if (categoryLower.includes('it equipment') && (productName.toLowerCase().includes('panel') || productName.toLowerCase().includes('interactive'))) {
                oemOptions = ['LG', 'Samsung', 'Microsoft'];
            } else if (categoryLower.includes('it equipment') && productName.toLowerCase().includes('workstation')) {
                oemOptions = ['HP', 'Dell', 'Lenovo'];
            } else if (categoryLower.includes('network') || categoryLower.includes('switch') || categoryLower.includes('router')) {
                oemOptions = ['Cisco', 'Juniper Networks', 'HPE Aruba'];
            } else if (categoryLower.includes('security') || categoryLower.includes('firewall')) {
                oemOptions = ['Fortinet', 'Palo Alto', 'Check Point'];
            } else if (categoryLower.includes('server') || categoryLower.includes('hardware')) {
                oemOptions = ['Dell', 'HP', 'Lenovo'];
            } else if (categoryLower.includes('software') || categoryLower.includes('license')) {
                oemOptions = ['Microsoft', 'Oracle', 'IBM'];
            } else {
                oemOptions = ['Cisco', 'Dell', 'Microsoft'];
            }
        }
        
        // Select 2-3 OEMs deterministically
        const hash = productName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const selectedOEMs = [];
        const numOptions = Math.min(3, oemOptions.length);
        
        for (let i = 0; i < numOptions; i++) {
            const index = (hash + i) % oemOptions.length;
            if (!selectedOEMs.includes(oemOptions[index])) {
                selectedOEMs.push(oemOptions[index]);
            }
        }
        
        // Ensure at least 2 options
        if (selectedOEMs.length < 2 && oemOptions.length >= 2) {
            selectedOEMs.push(oemOptions[(hash + selectedOEMs.length) % oemOptions.length]);
        }
        
        // Clean OEM names - remove "or equivalent"
        const cleanedOEMs = selectedOEMs.map(oem => {
            return oem.replace(/\s+or\s+equivalent/gi, '').replace(/or\s+equivalent/gi, '').trim();
        }).filter(oem => oem.length > 0);
        
        // Find models for each OEM in batches (max 3 parallel, 60s delay between batches)
        const processOEMModel = async (oem) => {
            try {
                // Try to find model using AI first
                const modelInfo = await findModelForOEM(productName, oem, specifications, category);
                const miiStatus = classifyMIIStatus(oem, category);
                
                // Use the model if it's valid (not generic "Edition" style)
                let model = modelInfo.model;
                if (!model || 
                    model.toLowerCase().includes('edition') ||
                    model.toLowerCase().includes('standard model') ||
                    model.toLowerCase().includes('enterprise')) {
                    // Use intelligent fallback instead
                    model = getQuickModelFallback(productName, oem, category);
                }
                
                return {
                    oem: oem,
                    model: model,
                    confidence: modelInfo.confidence || 65,
                    miiStatus: miiStatus,
                    source: 'multi-option-match'
                };
            } catch (error) {
                console.warn(`   ⚠️ Failed to get model for ${oem}, using fallback`);
                const miiStatus = classifyMIIStatus(oem, category);
                const fallbackModel = getQuickModelFallback(productName, oem, category);
                return {
                    oem: oem,
                    model: fallbackModel,
                    confidence: 60,
                    miiStatus: miiStatus,
                    source: 'multi-option-fallback'
                };
            }
        };
        
        const oemModelOptions = await processInBatchesWithDelay(cleanedOEMs, processOEMModel, 'OEMs');
        
        // Format OEM string (join with " / ") - already cleaned
        const oemString = oemModelOptions.map(opt => opt.oem).join(' / ');
        
        // Format model string (join with " / ") - one model per OEM
        const modelString = oemModelOptions.map(opt => opt.model).join(' / ');
        
        // Determine overall MII status
        const indianCount = oemModelOptions.filter(opt => opt.miiStatus === 'Indian OEM').length;
        const globalCount = oemModelOptions.filter(opt => opt.miiStatus === 'Global OEM').length;
        let overallMiiStatus = 'Global OEM';
        if (indianCount === oemModelOptions.length) {
            overallMiiStatus = 'Indian OEM';
        } else if (indianCount > 0 && globalCount > 0) {
            overallMiiStatus = `Mixed Options (${globalCount} Global / ${indianCount} Indian)`;
        }
        
        console.log(`   ✅ Multiple options: ${oemString} with models: ${modelString}`);
        
        return {
            oem: oemString,
            model: modelString,
            miiStatus: overallMiiStatus,
            confidence: 65,
            source: 'multiple-options-provided',
            multipleOptions: true,
            options: oemModelOptions, // Array of {oem, model, confidence, miiStatus}
            optionCount: oemModelOptions.length
        };
        
    } catch (error) {
        console.error(`   ❌ Error getting multiple OEM+Model options:`, error.message);
        // Return fallback with single option
        return {
            oem: 'Cisco',
            model: getQuickModelFallback(productName, 'Cisco', category),
            miiStatus: 'Global OEM',
            confidence: 50,
            source: 'error-fallback',
            multipleOptions: false,
            options: [],
            optionCount: 1
        };
    }
};

module.exports = {
    findModelForOEM,
    findModelsForMultipleOEMs,
    searchOEMAndModel,
    enrichProductWithModel,
    enrichProductsWithModels,
    getQuickModelFallback,
    getMultipleOEMModelOptions
};
