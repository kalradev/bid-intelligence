/**
 * Unified AI Service - OpenAI Primary with Gemini Fallback
 * 
 * Priority: OpenAI → Gemini
 * Automatically switches to Gemini if OpenAI quota exceeded
 */

const OpenAI = require('openai');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { getAllIndianOEMs, getAllGlobalOEMs } = require('../data/miiDatabase');

// Initialize AI clients conditionally
let openai = null;
let genAI = null;

// Initialize OpenAI only if API key exists
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    try {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        console.log('✅ OpenAI client initialized');
    } catch (error) {
        console.warn('⚠️  OpenAI initialization failed:', error.message);
    }
} else {
    console.warn('⚠️  OPENAI_API_KEY not found in .env - will use Gemini only');
}

// Initialize Gemini
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('✅ Gemini client initialized');
} else {
    console.error('❌ GEMINI_API_KEY not found in .env');
}

// Configuration
const OPENAI_MODEL = 'gpt-4o-mini'; // Cost-effective model
const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const TEMPERATURE = 0.3;
const MAX_TOKENS_OPENAI = 16384;
const MAX_TOKENS_GEMINI = 8192;

/**
 * Generate departmental summaries using AI (OpenAI → Gemini fallback)
 * @param {String} documentText - Extracted document text
 * @param {String} fileName - Original file name
 * @returns {Promise<Object>} - Departmental summaries
 */
const generateDepartmentalSummaries = async (documentText, fileName) => {
    const systemPrompt = `You are an expert RFP/tender analyst. Extract critical bidding intelligence from tender documents.

FOCUS: Extract actionable information needed to WIN the bid.

OUTPUT RULES:
- Be thorough but concise
- Include ALL critical data points (amounts, dates, percentages)
- Keep descriptions focused and scannable
- Arrays: 3-5 most important items
- NO generic advice - only document-specific data`;

    const userPrompt = buildUserPrompt(documentText, fileName);

    // Try OpenAI first (if available)
    if (openai) {
        try {
            console.log('🤖 Attempting with OpenAI (gpt-4o-mini)...');
            const result = await generateWithOpenAI(systemPrompt, userPrompt);
            console.log('✅ OpenAI generation successful');
            return result;
        } catch (openaiError) {
            console.warn('⚠️  OpenAI failed:', openaiError.message);
            
            // Check if it's a quota/rate limit error
            if (isQuotaError(openaiError)) {
                console.log('💡 OpenAI quota exceeded. Falling back to Gemini...');
            } else {
                console.log('💡 OpenAI error. Falling back to Gemini...');
            }
        }
    } else {
        console.log('💡 OpenAI not configured. Using Gemini...');
    }
    
    // Use Gemini (either as fallback or primary)
    try {
        console.log('🤖 Attempting with Gemini (gemini-2.0-flash-exp)...');
        const result = await generateWithGemini(systemPrompt, userPrompt, documentText, fileName);
        console.log('✅ Gemini generation successful');
        return result;
    } catch (geminiError) {
        console.error('❌ Gemini failed:', geminiError.message);
        throw new Error(`AI generation failed: ${geminiError.message}`);
    }
};

/**
 * Generate summaries using OpenAI
 */
const generateWithOpenAI = async (systemPrompt, userPrompt) => {
    if (!openai) {
        throw new Error('OpenAI client not initialized');
    }
    
    const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS_OPENAI,
        response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0].message.content;
    const summaries = JSON.parse(responseText);

    return {
        summaries,
        usage: {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens
        },
        model: OPENAI_MODEL,
        provider: 'openai'
    };
};

/**
 * Generate summaries using Gemini
 */
