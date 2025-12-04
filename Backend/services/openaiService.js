const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Model configuration
const MODEL = 'gpt-4o'; // Using GPT-4o for better rate limits and efficiency
const TEMPERATURE = 0.3;
const MAX_TOKENS = 4096;

/**
 * Generate departmental summaries from RFP document
 * @param {String} documentText - Extracted document text
 * @param {String} fileName - Original file name
 * @returns {Promise<Object>} - Departmental summaries
 */
const generateDepartmentalSummaries = async (documentText, fileName) => {
    try {
        const systemPrompt = `You are an expert RFP/tender analyst with deep expertise in analyzing complex bid documents. Your role is to break down large tender documents into clear, actionable summaries for different business functions.

You must analyze documents thoroughly and extract the most relevant information for each department while maintaining accuracy and completeness.`;

        const userPrompt = `You are analyzing an RFP/tender document. Extract ALL values into the specified JSON schema below. If a field cannot be found confidently, return "N/A".

Document: ${fileName}

=== DOCUMENT CONTENT ===
${documentText}
=== END DOCUMENT ===

EXTRACTION RULES:
1. If the tender does not clearly mention a value, return "N/A"
2. Preserve currency symbols and units exactly (₹, %, Cr)
3. Use tender wording for legal and commercial text when available
4. If multiple docs exist (BOQ + Corrigendum + RFP), use the latest corrigendum where contradictory
5. Do not hallucinate values — only use what is written in tender
6. Search for BOQ (Bill of Quantities) first; if not found, search for BOM (Bill of Materials) instead
7. Extract product/material items from whichever source (BOQ or BOM) is available in the document

Return ONLY a valid JSON object with this EXACT structure:

{
  "projectOverview": {
    "projectName": "string (exact project name from tender)",
    "client": "string (client/purchaser organization name)",
    "tenderId": "string (RFP/tender reference number)",
    "bidValue": "string (estimated bid value with currency, e.g., ₹450 Cr)",
    "emd": "string (EMD amount with currency)",
    "completionPeriod": "string (project duration in weeks/months)",
    "lastSubmissionDate": "string (bid submission deadline with time)"
  },
  "bidManagement": {
    "projectOverview": "string (1-3 sentence description of project scope)",
    "keyDeadlines": "string (key dates: submission, technical opening, financial opening)",
    "strategy": "string (recommended bid strategy aligned with tender scoring)",
    "successFactors": ["array", "of", "strings", "listing critical success factors"],
    "keyPoints": ["array of 5-10 most important bid management points"],
    "criticalDates": [{"date": "YYYY-MM-DD or as stated", "description": "what happens on this date"}],
    "complianceRequirements": ["array of mandatory bid compliance items"],
    "riskAreas": ["array of potential bid risks or challenges"],
    "actionItems": ["array of recommended bid preparation actions"]
  },
  "technical": {
    "totalItems": "integer or string (BOQ or BOM line item count - use whichever is available)",
    "compliancePercent": "string (percentage estimate of specification compliance)",
    "keySpecifications": ["array of main technical categories/technologies"],
    "gapsIdentified": ["array of missing or unclear technical requirements"],
    "keyPoints": ["array of 5-10 critical technical points"],
    "criticalDates": [{"date": "YYYY-MM-DD", "description": "technical milestone"}],
    "complianceRequirements": ["array of technical compliance items"],
    "riskAreas": ["array of technical risks"],
    "actionItems": ["array of technical preparation actions"]
  },
  "commercial": {
    "estimatedValue": "string (total contract value estimate)",
    "paymentTerms": "string (payment schedule and terms)",
    "warranties": "string (warranty period and terms)",
    "penalties": "string (liquidated damages and penalty clauses)",
    "keyPoints": ["array of 5-10 key commercial terms"],
    "criticalDates": [{"date": "YYYY-MM-DD", "description": "commercial milestone"}],
    "complianceRequirements": ["array of commercial compliance items"],
    "riskAreas": ["array of commercial risks"],
    "actionItems": ["array of commercial preparation actions"]
  },
  "finance": {
    "turnoverRequired": "string (minimum average annual turnover required)",
    "bankGuarantee": "string (PBG/bank guarantee amount and percentage)",
    "eligibilityStatus": "string (Compliant, Partially Compliant, Non-Compliant, N/A)",
    "profitabilityNotes": "string (1-3 sentence margin and risk note)",
    "keyPoints": ["array of 5-10 key financial points"],
    "criticalDates": [{"date": "YYYY-MM-DD", "description": "financial milestone"}],
    "complianceRequirements": ["array of financial compliance items"],
    "riskAreas": ["array of financial risks"],
    "actionItems": ["array of financial preparation actions"]
  },
  "legal": {
    "contractType": "string (e.g., EPC, Turnkey, SITC)",
    "liabilityCap": "string (limitation of liability amount or percentage)",
    "disputeResolution": "string (arbitration, court jurisdiction details)",
    \"requiredComplianceDocuments\": [\"array of required legal/compliance certificates\"],
    \"keyPoints\": [\"array of 5-10 key legal points\"],
    \"criticalDates\": [{\"date\": \"YYYY-MM-DD\", \"description\": \"legal milestone\"}],
    \"complianceRequirements\": [\"array of legal compliance items\"],
    \"riskAreas\": [\"array of legal risks\"],
    \"actionItems\": [\"array of legal preparation actions\"]
  },
  \"scm\": {
    \"leadTime\": \"string (EXTRACT: Overall delivery timeline, installation period, commissioning time)\",
    \"criticalItems\": \"integer or string (Count of time-critical or long lead-time items)\",
    \"miiRequirement\": \"string (EXTRACT: MII compliance %, local content requirements, Class-I/II supplier requirements)\",
    \"riskLevel\": \"string (High/Medium/Low based on delivery constraints, supplier availability, import dependencies)\",
    \"sourcingStrategy\": \"string (DETAILED: Primary sourcing approach - local vs import, preferred vendors, backup strategies, 3-5 sentences)\",
    \"deliverySchedule\": \"string (EXTRACT: Phased delivery milestones, staggered shipments, installation timelines)\",
    \"warehousingNeeds\": \"string (Storage requirements, site logistics, handling specifications)\",
    \"qualityControl\": \"string (Inspection protocols, testing requirements, acceptance criteria)\",
    \"supplierRequirements\": [\"Array of supplier eligibility: certifications needed, experience, turnover, registration requirements\"],
    \"logisticsConstraints\": [\"Array of logistical challenges: site access, transportation modes, customs/import clearance\"],
    \"inventoryManagement\": \"string (Stock planning, buffer inventory, just-in-time delivery requirements)\",
    \"riskMitigation\": [\"Array of SCM risks and mitigation: supplier defaults, delays, quality issues, import restrictions\"],
    \"keyActions\": [\"5-8 DETAILED SCM actions: sourcing, vendor selection, logistics planning, quality checks, compliance verification\"]
  },
  \"productMapping\": {
    \"sourceType\": \"string (BOQ or BOM - indicate which source was used for product mapping)\",
    \"totalItems\": \"integer or string (total number of unique product/material items in BOQ or BOM - use whichever is available)\",
    \"totalOEMs\": {
      \"count\": \"integer or string (total distinct OEM brands detected)\",
      \"indian\": \"integer or string (number of Indian OEMs)\",
      \"global\": \"integer or string (number of foreign/global OEMs)\"
    },
    \"productsMapped\": \"integer or string (number of products successfully mapped to OEM brands)\",
    \"makeInIndiaMapping\": {
      \"status\": \"string (Compliant, Non-Compliant, Partial, N/A - overall MII compliance score)\",
      \"mapped\": \"integer or string (BOQ/BOM items mapped to MII-compliant OEMs)\",
      \"unmapped\": \"integer or string (BOQ/BOM items NOT satisfying MII compliance or without valid OEM mapping)\"
    },
    \"miiProductStatus\": [
      {
        \"productName\": \"string (BOQ/BOM item name exactly as written in tender)\",
        \"category\": \"string (e.g., Hardware, Software, Civil, Electrical, etc.)\",
        \"specifications\": \"string (CRITICAL: Provide DETAILED, COMPREHENSIVE specifications (150-200 characters). If in document → extract. If NOT in document → GENERATE detailed specs based on product type. NEVER use 'N/A' or leave empty. Examples: 'USB 3.1 Gen 2, 10Gbps transfer, gold-plated connectors, 6ft length, braided nylon, reversible design' OR 'REST API integration, 10K tickets/day capacity, ITIL compliant, SLA tracking, multi-tenant architecture, reporting dashboard' OR 'SAML 2.0/OIDC support, multi-factor authentication, role-based access control, 100+ device onboarding, audit logging'. ALWAYS provide 3-5 technical details per product)\",
        \"quantity\": \"string (quantity if mentioned)\",
        \"unit\": \"string (unit if mentioned)\",
        \"oem\": \"string (CRITICAL: If OEM in document → extract it. If NOT in document → PROVIDE UNIQUE, PRODUCT-SPECIFIC OEM. Match OEM to exact product type. Examples: USB cables → 'Anker' or 'Belkin' or 'Cable Matters', Bluetooth adapter → 'TP-Link' or 'ASUS', DVD writer → 'ASUS' or 'LG', SATA cables → 'StarTech' or 'Sabrent', Identity platform → 'Okta' or 'SailPoint', Firewall → 'Fortinet' or 'Palo Alto Networks'. NEVER reuse same OEM for multiple products. NEVER use generic 'Microsoft/IBM/Oracle' for cables/accessories. NEVER use 'Unspecified', 'N/A', 'TBD')\",
        \"miiStatus\": \"string (Indian OEM / Global OEM / MII-Compliant 60% / etc.)\"
      }
    ]
  }
}

IMPORTANT: Return ONLY the JSON object. Be thorough and extract ALL available information from the tender document.`;

        // Check token count and chunk if necessary
        const estimatedTokens = estimateTokens(documentText);

        console.log(`Estimated tokens: ${estimatedTokens}`);

        if (estimatedTokens > 20000) {
            // Document is too large, need to chunk to avoid rate limits
            console.log('Document too large, using chunking strategy...');
            return await processLargeDocument(documentText, fileName);
        }

        // Make API call to OpenAI
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
            response_format: { type: 'json_object' }
        });

        const responseText = completion.choices[0].message.content;
        const summaries = JSON.parse(responseText);

        return {
            summaries,
            usage: completion.usage,
            model: MODEL
        };

    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error(`Failed to generate summaries: ${error.message}`);
    }
};

