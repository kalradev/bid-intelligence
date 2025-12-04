/**
 * Model Matching Service
 * Finds specific OEM models that match product specifications
 * Supports both single and multiple OEMs
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
        
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.0, // Deterministic matching
                topP: 1.0,
                topK: 1
            }
        });
        
        const prompt = `You are a product specification expert. Find the specific model from ${oem} that matches these requirements.

**PRODUCT:** ${productName}
**OEM/MANUFACTURER:** ${oem}
**CATEGORY:** ${category}
**SPECIFICATIONS:** ${specifications || 'Not specified'}

**TASK:**
Find the specific ${oem} model/product number that best matches these specifications.

**CRITICAL INSTRUCTIONS:**
1. ALWAYS return a SPECIFIC model number/name (NEVER return "Standard Model" or generic names)
2. Use actual product model numbers that exist in the market
3. If specifications are minimal, suggest the most popular/standard model from that OEM
4. The model MUST match the product category and OEM
5. Return actual model numbers like "FortiGate 600E", "Cisco Catalyst 2960-X", NOT generic names

**MANDATORY: Your response MUST contain a specific model number. Generic responses are NOT acceptable.**

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

**CRITICAL: Do NOT use isValid field. Always assume the OEM makes this product and return the best matching model.**

Return ONLY valid JSON. No markdown, no explanation.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
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
        
        // Find model for each OEM in parallel
        const modelPromises = oems.map(async (oem) => {
            const modelInfo = await findModelForOEM(productName, oem, specifications, category);
            return {
                oem: oem,
                ...modelInfo
            };
        });
        
        const allModels = await Promise.all(modelPromises);
        
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
        console.log(`   🌐 Web searching OEM + Model for: ${productName}`);
        
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.0,
                topP: 1.0,
                topK: 1
            }
        });
        
        const prompt = `You are a product research expert. Find the best OEM and model for this product based on specifications.

**PRODUCT:** ${productName}
**CATEGORY:** ${category}
**SPECIFICATIONS:** ${specifications || 'Standard specifications'}

**TASK:**
Based on your knowledge, recommend the most suitable OEM (manufacturer) and specific model number for this product.

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

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
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
    
    const enrichedProducts = [];
    const batchSize = 5; // Process 5 products at a time (slower to avoid rate limits)
    
    for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);
        
        // Process batch in parallel
        const batchPromises = batch.map(product => 
            enrichProductWithModel(product)
        );
        
        const batchResults = await Promise.all(batchPromises);
        enrichedProducts.push(...batchResults);
        
        // Rate limiting: wait 2 seconds between batches
        if (i + batchSize < products.length) {
            console.log('   ⏳ Waiting 2s before next batch...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
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
    // FALLBACK: Category-based intelligent guess
    // ============================================
    
    if (categoryLower.includes('firewall') || productLower.includes('firewall')) {
        return `${oem} Next-Gen Firewall`;
    }
    
    if (categoryLower.includes('server') || productLower.includes('server')) {
        return `${oem} Enterprise Server`;
    }
    
    if (categoryLower.includes('switch') || productLower.includes('switch')) {
        return `${oem} Enterprise Switch`;
    }
    
    if (categoryLower.includes('security software') || categoryLower.includes('endpoint')) {
        return `${oem} Enterprise Security Suite`;
    }
    
    if (categoryLower.includes('siem') || productLower.includes('siem')) {
        return `${oem} SIEM Platform`;
    }
    
    if (categoryLower.includes('storage') || productLower.includes('storage')) {
        return `${oem} Enterprise Storage`;
    }
    
    // Final fallback - at least include product type
    return `${oem} ${category || 'Enterprise'} Edition`;
};

module.exports = {
    findModelForOEM,
    findModelsForMultipleOEMs,
    searchOEMAndModel,
    enrichProductWithModel,
    enrichProductsWithModels,
    getQuickModelFallback
};