const generateWithGemini = async (systemPrompt, userPrompt, documentText, fileName) => {
    // Check if document needs chunking
    const estimatedTokens = estimateTokens(documentText);
    
    if (estimatedTokens > 25000) {
        console.log('⚡ Document too large, using PARALLEL chunking strategy...');
        return await processLargeDocument(documentText, fileName);
    }

    const model = genAI.getGenerativeModel({ 
        model: GEMINI_MODEL,
        generationConfig: {
            temperature: TEMPERATURE,
            maxOutputTokens: MAX_TOKENS_GEMINI,
            responseMimeType: "application/json"
        },
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
    });

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    
    // Check for MAX_TOKENS truncation
    if (response.candidates && response.candidates[0]) {
        const finishReason = response.candidates[0].finishReason;
        if (finishReason === 'MAX_TOKENS') {
            console.warn('⚠️  Response truncated due to MAX_TOKENS. Attempting JSON repair...');
        }
    }
    
    let responseText = response.text().trim();
    
    // Clean markdown code blocks
    if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    responseText = responseText.trim();
    
    let summaries;
    try {
        summaries = JSON.parse(responseText);
    } catch (parseError) {
        console.warn('JSON Parse Error, attempting repair:', parseError.message);
        try {
            const repairedText = repairTruncatedJSON(responseText);
            summaries = JSON.parse(repairedText);
            console.log('✓ JSON repaired successfully');
        } catch (repairError) {
            throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
        }
    }

    return {
        summaries,
        usage: {
            promptTokens: estimatedTokens,
            completionTokens: estimateTokens(responseText),
            totalTokens: estimatedTokens + estimateTokens(responseText)
        },
        model: GEMINI_MODEL,
        provider: 'gemini'
    };
};

/**
 * Check if error is due to quota/rate limits
 */
const isQuotaError = (error) => {
    const errorMessage = error.message.toLowerCase();
    return (
        errorMessage.includes('quota') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('insufficient_quota') ||
        error.status === 429 ||
        error.code === 'insufficient_quota'
    );
};

/**
 * Build the comprehensive user prompt
 */
const buildUserPrompt = (documentText, fileName) => {
    return `You are analyzing an RFP/tender document. Extract information into the JSON schema below.

Document: ${fileName}

=== DOCUMENT CONTENT ===
${documentText}
=== END DOCUMENT ===

EXTRACTION RULES:
1. Extract ALL critical bidding information
2. Keep descriptions concise but complete
3. Use compact notation for financial data: "EMD: ₹5L (2%)"
4. Arrays: Include 3-5 most important items
5. If field not found, return "N/A"
6. Search BOQ/BOM for products

**OEM EXTRACTION:**
- Search for brand names in: product descriptions, "Approved Makes", specifications
- Multiple brands listed → extract FIRST one
- Keywords: "Make:", "Brand:", "or equivalent"
- Only return "Unspecified" if NO brand found in entire document

**MII STATUS:**
- Indian OEMs: ${getAllIndianOEMs().join(', ')}
- Global OEMs: ${getAllGlobalOEMs().join(', ')}
- If mentions "Make in India", "MII compliant", "Class-I Local" → mark as "MII-Compliant"
- If uncertain, use "Requires Review"

Return ONLY valid JSON with this structure:

{
  "projectOverview": {
    "projectName": "string",
    "client": "string",
    "tenderId": "string",
    "bidValue": "string (with currency)",
    "emd": "string (amount with currency)",
    "completionPeriod": "string (duration)",
    "lastSubmissionDate": "string (deadline with time)"
  },
  "bidManagement": {
    "projectOverview": "string (2-3 sentences: scope, value, timeline)",
    "keyDeadlines": "string (critical dates with times)",
    "strategy": "string (1-2 sentences: key approach for winning)",
    "successFactors": ["3-5 critical success factors for winning bid"],
    "keyPoints": ["3-5 important points with data"],
    "complianceRequirements": ["3-5 mandatory requirements"],
    "riskAreas": ["2-3 major risks"],
    "actionItems": ["3-5 immediate actions needed"]
  },
  "technical": {
    "totalItems": "integer",
    "compliancePercent": "string",
    "keySpecifications": [
      {
        "productName": "string",
        "specification": "string (concise with numbers/standards)"
      }
    ],
    "criticalRequirements": ["3-5 key technical requirements"],
    "riskAreas": ["2-3 technical risks"],
    "actionItems": ["3-5 technical actions"]
  },
  "commercial": {
    "estimatedValue": "string",
    "paymentTerms": "string (concise: e.g., 70-20-10)",
    "warranties": "string",
    "penalties": "string (LD details)",
    "keyTerms": ["3-5 important commercial terms"],
    "riskAreas": ["2-3 commercial risks"]
  },
  "finance": {
    "turnoverRequired": "string",
    "netWorth": "string",
    "bankGuarantee": "string",
    "eligibilityStatus": "string",
    "financialRequirements": ["3-5 financial requirements"],
    "riskAreas": ["2-3 financial risks"]
  },
  "legal": {
    "contractType": "string",
    "liabilityCap": "string",
    "disputeResolution": "string",
    "requiredDocuments": ["3-5 required legal documents"],
    "complianceRequirements": ["2-3 legal requirements"],
    "riskAreas": ["2-3 legal risks"]
  },
  "scm": {
    "leadTime": "string",
    "criticalItems": "integer",
    "miiRequirement": "string",
    "riskLevel": "string",
    "sourcingStrategy": "string (1-2 sentences)",
    "keyActions": ["3-5 SCM actions needed"]
  },
  "productMapping": {
    "sourceType": "string (BOQ or BOM)",
    "totalItems": "integer",
    "totalOEMs": {
      "count": "integer",
      "indian": "integer",
      "global": "integer"
    },
    "productsMapped": "integer",
    "makeInIndiaMapping": {
      "status": "string",
      "mapped": "integer",
      "unmapped": "integer"
    },
    "miiProductStatus": [
      {
        "productName": "string",
        "category": "string",
        "oem": "string",
        "miiStatus": "string"
      }
    ]
  }
}

CRITICAL FOR PRODUCTS:
- Extract up to 40 products per chunk (prioritize those with OEM mentions)
- Maximum 150 products in final output
- Include ALL products with specified OEMs
- For repetitive commodity items, include representative samples`;
};

