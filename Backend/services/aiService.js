/**
 * Unified AI Service - OpenAI Only
 * 
 * Uses OpenAI API for all AI operations (paid account with generous limits)
 */

const OpenAI = require('openai');
const { getAllIndianOEMs, getAllGlobalOEMs } = require('../data/miiDatabase');

// Initialize OpenAI client
let openai = null;

// Initialize OpenAI - API key is required
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    try {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        console.log('✅ OpenAI client initialized');
    } catch (error) {
        console.error('❌ OpenAI initialization failed:', error.message);
        throw new Error('OpenAI client initialization failed. Please check your OPENAI_API_KEY.');
    }
} else {
    console.error('❌ OPENAI_API_KEY not found in .env');
    throw new Error('OPENAI_API_KEY is required but not found in environment variables.');
}

// Configuration
const OPENAI_MODEL = 'gpt-4o-mini'; // Cost-effective model
const TEMPERATURE = 0.3;
const MAX_TOKENS_OPENAI = 16384;

// Chunking configuration
const CHUNK_SIZE_OPENAI = 150000; // ~37.5k tokens per chunk for OpenAI (128k context window supports this)
const MAX_CONTEXT_OPENAI = 100000; // ~25k tokens, safe limit for input (128k total - output buffer)

/**
 * Generate departmental summaries using OpenAI
 * @param {String} documentText - Extracted document text
 * @param {String} fileName - Original file name
 * @returns {Promise<Object>} - Departmental summaries
 */
