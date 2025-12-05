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

CRITICAL: FINANCIAL DATA EXTRACTION
- EMD amount: Extract EXACT value from document ONLY IF PRESENT. If NOT mentioned in document, return "N/A" (do NOT calculate or estimate)
- Bid value: Extract EXACT value from document (do NOT estimate)
- If document says "₹15 Crore", write "₹15 Crore" - do NOT convert to "₹5L"
- If document says "2% of bid value", write "2% of bid value" - do NOT calculate the amount
- NEVER add parenthetical examples like "(2%)" unless document explicitly states it
- When in doubt, extract verbatim text from document

CRITICAL: DEDUPLICATION & CONSOLIDATION
- **REMOVE DUPLICATES**: If same information appears multiple times (e.g., "Turnover: min ₹50Cr" and "Minimum annual turnover of ₹300 Crore"), consolidate into ONE clear statement
- **RESOLVE CONFLICTS**: If conflicting values appear, use the MOST SPECIFIC or MOST RECENT (from corrigendum) value
- **CONSOLIDATE SIMILAR ITEMS**: Group similar requirements together (e.g., multiple turnover requirements → single consolidated statement)
- **NO REPETITION**: Each unique piece of information should appear only ONCE in the summary

CRITICAL: ORGANIZED SUMMARIES WITH SUBHEADINGS
- Organize successFactors, keyPoints, complianceRequirements, and riskAreas by logical categories
- Use subheadings like: "Financial", "Technical", "Operational", "Legal", "Timeline", "Quality", "Compliance", etc.
- Group related items together under appropriate subheadings
- Example structure: {"Financial": ["item1", "item2"], "Technical": ["item3", "item4"]}
- If an item doesn't fit a category, use "General" or "Other"

CRITICAL: LEGAL COMPLIANCE DOCUMENTS
- **STEP 1**: Search document for explicitly mentioned compliance documents/certificates
- **STEP 2**: If documents are mentioned → Extract them exactly as stated
- **STEP 3**: If NO documents mentioned → Infer required documents based on:
  * Project type (IT/Infrastructure/Civil/Electrical)
  * Industry standards (ISO certifications, BIS, RoHS, etc.)
  * Government requirements (MII certificates, GST registration, etc.)
  * Contract value (higher value = more compliance requirements)
- **COMMON DOCUMENTS**: ISO 9001, ISO 14001, ISO 27001, GST Certificate, PAN, Company Registration, MII Certificate, BIS Certification, RoHS Compliance, etc.
- Return array of documents that would typically be required for this type of project

Return ONLY a valid JSON object with this EXACT structure:

{
  "projectOverview": {
    "projectName": "string (exact project name from tender)",
    "client": "string (client/purchaser organization name)",
    "tenderId": "string (CRITICAL: Search ENTIRE document for Tender ID using ALL these alternative names: Tender Reference Number, Tender Ref No., Bid ID, Bid Reference Number, RFP Number, RFP ID, RFQ Number, EOI Number, Procurement Reference Number, Procurement ID, Notice Number, NIT Number, NIT ID, Project ID, Work ID, Work Reference Number, Document Number, Contract ID, Solicitation Number, Enquiry Number, Quotation Number, Notice ID. Extract the EXACT value found. If NOT found, use filename as fallback, but ONLY if no tender ID is found in document)",
    "bidValue": "string (estimated bid value with currency, e.g., ₹450 Cr)",
    "emd": "string (CRITICAL: Extract EXACT EMD amount from document ONLY IF PRESENT. If NOT mentioned in document, return 'N/A'. Do NOT calculate. Do NOT add percentage unless document shows both. If document says '₹15 Crore', write '₹15 Crore' NOT '₹5L (2%)')",
    "completionPeriod": "string (project duration in weeks/months)",
    "lastSubmissionDate": "string (bid submission deadline with time)"
  },
  "bidManagement": {
    "projectOverview": "string (1-3 sentence description of project scope)",
    "keyDeadlines": "string (key dates: submission, technical opening, financial opening)",
    "strategy": "string (recommended bid strategy aligned with tender scoring)",
    "successFactors": {
      "Financial": ["financial success factors - consolidate duplicates"],
      "Technical": ["technical success factors"],
      "Operational": ["operational success factors"],
      "Compliance": ["compliance-related success factors"]
    },
    "keyPoints": {
      "Deadlines": ["deadline-related points - consolidate duplicates"],
      "Requirements": ["requirement-related points"],
      "Specifications": ["specification-related points"],
      "Financial": ["financial points - consolidate duplicates"]
    },
    "criticalDates": [{"date": "YYYY-MM-DD or as stated", "description": "what happens on this date"}],
    "complianceRequirements": {
      "Financial": ["financial compliance requirements"],
      "Technical": ["technical compliance requirements"],
      "Documentation": ["documentation requirements"],
      "Legal": ["legal compliance requirements"]
    },
    "riskAreas": {
      "Financial": ["financial risks"],
      "Technical": ["technical risks"],
      "Operational": ["operational risks"],
      "Timeline": ["timeline-related risks"]
    },
    "actionItems": ["array of recommended bid preparation actions"]
  },
  "technical": {
    "totalItems": "integer or string (BOQ or BOM line item count - use whichever is available)",
    "compliancePercent": "string (percentage estimate of specification compliance)",
    "keySpecifications": ["array of main technical categories/technologies"],
    "gapsIdentified": ["array of missing or unclear technical requirements"],
    "keyPoints": {
      "Performance": ["performance-related points"],
      "Standards": ["standards and certifications"],
      "Compatibility": ["compatibility requirements"],
      "Quality": ["quality-related points"]
    },
    "criticalDates": [{"date": "YYYY-MM-DD", "description": "technical milestone"}],
    "complianceRequirements": {
      "Performance": ["performance-related requirements"],
      "Standards": ["standards and certifications required"],
      "Compatibility": ["compatibility requirements"],
      "Quality": ["quality-related requirements"]
    },
    "riskAreas": {
      "Technical": ["technical implementation risks"],
      "Compatibility": ["compatibility risks"],
      "Performance": ["performance-related risks"],
      "Standards": ["standards compliance risks"]
    },
    "actionItems": ["array of technical preparation actions"]
  },
  "commercial": {
    "estimatedValue": "string (total contract value estimate)",
    "paymentTerms": "string (payment schedule and terms)",
    "warranties": "string (warranty period and terms)",
    "penalties": "string (liquidated damages and penalty clauses)",
    "keyPoints": {
      "Payment": ["payment-related terms"],
      "Warranty": ["warranty-related terms"],
      "Penalties": ["penalty and LD terms"],
      "Contract": ["contract-related terms"]
    },
    "criticalDates": [{"date": "YYYY-MM-DD", "description": "commercial milestone"}],
    "complianceRequirements": {
      "Payment": ["payment compliance requirements"],
      "Warranty": ["warranty compliance requirements"],
      "Contract": ["contract compliance requirements"]
    },
    "riskAreas": {
      "Financial": ["financial/commercial risks"],
      "Payment": ["payment-related risks"],
      "Penalties": ["penalty-related risks"],
      "Contract": ["contract-related risks"]
    },
    "actionItems": ["array of commercial preparation actions"]
  },
  "finance": {
    "turnoverRequired": "string (CONSOLIDATE: If multiple turnover values mentioned, use the HIGHEST/MOST STRINGENT one and note the period clearly, e.g., 'Minimum ₹300 Crore in last 3 years (FY21-23)')",
    "bankGuarantee": "string (PBG/bank guarantee amount and percentage)",
    "eligibilityStatus": "string (Compliant, Partially Compliant, Non-Compliant, N/A)",
    "profitabilityNotes": "string (1-3 sentence margin and risk note)",
    "keyPoints": {
      "Turnover": ["turnover requirements - consolidate duplicates into single clear statement"],
      "Net Worth": ["net worth requirements"],
      "Bank Guarantee": ["bank guarantee requirements"],
      "Eligibility": ["eligibility criteria"]
    },
    "criticalDates": [{"date": "YYYY-MM-DD", "description": "financial milestone"}],
    "complianceRequirements": {
      "Turnover": ["turnover compliance requirements"],
      "Net Worth": ["net worth compliance requirements"],
      "Bank Guarantee": ["bank guarantee compliance requirements"],
      "Eligibility": ["eligibility compliance requirements"]
    },
    "riskAreas": {
      "Financial": ["financial risks"],
      "Eligibility": ["eligibility-related risks"],
      "Cash Flow": ["cash flow risks"],
      "Guarantees": ["guarantee-related risks"]
    },
    "actionItems": ["array of financial preparation actions"]
  },
  "legal": {
    "contractType": "string (e.g., EPC, Turnkey, SITC)",
    "liabilityCap": "string (limitation of liability amount or percentage)",
    "disputeResolution": "string (arbitration, court jurisdiction details)",
    "requiredComplianceDocuments": ["CRITICAL: Extract ALL compliance documents mentioned in document. If NONE mentioned, infer based on project type: ISO 9001, ISO 14001, ISO 27001 (for IT projects), GST Certificate, PAN, Company Registration, MII Certificate, BIS Certification, RoHS Compliance, Fire Safety Certificate, Pollution Control Certificate, etc. Return 5-8 typical documents for this project type"],
    "keyPoints": {
      "Contract": ["contract-related points"],
      "Liability": ["liability-related points"],
      "Disputes": ["dispute resolution points"],
      "Compliance": ["compliance-related points"]
    },
    "criticalDates": [{"date": "YYYY-MM-DD", "description": "legal milestone"}],
    "complianceRequirements": {
      "Legal": ["legal compliance requirements"],
      "Regulatory": ["regulatory compliance requirements"],
      "Documentation": ["documentation requirements"],
      "Certifications": ["certification requirements"]
    },
    "riskAreas": {
      "Legal": ["legal risks"],
      "Liability": ["liability-related risks"],
      "Disputes": ["dispute resolution risks"],
      "Compliance": ["compliance-related risks"]
    },
    "actionItems": ["array of legal preparation actions"]
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
    // Split document into larger chunks for faster processing
    // GPT-4o supports 128k token context window, so we can use larger chunks
    const chunkSize = 100000; // Increased to 100k characters (~25k tokens) for faster processing
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