/**
 * Process large documents by chunking
 * @param {String} documentText - Full document text
 * @param {String} fileName - Original file name
 * @returns {Promise<Object>} - Combined summaries
 */
const processLargeDocument = async (documentText, fileName) => {
    // Split document into smaller chunks (approx 15k tokens each = 60k chars)
    // Using smaller chunks to respect rate limits
    const chunkSize = 60000; // characters (rough estimate: 1 token ≈ 4 chars)
    const chunks = [];

    for (let i = 0; i < documentText.length; i += chunkSize) {
        chunks.push(documentText.slice(i, i + chunkSize));
    }

    console.log(`Processing large document in ${chunks.length} chunks...`);

    // Process each chunk
    const chunkResults = [];
    for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
        const result = await generateDepartmentalSummaries(chunks[i], `${fileName} (Part ${i + 1})`);
        chunkResults.push(result.summaries);
    }

    // Merge results with a consolidation pass
    const consolidationPrompt = `Consolidate the following departmental summaries from multiple chunks of the same RFP document into a single, coherent summary for each department.

${JSON.stringify(chunkResults, null, 2)}

Merge overlapping information, remove duplicates, and maintain the same JSON structure.`;

    const consolidation = await openai.chat.completions.create({
        model: MODEL,
        messages: [
            { role: 'system', content: 'You are an expert at consolidating and merging document summaries.' },
            { role: 'user', content: consolidationPrompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        response_format: { type: 'json_object' }
    });

    const finalSummaries = JSON.parse(consolidation.choices[0].message.content);

    return {
        summaries: finalSummaries,
        chunked: true,
        chunkCount: chunks.length,
        model: MODEL
    };
};

/**
 * Estimate token count for text
 * @param {String} text - Text to estimate
 * @returns {Number} - Estimated token count
 */
const estimateTokens = (text) => {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
};

module.exports = {
    generateDepartmentalSummaries
};