/**
 * Process large documents with chunking (Gemini only)
 */
const processLargeDocument = async (documentText, fileName) => {
    // Implementation similar to geminiService.js processLargeDocument
    // (Copy the chunking logic from geminiService.js)
    const chunkSize = 30000;
    const chunks = [];

    for (let i = 0; i < documentText.length; i += chunkSize) {
        chunks.push(documentText.slice(i, i + chunkSize));
    }

    console.log(`Processing large document in ${chunks.length} chunks...`);

    const chunkResults = [];
    for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
        let retryCount = 0;
        let success = false;
        
        while (retryCount <= 2 && !success) {
            try {
                const result = await generateDepartmentalSummaries(chunks[i], `${fileName} (Part ${i + 1})`);
                chunkResults.push(result.summaries);
                success = true;
            } catch (chunkError) {
                retryCount++;
                console.error(`Error processing chunk ${i + 1} (attempt ${retryCount}/3):`, chunkError.message);
                
                if (retryCount > 2) {
                    console.error(`Failed to process chunk ${i + 1} after 3 attempts. Skipping...`);
                    chunkResults.push({
                        projectOverview: {},
                        bidManagement: {},
                        technical: {},
                        commercial: {},
                        finance: {},
                        legal: {},
                        scm: {},
                        productMapping: { miiProductStatus: [] }
                    });
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
        }
    }

    // Merge results using naive merge
    const finalSummaries = naiveMergeSummaries(chunkResults);
    
    return {
        summaries: finalSummaries,
        chunked: true,
        chunkCount: chunks.length,
        model: GEMINI_MODEL,
        provider: 'gemini'
    };
};

/**
 * Naive merge of summaries
 */
const naiveMergeSummaries = (results) => {
    if (!results || results.length === 0) return {};
    
    const merged = JSON.parse(JSON.stringify(results[0]));
    
    for (let i = 1; i < results.length; i++) {
        const current = results[i];
        
        const mergeObjects = (target, source, path = '') => {
            for (const key in source) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (Array.isArray(source[key])) {
                    if (!Array.isArray(target[key])) {
                        target[key] = [];
                    }
                    
                    if (currentPath === 'productMapping.miiProductStatus') {
                        const productMap = new Map();
                        
                        target[key].forEach(product => {
                            if (product.productName) {
                                productMap.set(product.productName, product);
                            }
                        });
                        
                        source[key].forEach(product => {
                            if (product.productName) {
                                const existing = productMap.get(product.productName);
                                if (!existing || (product.oem && product.oem !== 'Unspecified' && existing.oem === 'Unspecified')) {
                                    productMap.set(product.productName, product);
                                }
                            }
                        });
                        
                        const allProducts = Array.from(productMap.values());
                        const withOEM = allProducts.filter(p => p.oem && p.oem !== 'Unspecified');
                        const withoutOEM = allProducts.filter(p => !p.oem || p.oem === 'Unspecified');
                        
                        target[key] = [...withOEM, ...withoutOEM].slice(0, 150);
                    } else {
                        const existing = new Set(target[key].map(item => JSON.stringify(item)));
                        source[key].forEach(item => {
                            if (!existing.has(JSON.stringify(item))) {
                                target[key].push(item);
                            }
                        });
                    }
                } else if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    if (typeof target[key] !== 'object' || target[key] === null || Array.isArray(target[key])) {
                        target[key] = {};
                    }
                    mergeObjects(target[key], source[key], currentPath);
                } else if (source[key] && source[key] !== 'N/A' && (!target[key] || target[key] === 'N/A')) {
                    target[key] = source[key];
                }
            }
        };
        
        mergeObjects(merged, current);
    }
    
    return merged;
};