const generateDepartmentalSummaries = async (documentText, fileName) => {
    if (!openai) {
        throw new Error('OpenAI client not initialized. Please check your OPENAI_API_KEY.');
    }
    
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

CRITICAL: ORGANIZED SUMMARIES WITH SUBHEADINGS
- Organize successFactors, keyPoints, complianceRequirements, and riskAreas by logical categories
- Use subheadings like: "Financial", "Technical", "Operational", "Legal", "Timeline", "Quality", "Compliance", etc.
- Group related items together under appropriate subheadings
- Example structure: {"Financial": ["item1", "item2"], "Technical": ["item3", "item4"]}
- If an item doesn't fit a category, use "General" or "Other"
- MANDATORY: Use object structure with subheadings, NOT flat arrays

💰 PRICING APPOINTMENT & PRICING BID EXTRACTION:
For commercial.pricingAppointment: Extract ALL mentions of:
- pricing appointment, appointment of pricing committee, price bid appointment schedule
- scheduled pricing meeting, evaluation committee meeting date
- financial bid opening appointment, tender fee appointment time, price negotiation schedule
- Return event name, date, time, location (if available), and any notes

For commercial.pricingBid: Extract ALL mentions of:
- pricing bid, price bid, financial bid, commercial bid, BOQ submission, cost sheet
- financial evaluation, price schedule, L1 criteria, payment schedule, price format
- Return: requirements, format required, mandatory documents, submission instructions
- evaluation criteria, conditions for disqualification, payment terms, taxes & charges
- If not found, return empty arrays/strings - DO NOT guess or make up information

📋 BID MANAGEMENT EXTRACTION (CRITICAL):
For bidManagement.successFactors.emdExemption: Extract ALL mentions of:
- EMD exemption, MSME exemption, Startup India exemption, EMD waiver, EMD relaxation
- exemption categories, documents needed for exemption
- Return: who is exempt, conditions for exemption, documents required, reference clause (if available)
- Extract even if embedded in tables, footnotes, or annexures
- If not found, return empty array - DO NOT create fake data

For bidManagement.successFactors.technicalEvaluationCriteria: Extract ALL mentions of:
- technical evaluation methodology, scoring pattern, weightage, marks allocation
- qualification thresholds, technical bid evaluation rules
- functional/technical compliance criteria
- Return: evaluation parameters, scoring system, minimum qualifying score, mandatory compliance points
- Extract exact wording from document - do not rewrite or modify meaning
- If not found, return empty array - DO NOT guess

For bidManagement.successFactors.preQualificationCriteria: Extract ALL mentions of:
- eligibility criteria, PQ criteria, bidder must have, experience requirements
- turnover criteria, certifications required, manpower requirements, OEM requirements
- Return: each PQ requirement as a bullet point with numbers exactly as written (years, turnover, certificates)
- Extract exact wording - preserve all numbers and specifications
- If not found, return empty array - DO NOT infer requirements

⚠️ BID MANAGEMENT RISK FACTORS EXTRACTION (CRITICAL):
For bidManagement.riskFactors.liquidatedDamages: Extract ALL mentions of:
- liquidated damages, LD penalty, penalty for delay, delay penalty, performance penalty
- compensation for delay, SLA violation penalty, penalty clause, LD rate (% per week or per day)
- maximum LD cap
- Return: all LD conditions, percentage/amount mentioned, max cap (like "10% of contract value"), timeline triggers
- Extract exact wording from document - preserve all percentages, amounts, and conditions
- If not found, return empty array - DO NOT guess

For bidManagement.riskFactors.siteSurvey: Extract ALL mentions of:
- site survey, pre-bid site visit, mandatory site inspection, bidder must visit site
- physical verification before bidding, site assessment, location survey responsibility
- Return: what is required in site survey, whether it is mandatory, responsibilities of bidder
- documents/report to be submitted
- Extract even if embedded in tables, footnotes, or annexures
- If not found, return empty array - DO NOT create fake data

For bidManagement.riskFactors.certifications: Extract ALL mentions of:
- certifications required, technical certifications, OEM certifications, ISO certifications
- compliance certificates, supporting documents, mandatory certificates, local certifications
- Return: list of required certificates, issuing authority if mentioned, validity conditions
- compliance standards
- Extract exact certificate names and requirements - preserve all specifications
- If not found, return empty array - DO NOT infer certifications`;

    const userPrompt = buildUserPrompt(documentText, fileName);
    
    // Estimate document size
    const estimatedTokens = estimateTokens(documentText);
    const documentTooLarge = estimatedTokens > 25000; // ~100k characters
    
    try {
        if (documentTooLarge) {
            console.log(`⚡ Large document (${estimatedTokens} tokens), using OpenAI chunking strategy...`);
            return await processLargeDocument(documentText, fileName);
        }
        
        console.log('🤖 Generating summaries with OpenAI (gpt-4o-mini)...');
        const result = await generateWithOpenAI(systemPrompt, userPrompt);
        console.log('✅ OpenAI generation successful');
        return result;
    } catch (error) {
        console.error('❌ OpenAI generation failed:', error.message);
        throw new Error(`AI generation failed: ${error.message}`);
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

**TENDER ID EXTRACTION (CRITICAL - Search for ALL alternative names):**
🚨 MANDATORY: Search ENTIRE document for Tender ID using ALL these alternative names:
- Tender Reference Number, Tender Ref No., Bid ID, Bid Reference Number
- RFP Number, RFP ID, RFQ Number, EOI Number
- Procurement Reference Number, Procurement ID
- Notice Number, NIT Number (Notice Inviting Tender Number), NIT ID
- Project ID, Work ID, Work Reference Number
- Document Number, Contract ID
- Solicitation Number (US/International)
- Enquiry Number, Quotation Number, Notice ID

⚠️ STRICT RULES:
1. Search for ALL the above terms in the document
2. Extract the EXACT value/number found (e.g., "RFP-2024-001", "NIT-123/2024", "Tender No. ABC/XYZ/2024")
3. Do NOT use the filename (e.g., "RFP-Volume2_merged.pdf") unless NO tender ID is found anywhere in the document
4. If multiple tender IDs found, use the MOST PROMINENT one (usually in header/first page/title)
5. If NONE found after searching all terms → Use filename as last resort only

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

**TENDER ID EXTRACTION (Search for ALL alternative names):**
🚨 CRITICAL: Search ENTIRE document for Tender ID using ALL these alternative names:
- Tender Reference Number
- Tender Ref No.
- Bid ID
- Bid Reference Number
- RFP Number
- RFP ID
- RFQ Number
- EOI Number
- Procurement Reference Number
- Procurement ID
- Notice Number
- NIT Number (Notice Inviting Tender Number)
- NIT ID
- Project ID
- Work ID
- Work Reference Number
- Document Number
- Contract ID
- Solicitation Number (US/International)
- Enquiry Number
- Quotation Number
- Notice ID

⚠️ STRICT RULES FOR TENDER ID:
1. Search for ALL the above terms in the document
2. Extract the EXACT value/number found (e.g., "RFP-2024-001", "NIT-123/2024", "Tender No. ABC/XYZ/2024")
3. Do NOT use the filename (e.g., "RFP-Volume2_merged.pdf") unless NO tender ID is found in the document
4. If multiple tender IDs found, use the MOST PROMINENT one (usually in header/first page)
5. If NONE found → Use filename as last resort

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
    "tenderId": "string (CRITICAL: Search ENTIRE document for Tender ID using ALL these alternative names: Tender Reference Number, Tender Ref No., Bid ID, Bid Reference Number, RFP Number, RFP ID, RFQ Number, EOI Number, Procurement Reference Number, Procurement ID, Notice Number, NIT Number, NIT ID, Project ID, Work ID, Work Reference Number, Document Number, Contract ID, Solicitation Number, Enquiry Number, Quotation Number, Notice ID. Extract the EXACT value found. If NOT found, use filename as fallback, but ONLY if no tender ID is found in document)",
    "bidValue": "string (ONLY if EXPLICITLY found using alternative names above. Do NOT use Estimated Value. If not found, use 'N/A')",
    "emd": "string (Earnest Money Deposit with currency. Typically 1-5% of bid value)",
    "completionPeriod": "string (duration)",
    "lastSubmissionDate": "string (deadline with time)"
  },
  "bidManagement": {
    "projectOverview": "string (2-3 sentences: scope, value, timeline with numbers)",
    "keyDeadlines": "string (MUST include bid submission deadline from lastSubmissionDate above - format: 'Bid submission deadline: [DATE]'. Add other critical dates if present)",
    "strategy": "string (1-2 sentences: SPECIFIC approach based on tender requirements)",
    "successFactors": {
      "Financial": ["financial success factors - consolidate duplicates"],
      "Technical": ["technical success factors"],
      "Operational": ["operational success factors"],
      "Compliance": ["compliance-related success factors"],
      "Timeline": ["timeline-related success factors"],
      "emdExemption": ["array of EMD exemption details - who is exempt, conditions, documents required, reference clause if available"],
      "technicalEvaluationCriteria": ["array of technical evaluation criteria - evaluation parameters, scoring system, minimum qualifying score, mandatory compliance points"],
      "preQualificationCriteria": ["array of pre-qualification criteria - each PQ requirement as a bullet with exact numbers (years, turnover, certificates)"]
    },
    "keyPoints": {
      "Deadlines": ["deadline-related points - consolidate duplicates"],
      "Requirements": ["requirement-related points"],
      "Specifications": ["specification-related points"],
      "Financial": ["financial points - consolidate duplicates"],
      "Compliance": ["compliance-related points"]
    },
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
    "riskFactors": {
      "liquidatedDamages": ["array of LD conditions - percentage/amount, max cap, timeline triggers"],
      "siteSurvey": ["array of site survey requirements - what is required, whether mandatory, responsibilities, documents/report to be submitted"],
      "certifications": ["array of required certificates - list of certificates, issuing authority if mentioned, validity conditions, compliance standards"]
    },
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
    "criticalRequirements": {
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
    "actionItems": ["3-5 SPECIFIC technical actions with measurable targets"]
  },
  "commercial": {
    "estimatedValue": "string (with currency - search ALL alternative names listed above for Estimated Value)",
    "paymentTerms": "string (SPECIFIC percentages/milestones: e.g., 70-20-10)",
    "warranties": "string (SPECIFIC duration/terms with numbers)",
    "penalties": "string (SPECIFIC LD: %/day, max cap)",
    "pricingAppointment": [
      {
        "event": "string (name of pricing appointment event)",
        "date": "string (date in YYYY-MM-DD format or as mentioned in document)",
        "time": "string (time if mentioned)",
        "location": "string (location if mentioned, else empty string)",
        "notes": "string (any additional notes)"
      }
    ],
    "pricingBid": {
      "requirements": ["array of key requirements for pricing bid"],
      "submissionInstructions": ["array of submission instructions"],
      "evaluationCriteria": ["array of evaluation criteria (e.g., L1 criteria)"],
      "documentsNeeded": ["array of mandatory documents for pricing bid"],
      "paymentTerms": ["array of payment terms specific to pricing bid"],
      "taxesAndCharges": ["array of taxes and charges applicable"]
    },
    "keyTerms": {
      "Payment": ["payment-related terms"],
      "Warranty": ["warranty-related terms"],
      "Penalties": ["penalty and LD terms"],
      "Contract": ["contract-related terms"]
    },
    "riskAreas": {
      "Financial": ["financial/commercial risks"],
      "Payment": ["payment-related risks"],
      "Penalties": ["penalty-related risks"],
      "Contract": ["contract-related risks"]
    }
  },
  "finance": {
    "turnoverRequired": "string (CONSOLIDATE: If multiple turnover values mentioned, use the HIGHEST/MOST STRINGENT one and note the period clearly, e.g., 'Minimum ₹300 Crore in last 3 years (FY21-23)')",
    "netWorth": "string (SPECIFIC amounts/thresholds)",
    "bankGuarantee": "string (SPECIFIC amounts/percentages/duration)",
    "eligibilityStatus": "string",
    "financialRequirements": {
      "Turnover": ["turnover requirements - consolidate duplicates into single clear statement"],
      "Net Worth": ["net worth requirements"],
      "Bank Guarantee": ["bank guarantee requirements"],
      "Eligibility": ["eligibility criteria"]
    },
    "riskAreas": {
      "Financial": ["financial risks"],
      "Eligibility": ["eligibility-related risks"],
      "Cash Flow": ["cash flow risks"],
      "Guarantees": ["guarantee-related risks"]
    }
  },
  "legal": {
    "contractType": "string",
    "liabilityCap": "string (SPECIFIC amounts/percentages if mentioned)",
    "disputeResolution": "string",
    "requiredDocuments": ["CRITICAL: Extract ALL compliance documents mentioned in document. If NONE mentioned, infer based on project type: ISO 9001, ISO 14001, ISO 27001 (for IT projects), GST Certificate, PAN, Company Registration, MII Certificate, BIS Certification, RoHS Compliance, Fire Safety Certificate, Pollution Control Certificate, etc. Return 5-8 typical documents for this project type"],
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
    }
  },
  "scm": {
    "leadTime": "string (EXTRACT: Overall delivery timeline, installation period, commissioning time - SPECIFIC durations/deadlines)",
    "criticalItems": "integer (Count of time-critical or long lead-time items)",
    "miiRequirement": "string (EXTRACT: MII compliance %, local content requirements, Class-I/II supplier requirements - SPECIFIC %/thresholds)",
    "riskLevel": "string (High/Medium/Low based on delivery constraints, supplier availability, import dependencies)",
    "sourcingStrategy": "string (DETAILED: Primary sourcing approach - local vs import, preferred vendors, backup strategies, 3-5 sentences with SPECIFIC requirements/constraints)",
    "deliverySchedule": "string (EXTRACT: Phased delivery milestones, staggered shipments, installation timelines)",
    "warehousingNeeds": "string (Storage requirements, site logistics, handling specifications)",
    "qualityControl": "string (Inspection protocols, testing requirements, acceptance criteria)",
    "supplierRequirements": ["Array of supplier eligibility: certifications needed, experience, turnover, registration requirements"],
    "logisticsConstraints": ["Array of logistical challenges: site access, transportation modes, customs/import clearance"],
    "inventoryManagement": "string (Stock planning, buffer inventory, just-in-time delivery requirements)",
    "riskMitigation": ["Array of SCM risks and mitigation: supplier defaults, delays, quality issues, import restrictions"],
    "keyActions": ["5-8 DETAILED SCM actions: sourcing, vendor selection, logistics planning, quality checks, compliance verification with numeric targets/deadlines"]
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
      "SPECIAL HANDLING FOR SPECIFICATION TABLES:",
      "- If document has a 'Specifications' table with 'Model 1', 'Model 2', 'Model 3' as columns → Extract each Model as a separate product",
      "- For specification tables: Product name = 'Model 1', 'Model 2', 'Model 3', etc.",
      "- Extract ALL specifications for each model from the table",
      "- Combine all specification rows into the 'specifications' field for each model",
      {
        "productName": "string (exact product name from document - can be 'Model 1', 'Model 2', 'Model 3', etc. for specification tables)",
        "category": "string (product category/type - infer from specifications: Hardware, Security, Networking, etc.)",
        "specifications": "string (CRITICAL: For specification tables, extract ALL specifications from the table for this model. Combine all spec rows into one field. If in document → extract. If NOT in document → GENERATE detailed specs based on product type. NEVER use 'N/A' or leave empty. Examples: 'USB 3.1 Gen 2, 10Gbps transfer, gold-plated connectors, 6ft length, braided nylon, reversible design' OR 'REST API integration, 10K tickets/day capacity, ITIL compliant, SLA tracking, multi-tenant architecture, reporting dashboard' OR 'SAML 2.0/OIDC support, multi-factor authentication, role-based access control, 100+ device onboarding, audit logging'. ALWAYS provide 3-5 technical details per product)",
        "quantity": "string (quantity if mentioned, otherwise 'N/A')",
        "unit": "string (unit if mentioned, otherwise 'N/A')",
        "oem": "string (CRITICAL: If OEM in document → extract it. If NOT in document → PROVIDE UNIQUE, PRODUCT-SPECIFIC OEM. Match OEM to exact product type. Examples: USB cables → 'Anker' or 'Belkin' or 'Cable Matters', Bluetooth adapter → 'TP-Link' or 'ASUS', DVD writer → 'ASUS' or 'LG', SATA cables → 'StarTech' or 'Sabrent', Identity platform → 'Okta' or 'SailPoint', Firewall → 'Fortinet' or 'Palo Alto Networks'. NEVER reuse same OEM for multiple products. NEVER use generic 'Microsoft/IBM/Oracle' for cables/accessories. NEVER use 'Unspecified', 'N/A', 'TBD')",
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
- For SPECIFICATION TABLES: Extract each Model (Model 1, Model 2, Model 3) as a separate product
- Example: Specification table with Model 1, Model 2, Model 3 columns → Extract 3 products with all their specifications

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
 * Process large documents with chunking (OpenAI only)
 * @param {String} documentText - Document text to chunk
 * @param {String} fileName - File name
 */
const processLargeDocument = async (documentText, fileName) => {
    if (!openai) {
        throw new Error('OpenAI client not initialized. Please check your OPENAI_API_KEY.');
    }
    
    // Use OpenAI chunk size
    const chunkSize = CHUNK_SIZE_OPENAI;
    const chunks = [];

    for (let i = 0; i < documentText.length; i += chunkSize) {
        chunks.push(documentText.slice(i, i + chunkSize));
    }

    console.log(`📄 Processing large document with OpenAI in ${chunks.length} chunks (${chunkSize} chars each)...`);

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

CRITICAL: ORGANIZED SUMMARIES WITH SUBHEADINGS
- Organize successFactors, keyPoints, complianceRequirements, and riskAreas by logical categories
- Use subheadings like: "Financial", "Technical", "Operational", "Legal", "Timeline", "Quality", "Compliance", etc.
- Group related items together under appropriate subheadings
- Example structure: {"Financial": ["item1", "item2"], "Technical": ["item3", "item4"]}
- If an item doesn't fit a category, use "General" or "Other"
- MANDATORY: Use object structure with subheadings, NOT flat arrays

💰 PRICING APPOINTMENT & PRICING BID EXTRACTION:
For commercial.pricingAppointment: Extract ALL mentions of:
- pricing appointment, appointment of pricing committee, price bid appointment schedule
- scheduled pricing meeting, evaluation committee meeting date
- financial bid opening appointment, tender fee appointment time, price negotiation schedule
- Return event name, date, time, location (if available), and any notes

For commercial.pricingBid: Extract ALL mentions of:
- pricing bid, price bid, financial bid, commercial bid, BOQ submission, cost sheet
- financial evaluation, price schedule, L1 criteria, payment schedule, price format
- Return: requirements, format required, mandatory documents, submission instructions
- evaluation criteria, conditions for disqualification, payment terms, taxes & charges
- If not found, return empty arrays/strings - DO NOT guess or make up information

📋 BID MANAGEMENT EXTRACTION (CRITICAL):
For bidManagement.successFactors.emdExemption: Extract ALL mentions of:
- EMD exemption, MSME exemption, Startup India exemption, EMD waiver, EMD relaxation
- exemption categories, documents needed for exemption
- Return: who is exempt, conditions for exemption, documents required, reference clause (if available)
- Extract even if embedded in tables, footnotes, or annexures
- If not found, return empty array - DO NOT create fake data

For bidManagement.successFactors.technicalEvaluationCriteria: Extract ALL mentions of:
- technical evaluation methodology, scoring pattern, weightage, marks allocation
- qualification thresholds, technical bid evaluation rules
- functional/technical compliance criteria
- Return: evaluation parameters, scoring system, minimum qualifying score, mandatory compliance points
- Extract exact wording from document - do not rewrite or modify meaning
- If not found, return empty array - DO NOT guess

For bidManagement.successFactors.preQualificationCriteria: Extract ALL mentions of:
- eligibility criteria, PQ criteria, bidder must have, experience requirements
- turnover criteria, certifications required, manpower requirements, OEM requirements
- Return: each PQ requirement as a bullet point with numbers exactly as written (years, turnover, certificates)
- Extract exact wording - preserve all numbers and specifications
- If not found, return empty array - DO NOT infer requirements

⚠️ BID MANAGEMENT RISK FACTORS EXTRACTION (CRITICAL):
For bidManagement.riskFactors.liquidatedDamages: Extract ALL mentions of:
- liquidated damages, LD penalty, penalty for delay, delay penalty, performance penalty
- compensation for delay, SLA violation penalty, penalty clause, LD rate (% per week or per day)
- maximum LD cap
- Return: all LD conditions, percentage/amount mentioned, max cap (like "10% of contract value"), timeline triggers
- Extract exact wording from document - preserve all percentages, amounts, and conditions
- If not found, return empty array - DO NOT guess

For bidManagement.riskFactors.siteSurvey: Extract ALL mentions of:
- site survey, pre-bid site visit, mandatory site inspection, bidder must visit site
- physical verification before bidding, site assessment, location survey responsibility
- Return: what is required in site survey, whether it is mandatory, responsibilities of bidder
- documents/report to be submitted
- Extract even if embedded in tables, footnotes, or annexures
- If not found, return empty array - DO NOT create fake data

For bidManagement.riskFactors.certifications: Extract ALL mentions of:
- certifications required, technical certifications, OEM certifications, ISO certifications
- compliance certificates, supporting documents, mandatory certificates, local certifications
- Return: list of required certificates, issuing authority if mentioned, validity conditions
- compliance standards
- Extract exact certificate names and requirements - preserve all specifications
- If not found, return empty array - DO NOT infer certifications

🔥 CRITICAL FOR THIS CHUNK: Extract ALL products/items from BOQ/BOM found in this section.

⚠️ CONSISTENCY: projectOverview.lastSubmissionDate MUST match the date in bidManagement.keyDeadlines. Do NOT use N/A if date is found!`;

                const userPrompt = buildUserPrompt(chunks[i], `${fileName} (Part ${i + 1}/${chunks.length})`);
                
                // Use OpenAI for all chunks
                const result = await generateWithOpenAI(systemPrompt, userPrompt);
                
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
        model: OPENAI_MODEL,
        provider: 'openai'
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

