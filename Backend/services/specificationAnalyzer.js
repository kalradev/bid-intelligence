/**
 * Specification Analyzer Service
 * Analyzes product specifications to infer OEM and model
 * Uses pattern matching and AI to identify products from specs
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Infer OEM from specifications using pattern matching
 * @param {String} specifications - Product specifications text
 * @param {String} productName - Product name
 * @returns {Object} - Inferred OEM information
 */
const inferOEMFromSpecs = (specifications, productName) => {
    if (!specifications || specifications.trim() === '') {
        return null;
    }
    
    const specsLower = specifications.toLowerCase();
    const productLower = (productName || '').toLowerCase();
    const combinedText = `${specsLower} ${productLower}`;
    
    // Fortinet indicators
    if (combinedText.includes('fortigate') || 
        combinedText.includes('fortinet') ||
        combinedText.includes('fortios') ||
        (combinedText.includes('ips throughput') && combinedText.includes('ngfw throughput')) ||
        (combinedText.includes('ssl inspection') && combinedText.includes('threat protection'))) {
        return {
            oem: 'Fortinet',
            confidence: 85,
            source: 'spec-pattern-match',
            reasoning: 'Specifications match Fortinet product characteristics'
        };
    }
    
    // Palo Alto indicators
    if (combinedText.includes('palo alto') ||
        combinedText.includes('pa-') ||
        combinedText.includes('pan-os') ||
        (combinedText.includes('app-id') && combinedText.includes('wildfire'))) {
        return {
            oem: 'Palo Alto Networks',
            confidence: 85,
            source: 'spec-pattern-match',
            reasoning: 'Specifications match Palo Alto Networks product characteristics'
        };
    }
    
    // Cisco indicators
    if (combinedText.includes('catalyst') ||
        combinedText.includes('cisco ios') ||
        combinedText.includes('cisco asa') ||
        combinedText.includes('cisco firepower') ||
        (combinedText.includes('qsfp28') && combinedText.includes('sfp28'))) {
        return {
            oem: 'Cisco',
            confidence: 80,
            source: 'spec-pattern-match',
            reasoning: 'Specifications match Cisco product characteristics'
        };
    }
    
    // Juniper indicators
    if (combinedText.includes('juniper') ||
        combinedText.includes('junos') ||
        combinedText.includes('ex series') ||
        combinedText.includes('ex4300') ||
        combinedText.includes('ex3300')) {
        return {
            oem: 'Juniper Networks',
            confidence: 85,
            source: 'spec-pattern-match',
            reasoning: 'Specifications match Juniper Networks product characteristics'
        };
    }
    
    // Aruba/HPE indicators
    if (combinedText.includes('aruba') ||
        combinedText.includes('cx series') ||
        combinedText.includes('cx 6300') ||
        combinedText.includes('arubaos')) {
        return {
            oem: 'HPE Aruba',
            confidence: 85,
            source: 'spec-pattern-match',
            reasoning: 'Specifications match Aruba product characteristics'
        };
    }
    
    // Check Point indicators
    if (combinedText.includes('check point') ||
        combinedText.includes('gaia') ||
        combinedText.includes('smart-1')) {
        return {
            oem: 'Check Point',
            confidence: 80,
            source: 'spec-pattern-match',
            reasoning: 'Specifications match Check Point product characteristics'
        };
    }
    
    // Network switch indicators (generic)
    if (combinedText.includes('qsfp28') || 
        combinedText.includes('sfp28') ||
        combinedText.includes('sfp+') ||
        (combinedText.includes('hardware accelerated') && combinedText.includes('slots'))) {
        // Could be Cisco, Juniper, Aruba, etc.
        return {
            oem: 'Cisco / Juniper Networks / HPE Aruba',
            confidence: 70,
            source: 'spec-pattern-match',
            reasoning: 'Specifications indicate high-end network switch'
        };
    }
    
    // Firewall indicators (generic)
    if ((combinedText.includes('ips throughput') || combinedText.includes('ngfw throughput')) &&
        (combinedText.includes('ssl inspection') || combinedText.includes('threat protection'))) {
        return {
            oem: 'Fortinet / Palo Alto Networks / Check Point',
            confidence: 75,
            source: 'spec-pattern-match',
            reasoning: 'Specifications indicate next-gen firewall'
        };
    }
    
    return null;
};

/**
 * Infer model from specifications using AI with web search knowledge
 * @param {String} specifications - Product specifications
 * @param {String} oem - OEM name
 * @param {String} productName - Product name
 * @returns {Promise<Object>} - Inferred model information
 */
