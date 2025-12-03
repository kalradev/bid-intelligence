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

// Chunking configuration
const CHUNK_SIZE_OPENAI = 100000; // ~80k tokens per chunk for OpenAI
const CHUNK_SIZE_GEMINI = 30000; // ~7.5k tokens per chunk for Gemini
const MAX_CONTEXT_OPENAI = 100000; // ~25k tokens, safe limit for input (128k total - output buffer)

/**
 * Generate departmental summaries using AI (OpenAI → Gemini fallback)
 * @param {String} documentText - Extracted document text
 * @param {String} fileName - Original file name
 * @returns {Promise<Object>} - Departmental summaries
 */
const generateDepartmentalSummaries = async (documentText, fileName) => {
    const systemPrompt = `You are an expert RFP/tender analyst. Extract critical bidding intelligence from tender documents.

FOCUS: Extract UNIQUE, SPECIFIC information needed to WIN the bid.

OUTPUT RULES:
- PRIORITIZE data with NUMBERS (amounts, percentages, dates, quantities, thresholds)
- EXCLUDE common/standard requirements (e.g., "bid in INR", "submit original documents", "EMD refundable")
- EXCLUDE self-explanatory points that apply to all tenders
- Include ONLY differentiating factors and unusual requirements
- Arrays: 3-5 MOST CRITICAL items with numeric/specific data
- NO generic advice - only document-specific, actionable intelligence

🚨 CRITICAL: Do NOT make up or infer values that are not in the document!
- If Bid Value not found → Use "N/A"
- Do NOT confuse Estimated Value with Bid Value
- Do NOT guess or calculate missing values`;

    const userPrompt = buildUserPrompt(documentText, fileName);
    
    // Estimate document size
    const estimatedTokens = estimateTokens(documentText);
    const documentTooLarge = estimatedTokens > 25000; // ~100k characters
    
    // Try OpenAI first (if available)
    if (openai) {
        try {
            if (documentTooLarge) {
                console.log(`⚡ Large document (${estimatedTokens} tokens), using OpenAI chunking strategy...`);
                return await processLargeDocument(documentText, fileName, 'openai');
            }
            
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
        if (documentTooLarge) {
            console.log(`⚡ Large document (${estimatedTokens} tokens), using Gemini chunking strategy...`);
            return await processLargeDocument(documentText, fileName, 'gemini');
        }
        
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
    const estimatedTokens = estimateTokens(documentText);
    
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
1. PRIORITIZE information with NUMERIC values (amounts, %, timelines, quantities, thresholds)
2. EXCLUDE common/standard requirements found in most tenders
3. EXCLUDE generic statements like "bid in INR", "original documents required", "standard formats"
4. Focus on UNIQUE, DIFFERENTIATING requirements specific to THIS tender
5. Use compact notation for financial data: "EMD: ₹5L (2%)"
6. Arrays: Include 3-5 MOST CRITICAL items (preferably with numbers)
7. **If field not found, return "N/A" - DO NOT guess, infer, or make up values**
8. **CRITICAL**: Search ENTIRE document for BOQ/BOM/product lists and extract ALL items found
9. **CONSISTENCY MANDATE**: The lastSubmissionDate in projectOverview MUST be the same date used in bidManagement.keyDeadlines
10. **BID VALUE MANDATE**: ONLY extract Bid Value if explicitly found. Do NOT use Estimated Value as Bid Value!

**PRODUCT EXTRACTION (HIGHEST PRIORITY):**
- Scan ENTIRE document for: BOQ (Bill of Quantities), BOM (Bill of Materials), Schedule of Items, Product List, Technical Specifications
- Extract EVERY product/item listed - do NOT skip any entries
- Look for tables, lists, annexures containing product information
- Each row in BOQ/BOM = one product entry in miiProductStatus array
- MANDATORY: Extract ALL items, even if they seem repetitive

**OEM EXTRACTION:**
- Search for brand names in: product descriptions, "Approved Makes", specifications, "Make & Model" columns
- Multiple brands listed → extract FIRST one
- Keywords: "Make:", "Brand:", "or equivalent", "Approved Manufacturer"
- Only return "Unspecified" if NO brand found for that specific product

**MII STATUS:**
- Indian OEMs: ${getAllIndianOEMs().join(', ')}
- Global OEMs: ${getAllGlobalOEMs().join(', ')}
- If mentions "Make in India", "MII compliant", "Class-I Local" → mark as "MII-Compliant"
- If uncertain, use "Requires Review"

**BID VALUE EXTRACTION (Search for ALL alternative names):**
🚨 CRITICAL: Only extract if EXPLICITLY mentioned in the document!

Search for these alternative names:
- Contract Value
- Project Value  
- Tender Value
- Total Bid Amount
- Quoted Amount
- Financial Proposal Value
- BOQ Value / BOQ Total
- Offer Price
- Proposal Value
- Cost of Work
- Estimated Contract Price (ECP)
- Commercial Bid Value
- Total Contract Value
- Work Order Value
- NIT Value (Notice Inviting Tender Value)

⚠️ STRICT RULES FOR BID VALUE:
1. ONLY extract if you find one of the above terms in the document
2. Do NOT use "Estimated Value", "Estimated Cost", or "Estimated Tender Value" as Bid Value
3. Do NOT guess, infer, or calculate Bid Value
4. Do NOT use EMD to calculate Bid Value
5. If NONE of the above terms are found → Use "N/A"
6. When in doubt → Use "N/A"

**ESTIMATED VALUE EXTRACTION (Search for ALL alternative names):**
If "Estimated Value" is not explicitly mentioned, search for these alternatives:
- Estimated Cost
- Project Estimate
- Estimated Tender Value (ETV)
- Approximate Cost
- Indicative Value
- Budgetary Estimate
- Sanctioned Cost / Approved Cost
- Probable Contract Value (PCV)
- Engineer's Estimate
- Cost Estimate
- Projected Cost
- Pre-Tender Estimate (PTE)
- Departmental Estimate
- Government Estimate
- Reserved Price

Return ONLY valid JSON with this structure:

{
  "projectOverview": {
    "projectName": "string",
    "client": "string",
    "tenderId": "string",
    "bidValue": "string (ONLY if EXPLICITLY found using alternative names above. Do NOT use Estimated Value. If not found, use 'N/A')",
    "emd": "string (Earnest Money Deposit with currency. Typically 1-5% of bid value)",
    "completionPeriod": "string (duration)",
    "lastSubmissionDate": "string (deadline with time)"
  },
  "bidManagement": {
    "projectOverview": "string (2-3 sentences: scope, value, timeline with numbers)",
    "keyDeadlines": "string (MUST include bid submission deadline from lastSubmissionDate above - format: 'Bid submission deadline: [DATE]'. Add other critical dates if present)",
    "strategy": "string (1-2 sentences: SPECIFIC approach based on tender requirements)",
    "successFactors": ["3-5 UNIQUE success factors with numeric thresholds/requirements"],
    "keyPoints": ["3-5 SPECIFIC points with data - EXCLUDE common/generic items"],
    "complianceRequirements": ["3-5 UNUSUAL mandatory requirements - EXCLUDE standard docs"],
    "riskAreas": ["2-3 major risks with numeric impact/thresholds"],
    "actionItems": ["3-5 SPECIFIC actions with numeric targets/deadlines"]
  },
  "technical": {
    "totalItems": "integer",
    "compliancePercent": "string",
    "keySpecifications": [
      {
        "productName": "string",
        "specification": "string (SPECIFIC numbers/standards/certifications required)"
      }
    ],
    "criticalRequirements": ["3-5 UNUSUAL technical requirements with specs/numbers - EXCLUDE generic quality standards"],
    "riskAreas": ["2-3 technical risks with numeric thresholds/penalties"],
    "actionItems": ["3-5 SPECIFIC technical actions with measurable targets"]
  },
  "commercial": {
    "estimatedValue": "string (with currency - search ALL alternative names listed above for Estimated Value)",
    "paymentTerms": "string (SPECIFIC percentages/milestones: e.g., 70-20-10)",
    "warranties": "string (SPECIFIC duration/terms with numbers)",
    "penalties": "string (SPECIFIC LD: %/day, max cap)",
    "keyTerms": ["3-5 UNUSUAL commercial terms with numeric values - EXCLUDE standard payment modes"],
    "riskAreas": ["2-3 commercial risks with financial impact/percentages"]
  },
  "finance": {
    "turnoverRequired": "string (SPECIFIC amounts/thresholds)",
    "netWorth": "string (SPECIFIC amounts/thresholds)",
    "bankGuarantee": "string (SPECIFIC amounts/percentages/duration)",
    "eligibilityStatus": "string",
    "financialRequirements": ["3-5 SPECIFIC financial thresholds/ratios with numbers - EXCLUDE generic 'audited statements'"],
    "riskAreas": ["2-3 financial risks with numeric thresholds/penalties"]
  },
  "legal": {
    "contractType": "string",
    "liabilityCap": "string (SPECIFIC amounts/percentages if mentioned)",
    "disputeResolution": "string",
    "requiredDocuments": ["3-5 UNUSUAL required documents - EXCLUDE standard PAN/GST/registrations"],
    "complianceRequirements": ["2-3 SPECIFIC legal requirements with deadlines/thresholds"],
    "riskAreas": ["2-3 legal risks with potential penalties/amounts"]
  },
  "scm": {
    "leadTime": "string (SPECIFIC durations/deadlines)",
    "criticalItems": "integer",
    "miiRequirement": "string (SPECIFIC %/thresholds if mentioned)",
    "riskLevel": "string",
    "sourcingStrategy": "string (1-2 sentences with SPECIFIC requirements/constraints)",
    "keyActions": ["3-5 SPECIFIC SCM actions with numeric targets/deadlines"]
  },
  "productMapping": {
    "sourceType": "string (BOQ or BOM)",
    "totalItems": "integer (total count of ALL items found in document)",
    "totalOEMs": {
      "count": "integer",
      "indian": "integer",
      "global": "integer"
    },
    "productsMapped": "integer (must match miiProductStatus array length)",
    "makeInIndiaMapping": {
      "status": "string",
      "mapped": "integer",
      "unmapped": "integer"
    },
    "miiProductStatus": [
      "ARRAY: List ALL products found in BOQ/BOM/specifications. Do NOT skip items.",
      {
        "productName": "string (exact product name from document)",
        "category": "string (product category/type)",
        "specifications": "string (CRITICAL: Extract actual technical specifications - e.g., '50,000 EPS perpetual license', '10 KVA online UPS', 'Intel Xeon 64GB RAM'. If no specs, empty string '')",
        "quantity": "string (quantity if mentioned)",
        "unit": "string (unit if mentioned)",
        "oem": "string (brand/manufacturer if specified, else 'Unspecified')",
        "miiStatus": "string (MII-Compliant/Non-MII/Requires Review)"
      }
    ]
  }
}

🚨 CRITICAL FOR PRODUCTS - EXTRACT ALL ITEMS:
- You MUST extract ALL products/items listed in the BOQ/BOM/specifications
- Do NOT skip any products - extract EVERY single line item from the document
- Extract up to 100 products per chunk (prioritize those with OEM/brand mentions first)
- Maximum 200 products in final output across all chunks
- MANDATORY: Include ALL products with specified OEMs/brands (do NOT skip these)
- For repetitive commodity items without OEMs (e.g., "Cable 1m", "Cable 2m", "Cable 3m"), you may include representative samples
- When in doubt, INCLUDE the product rather than skip it

❌ EXCLUDE THESE GENERIC POINTS (Examples):
- "Bid amount should be in INR"
- "Submit original documents"
- "EMD is refundable to unsuccessful bidders"
- "Maintain quality standards"
- "Follow tender timeline"
- "Provide company registration"
- "PAN/GST/Aadhaar required"
- "Bid validity: 90 days" (unless unusual duration)
- "Standard payment terms apply"

✅ INCLUDE SPECIFIC POINTS (Examples):
- "Turnover: min ₹50Cr in last 3 years (FY21-23)"
- "LD: 0.5%/week, max 10% of order value"
- "Delivery penalty: ₹10,000/day after 120 days"
- "Performance guarantee: 10% for 24 months"
- "Response time SLA: <4 hours or ₹5000 penalty/incident"
- "MII compliance: minimum 60% local content mandatory"
- "EMD: ₹2.5L (unusually high for ₹50L tender)"

🔥 PRODUCT EXTRACTION MANDATE:
- If document has 50 items in BOQ → extract ALL 50 items
- If document has 200 items → extract up to 200 items (prioritize items with OEM mentions)
- Do NOT summarize products into categories - list each individual item
- Example: If BOQ lists "Switch 24-port", "Switch 48-port", "Router Cisco" → extract all 3 separately

⚠️ CONSISTENCY CHECK - CRITICAL:
- projectOverview.lastSubmissionDate = "2023-12-15 15:00:00"
- bidManagement.keyDeadlines MUST include = "Bid submission deadline: 2023-12-15 15:00:00"
- These MUST be the SAME date. Do NOT put N/A in keyDeadlines if lastSubmissionDate is found!

🚨 BID VALUE vs ESTIMATED VALUE - DO NOT CONFUSE:
CORRECT Extraction:
- Document says "Contract Value: ₹50 Cr" → bidValue: "₹50 Crore" ✓
- Document says "Estimated Cost: ₹100 Cr" → bidValue: "N/A", estimatedValue: "₹100 Crore" ✓
- Document has NO Contract/Bid/Tender Value → bidValue: "N/A" ✓

WRONG Extraction (DO NOT DO THIS):
- Document says "Estimated Cost: ₹50 Cr" → bidValue: "₹50 Crore" ✗ (This is Estimated Value, NOT Bid Value!)
- Document has no Bid Value → bidValue: "₹50 Crore" ✗ (Do NOT make up values!)
- Calculating from EMD → bidValue: "₹50 Crore" ✗ (Do NOT infer values!)`;
};

/**
 * Process large documents with chunking (OpenAI and Gemini)
 * @param {String} documentText - Document text to chunk
 * @param {String} fileName - File name
 * @param {String} provider - 'openai' or 'gemini'
 */
const processLargeDocument = async (documentText, fileName, provider = 'gemini') => {
    // Use different chunk sizes based on provider
    const chunkSize = provider === 'openai' ? CHUNK_SIZE_OPENAI : CHUNK_SIZE_GEMINI;
    const chunks = [];

    for (let i = 0; i < documentText.length; i += chunkSize) {
        chunks.push(documentText.slice(i, i + chunkSize));
    }

    console.log(`📄 Processing large document with ${provider.toUpperCase()} in ${chunks.length} chunks (${chunkSize} chars each)...`);

    const chunkResults = [];
    for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
        let retryCount = 0;
        let success = false;
        
        while (retryCount <= 2 && !success) {
            try {
                const systemPrompt = `You are an expert RFP/tender analyst. Extract critical bidding intelligence from tender documents.

FOCUS: Extract UNIQUE, SPECIFIC information needed to WIN the bid.

OUTPUT RULES:
- PRIORITIZE data with NUMBERS (amounts, percentages, dates, quantities, thresholds)
- EXCLUDE common/standard requirements (e.g., "bid in INR", "submit original documents", "EMD refundable")
- EXCLUDE self-explanatory points that apply to all tenders
- Include ONLY differentiating factors and unusual requirements
- Arrays: 3-5 MOST CRITICAL items with numeric/specific data
- NO generic advice - only document-specific, actionable intelligence

🚨 CRITICAL: Do NOT make up or infer values that are not in the document!
- If Bid Value not found → Use "N/A"
- Do NOT confuse Estimated Value with Bid Value
- Do NOT guess or calculate missing values

🔥 CRITICAL FOR THIS CHUNK: Extract ALL products/items from BOQ/BOM found in this section.

⚠️ CONSISTENCY: projectOverview.lastSubmissionDate MUST match the date in bidManagement.keyDeadlines. Do NOT use N/A if date is found!`;

                const userPrompt = buildUserPrompt(chunks[i], `${fileName} (Part ${i + 1}/${chunks.length})`);
                
                let result;
                if (provider === 'openai' && openai) {
                    result = await generateWithOpenAI(systemPrompt, userPrompt);
                } else {
                    result = await generateWithGemini(systemPrompt, userPrompt, chunks[i], `${fileName} (Part ${i + 1}/${chunks.length})`);
                }
                
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
        model: provider === 'openai' ? OPENAI_MODEL : GEMINI_MODEL,
        provider: provider
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
                        
                        // Increased limit to 200 products to capture more items
                        target[key] = [...withOEM, ...withoutOEM].slice(0, 200);
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