/**
 * Repair truncated JSON
 */
const repairTruncatedJSON = (jsonString) => {
    let repaired = jsonString.trim();

    const stack = [];
    let inString = false;
    let lastValidPos = -1;
    let escaped = false;
    
    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        
        if (escaped) {
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            escaped = true;
            continue;
        }
        
        if (char === '"') {
            inString = !inString;
            if (!inString) {
                lastValidPos = i;
            }
            continue;
        }
        
        if (inString) continue;
        
        if (char === '{' || char === '[') {
            stack.push(char);
        } else if (char === '}') {
            if (stack.length > 0 && stack[stack.length - 1] === '{') {
                stack.pop();
                lastValidPos = i;
            }
        } else if (char === ']') {
            if (stack.length > 0 && stack[stack.length - 1] === '[') {
                stack.pop();
                lastValidPos = i;
            }
        } else if (char === ',' || char === ':') {
            if (stack.length > 0) {
                lastValidPos = i;
            }
        }
    }
    
    if (inString && lastValidPos >= 0) {
        repaired = repaired.substring(0, lastValidPos + 1);
        repaired += '"';
        inString = false;
    }
    
    repaired = repaired.replace(/,(\s*[}\]])/, '$1');
    
    stack.length = 0;
    inString = false;
    escaped = false;
    
    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        
        if (escaped) {
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            escaped = true;
            continue;
        }
        
        if (char === '"') {
            inString = !inString;
            continue;
        }
        
        if (inString) continue;
        
        if (char === '{' || char === '[') {
            stack.push(char);
        } else if (char === '}' || char === ']') {
            stack.pop();
        }
    }
    
    if (inString) {
        repaired += '"';
    }
    
    while (stack.length > 0) {
        const opener = stack.pop();
        if (opener === '{') repaired += '}';
        if (opener === '[') repaired += ']';
    }
    
    return repaired;
};

/**
 * Estimate token count
 */
const estimateTokens = (text) => {
    return Math.ceil(text.length / 4);
};

module.exports = {
    generateDepartmentalSummaries
};