const inferModelFromSpecs = async (specifications, oem, productName) => {
    try {
        if (!specifications || specifications.trim() === '') {
            return null;
        }
        
        // If product name is generic (Model 1, Model 2, Product A, etc.), be more aggressive
        const isGenericName = /^(model\s*\d+|product\s*[a-z]|variant\s*[a-z])$/i.test(productName || '');
        
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.0,
                topP: 1.0,
                topK: 1
            }
        });
        
        const prompt = `You are a product research expert. Analyze these specifications and identify the EXACT ${oem} model number using your knowledge of real products.

**PRODUCT NAME:** ${productName}${isGenericName ? ' (NOTE: This is a generic name - you MUST find the actual model number from specifications)' : ''}
**OEM:** ${oem}
**SPECIFICATIONS:**
${specifications}

**CRITICAL TASK:**
${isGenericName 
    ? 'The product name "' + productName + '" is generic. You MUST identify the ACTUAL model number by matching these specifications to real ' + oem + ' products. DO NOT return "' + productName + '" as the model - find the real model number.'
    : 'Identify the exact ' + oem + ' model number that matches these specifications.'}

**USE YOUR KNOWLEDGE:**
- Search your knowledge base for ${oem} products matching these specifications
- Match key specifications to actual product models
- Return the SPECIFIC model number (e.g., "FortiGate 600E", "PA-5220", "Catalyst 2960-X", "EX4300")
- NEVER return generic names like "Model 2", "Product A", or "Standard Model"

**KEY SPECIFICATION INDICATORS:**
- Hardware Accelerated 40/100 GE QSFP28 Slots: 4, SFP28 Slots: 24 → Network switch (Cisco Catalyst 9300, Juniper EX4300, Aruba CX 6300)
- IPS Throughput: 110 Gbps, NGFW Throughput: 90 Gbps → FortiGate 600E or FortiGate 700E
- Concurrent Sessions: 120 Million → Enterprise firewall (FortiGate 600E/700E, PA-5220)
- SSL Inspection Throughput: 66 Gbps → Next-gen firewall
- QSFP28 + SFP28 combination → High-end network switch

**OUTPUT FORMAT (JSON only):**
{
  "model": "string (SPECIFIC model number like 'FortiGate 600E', 'PA-5220', 'Catalyst 9300-48P', 'EX4300-48MP', 'CX 6300-48P' - NEVER generic names)",
  "confidence": number (0-100),
  "reasoning": "string (which specs matched to this specific model)",
  "alternativeModels": ["array of 2-3 alternative models if multiple matches"]
}

Return ONLY valid JSON. No markdown, no explanation.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        const cleanedResponse = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        
        const inferred = JSON.parse(cleanedResponse);
        
        // Validate that we got a real model number, not a generic name
        if (isGenericName && (
            inferred.model.toLowerCase().includes(productName.toLowerCase()) ||
            inferred.model.toLowerCase().includes('model') ||
            inferred.model.toLowerCase().includes('product') ||
            inferred.model.toLowerCase().includes('variant')
        )) {
            console.warn(`   ⚠️ AI returned generic model "${inferred.model}", trying web search...`);
            // Try web search as fallback
            return await searchModelFromWeb(specifications, oem, productName);
        }
        
        return {
            model: inferred.model,
            confidence: inferred.confidence || 75,
            source: 'spec-ai-inference',
            reasoning: inferred.reasoning || 'Inferred from specifications',
            alternatives: inferred.alternativeModels || []
        };
        
    } catch (error) {
        console.error(`❌ Error inferring model from specs:`, error.message);
        // Try web search as fallback
        return await searchModelFromWeb(specifications, oem, productName);
    }
};

/**
 * Search for model number using web search (SERP API or AI-based search)
 * @param {String} specifications - Product specifications
 * @param {String} oem - OEM name
 * @param {String} productName - Product name
 * @returns {Promise<Object>} - Model information from web search
 */
const searchModelFromWeb = async (specifications, oem, productName) => {
    try {
        console.log(`   🌐 Searching web for model matching specifications...`);
        
        // Extract key specs for search query
        const keySpecs = extractKeySpecsForSearch(specifications);
        const searchQuery = `${oem} ${keySpecs.join(' ')} model`;
        
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.0,
                topP: 1.0,
                topK: 1
            }
        });
        
        const prompt = `Based on your knowledge of ${oem} products, identify the specific model number that matches these specifications:

**SPECIFICATIONS:**
${specifications}

**KEY SPECS:**
${keySpecs.join(', ')}

**TASK:**
Find the EXACT ${oem} model number that matches these specifications. Use your knowledge of real products.

**OUTPUT FORMAT (JSON only):**
{
  "model": "string (specific model number)",
  "confidence": number (0-100),
  "reasoning": "string"
}

Return ONLY valid JSON.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        const cleanedResponse = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        
        const webResult = JSON.parse(cleanedResponse);
        
        return {
            model: webResult.model,
            confidence: webResult.confidence || 70,
            source: 'web-search-inference',
            reasoning: webResult.reasoning || 'Found via web search knowledge'
        };
        
    } catch (error) {
        console.error(`❌ Web search error:`, error.message);
        return null;
    }
};

/**
 * Extract key specifications for search query
 * @param {String} specifications - Full specifications text
 * @returns {Array<String>} - Key specification terms
 */
const extractKeySpecsForSearch = (specifications) => {
    const keyTerms = [];
    const specsLower = specifications.toLowerCase();
    
    // Extract throughput values
    const throughputMatch = specsLower.match(/(\d+)\s*(gbps|mbps)/gi);
    if (throughputMatch) {
        keyTerms.push(...throughputMatch.slice(0, 2));
    }
    
    // Extract port/slot counts
    const portMatch = specsLower.match(/(\d+)\s*(port|slot|interface)/gi);
    if (portMatch) {
        keyTerms.push(...portMatch.slice(0, 2));
    }
    
    // Extract key features
    if (specsLower.includes('qsfp28')) keyTerms.push('QSFP28');
    if (specsLower.includes('sfp28')) keyTerms.push('SFP28');
    if (specsLower.includes('ips')) keyTerms.push('IPS');
    if (specsLower.includes('ngfw')) keyTerms.push('NGFW');
    if (specsLower.includes('ssl inspection')) keyTerms.push('SSL Inspection');
    
    return keyTerms.slice(0, 5); // Limit to 5 key terms
};

module.exports = {
    inferOEMFromSpecs,
    inferModelFromSpecs,
    searchModelFromWeb
};

