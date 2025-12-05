const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { getAllIndianOEMs, getAllGlobalOEMs } = require('../data/miiDatabase');

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configuration
// Using gemini-2.5-flash which supports larger context windows
const MODEL = 'gemini-2.5-flash'; // Free tier model
const TEMPERATURE = 0.3;
const MAX_TOKENS = 8192; // Gemini max output tokens (8192 is safe limit)

/**
 * Generate departmental summaries from RFP document
 * @param {String} documentText - Extracted document text
 * @param {String} fileName - Original file name
 * @returns {Promise<Object>} - Departmental summaries
 */
const generateDepartmentalSummaries = async (documentText, fileName) => {
    try {
        const systemPrompt = `You are an expert RFP/tender analyst. Extract critical bidding intelligence from tender documents.

FOCUS: Extract actionable information needed to WIN the bid.

OUTPUT RULES:
- Be thorough but concise
- Include ALL critical data points (amounts, dates, percentages)
- Keep descriptions focused and scannable
- Arrays: 3-5 most important items
- NO generic advice - only document-specific data
- CRITICAL: Extract EXACT financial values - NEVER calculate or add examples`;

        const userPrompt = `You are analyzing an RFP/tender document. Extract ALL values into the specified JSON schema below. If a field cannot be found confidently, return "N/A".

Document: ${fileName}

=== DOCUMENT CONTENT ===
${documentText}
=== END DOCUMENT ===

EXTRACTION RULES:
1. Extract ALL available information but keep descriptions CONCISE.
2. Preserve currency symbols and units exactly (₹, %, Cr, Lakhs, Crore).
3. Use tender wording for legal and commercial text but SUMMARIZE long clauses.
4. If multiple docs exist (BOQ + Corrigendum + RFP), use the latest corrigendum where contradictory.
5. Do not hallucinate values — only use what is written in tender.

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
6. Search for BOQ (Bill of Quantities) first; if not found, search for BOM (Bill of Materials) instead.
7. Extract product/material items from whichever source (BOQ or BOM) is available in the document.
8. INFER "category" based on the item type (e.g., Hardware, Software, Civil, Electrical, Furniture, HVAC, Security).

9. **CRITICAL: EXTRACT ONLY ACTUAL PRODUCTS FROM THE DOCUMENT**
   - **NO HALLUCINATIONS**: Only extract products that are explicitly mentioned in the document
   - **NO GENERIC ITEMS**: Do not add generic items like "Miscellaneous", "Others" unless explicitly listed
   - **NO N/A PRODUCTS**: NEVER create products with name "N/A" or empty names
   - **VERIFY EACH PRODUCT**: Each product must have a corresponding entry in the BOQ/BOM/product list
   - **ACCURACY OVER QUANTITY**: Better to extract fewer accurate products than many incorrect ones
   - **INVALID PRODUCT NAMES**: Do NOT extract products named: "N/A", "Not Applicable", "TBD", "To Be Decided", "Miscellaneous", "Others", "Various"
   - **REAL NAMES ONLY**: Each product must have a specific, identifiable name from the document

10. **CRITICAL: OEM (Original Equipment Manufacturer) EXTRACTION & INTELLIGENT SUGGESTION**
   - **STEP 1: AGGRESSIVELY SEARCH** for brand names in document:
     - The product description itself (e.g., "Supply of Dell Server")
     - A separate "Approved Makes", "Preferred Brands", or "List of Makes" section/annexure
     - Technical specifications columns
     - Look for "Make:", "Brand:", "Mfr:", "Model:", "or equivalent"
   - **STEP 2: IF OEM FOUND** → Extract it (if multiple brands listed like "Havells / Polycab / Anchor", extract the **FIRST ONE**)
   - **STEP 3: IF OEM NOT FOUND** → SUGGEST UNIQUE, PRODUCT-SPECIFIC OEM based on EXACT product type:
   
   **CRITICAL: MATCH OEM TO PRODUCT CATEGORY - DO NOT USE GENERIC OEMS**
   
   **Cables & Accessories:**
   - USB Cables → "Anker", "Belkin", "Cable Matters", "AmazonBasics", "Monoprice"
   - SATA Cables → "StarTech", "Cable Matters", "Monoprice", "Sabrent"
   - HDMI Cables → "Belkin", "AmazonBasics", "Cable Matters", "Monoprice"
   - Network Cables → "Monoprice", "Cable Matters", "Belkin", "StarTech"
   - Adapters → "Anker", "TP-Link", "ASUS", "Belkin", "StarTech"
   
   **Software/Platforms:**
   - Ticket Management → "ServiceNow", "Jira Service Management", "Freshservice", "Zendesk"
   - Identity Management → "Okta", "Microsoft Entra ID", "SailPoint", "ForgeRock", "Ping Identity"
   - SIEM → "Splunk Enterprise", "IBM QRadar", "LogRhythm", "ArcSight", "Elastic Security"
   - Forensics → "EnCase Forensic", "FTK (Forensic Toolkit)", "X-Ways Forensics", "Autopsy"
   - Cloud Security → "Palo Alto Prisma Cloud", "Wiz", "Orca Security", "Lacework"
   
   **Hardware:**
   - Servers → "Dell PowerEdge", "HP ProLiant", "Lenovo ThinkSystem", "Cisco UCS"
   - Firewalls → "Fortinet FortiGate", "Palo Alto PA-Series", "Cisco Firepower", "Check Point"
   - Network Switches → "Cisco Catalyst", "HPE Aruba", "Juniper EX Series", "Dell Networking"
   - Storage → "NetApp FAS", "Dell EMC PowerStore", "HPE Nimble", "Pure Storage"
   
   **Peripherals:**
   - DVD Writers → "ASUS", "LG", "Samsung", "Pioneer"
   - Hard Disk Docking → "StarTech", "Sabrent", "UGREEN", "Thermaltake"
   - WiFi Adapters → "TP-Link", "ASUS", "Netgear", "Intel"
   - Bluetooth Adapters → "TP-Link", "ASUS", "Intel", "Plugable"
   
   - **MANDATORY RULES**:
     * NEVER use "Microsoft / IBM / Oracle" for cables/accessories
     * NEVER assign same OEM to multiple products
     * Match OEM to product category EXACTLY
     * Each product gets a UNIQUE, relevant OEM
     * NEVER use: "Unspecified", "N/A", "TBD", "Generic"

11. **CRITICAL: MII (Make In India) STATUS DETERMINATION**
   - **Indian OEMs (Mark as "Indian OEM"):** ${getAllIndianOEMs().join(', ')}
   - **Global OEMs (Mark as "Global OEM"):** ${getAllGlobalOEMs().join(', ')}
   - **Explicit Mention:** If product mentions "Make in India", "MII compliant", "Class-I Local Supplier", or "60% local content", mark as "MII-Compliant".
   - **Inference:** If OEM is unspecified but product is clearly a local civil/construction material (e.g., "Bricks", "Sand", "Cement"), mark as "Likely Indian".
   - **Default:** If uncertain, use "Requires Review".

12. **CRITICAL: ESTIMATED VALUE / PROJECT COST EXTRACTION**
   - Search the ENTIRE document for ANY of these terms:
     * "Estimated Value" or "Estimated Cost"
     * "Project Cost Estimate" or "Project Value"
     * "Approximate Value" or "Budgetary Estimate"
     * "Cost Projection" or "Total Cost"
     * "Engineer's Estimate" or "EE"
     * "Pre-Tender Estimate" or "PTE"
     * "Probable Cost of Construction" or "PCC"
     * "BOQ Estimated Value" or "BOQ Total"
     * "Tender Value" or "Contract Value"
   - Extract the amount WITH currency symbol (e.g., "₹45.5 Lakhs", "₹2.5 Cr", "$50,000")
   - Check: Project Overview section, Commercial section, BOQ total, Cost breakdown
   - If found, use for BOTH projectOverview.bidValue AND commercial.estimatedValue

13. **CRITICAL: SUPPLY CHAIN MANAGEMENT (SCM) EXTRACTION**
   - **SEARCH ENTIRE DOCUMENT** for SCM-related information in sections like:
     * Delivery Schedule / Timeline
     * Installation & Commissioning clauses
     * Quality Control / Testing procedures
     * Supplier eligibility criteria
     * Logistics and Transportation requirements
     * Warehousing / Site storage needs
     * Import/Export requirements
     * Local content / MII requirements
     * Acceptance testing procedures
   - **BE DETAILED**: Extract 3-5 sentences for sourcing strategy
   - **EXTRACT ALL**: Delivery milestones, supplier requirements, logistics constraints, quality protocols
   - **FOCUS**: This is a CRITICAL section - extract as much detail as available in document

14. Extract thoroughly but efficiently. Focus on BIDDING INTELLIGENCE.
15. **EXTRACTION RULES:**
    - Include ALL critical data (amounts, dates, percentages)
    - Extract EXACT financial values from document - do NOT calculate or add examples
    - Arrays: 3-5 most important items (5-8 for SCM keyActions)
    - Descriptions: Keep concise but informative (1-2 sentences, 3-5 for SCM)
    - NO generic advice - extract document-specific data only
16. **FOCUS**: Products (ONLY those in document) > SCM Details > Bidding requirements > Success factors > Risks.

17. **CRITICAL: ORGANIZED SUMMARIES WITH SUBHEADINGS**
    - Organize successFactors, keyPoints, complianceRequirements, and riskAreas by logical categories
    - Use subheadings like: "Financial", "Technical", "Operational", "Legal", "Timeline", "Quality", "Compliance", etc.
    - Group related items together under appropriate subheadings
    - Example structure: {"Financial": ["item1", "item2"], "Technical": ["item3", "item4"]}
    - If an item doesn't fit a category, use "General" or "Other"

18. **CRITICAL: LEGAL COMPLIANCE DOCUMENTS**
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
    "bidValue": "string (SEARCH ENTIRE DOCUMENT for: Estimated Value, Estimated Cost, Project Cost Estimate, Approximate Value, Budgetary Estimate, Cost Projection, Engineer's Estimate, Pre-Tender Estimate, Probable Cost of Construction, BOQ Estimated Value, Tender Value, Contract Value. Extract EXACT amount with currency as written, e.g., ₹450 Cr)",
    "emd": "string (CRITICAL: Extract EXACT EMD amount from document ONLY IF PRESENT. If NOT mentioned in document, return 'N/A'. Do NOT calculate. Do NOT add percentage unless document shows both. If document says '₹15 Crore', write '₹15 Crore' NOT '₹5L (2%)')",
    "completionPeriod": "string (project duration in weeks/months)",
    "lastSubmissionDate": "string (bid submission deadline with time)"
  },
  "bidManagement": {
    "projectOverview": "string (2-3 sentences: scope, value, timeline)",
    "keyDeadlines": "string (critical dates with times)",
    "strategy": "string (1-2 sentences: key approach for winning)",
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
    "actionItems": ["3-5 immediate actions needed"]
  },
  "technical": {
    "totalItems": "integer (MUST MATCH productMapping.miiProductStatus.length - EXACT same count)",
    "keySpecifications": [
      {
        "productName": "string",
        "specification": "string (concise with numbers/standards)"
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
    "actionItems": ["3-5 technical actions"]
    
    NOTE: DO NOT include compliancePercent, gapsIdentified, or complianceRequirements fields
  },
  "commercial": {
    "estimatedValue": "string (SEARCH for ANY of these terms: Estimated Value, Estimated Cost, Project Cost Estimate, Approximate Value, Budgetary Estimate, Cost Projection, Engineer's Estimate (EE), Pre-Tender Estimate (PTE), Probable Cost of Construction (PCC), BOQ Estimated Value, Total Cost, Project Value, Tender Value, Contract Value. Extract the amount with currency)",
    "paymentTerms": "string (concise: e.g., 70-20-10)",
    "warranties": "string",
    "penalties": "string (LD details)",
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
    "netWorth": "string",
    "bankGuarantee": "string",
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
    "liabilityCap": "string",
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
    "leadTime": "string (EXTRACT: Overall delivery timeline, installation period, commissioning time)",
    "criticalItems": "integer (Count of time-critical or long lead-time items)",
    "miiRequirement": "string (EXTRACT: MII compliance %, local content requirements, Class-I/II supplier requirements)",
    "riskLevel": "string (High/Medium/Low based on delivery constraints, supplier availability, import dependencies)",
    "sourcingStrategy": "string (DETAILED: Primary sourcing approach - local vs import, preferred vendors, backup strategies, 3-5 sentences)",
    "deliverySchedule": "string (EXTRACT: Phased delivery milestones, staggered shipments, installation timelines)",
    "warehousingNeeds": "string (Storage requirements, site logistics, handling specifications)",
    "qualityControl": "string (Inspection protocols, testing requirements, acceptance criteria)",
    "supplierRequirements": ["Array of supplier eligibility: certifications needed, experience, turnover, registration requirements"],
    "logisticsConstraints": ["Array of logistical challenges: site access, transportation modes, customs/import clearance"],
    "inventoryManagement": "string (Stock planning, buffer inventory, just-in-time delivery requirements)",
    "riskMitigation": ["Array of SCM risks and mitigation: supplier defaults, delays, quality issues, import restrictions"],
    "keyActions": ["5-8 DETAILED SCM actions: sourcing, vendor selection, logistics planning, quality checks, compliance verification"]
  },
  "productMapping": {
    "sourceType": "string (BOQ or BOM - indicate which source was used for product mapping)",
    "totalItems": "integer (MUST equal miiProductStatus.length - count of products in array)",
    "totalOEMs": {
      "count": "integer or string (total distinct OEM brands detected)",
      "indian": "integer or string (number of Indian OEMs)",
      "global": "integer or string (number of foreign/global OEMs)"
    },
    "productsMapped": "integer or string (number of products successfully mapped to OEM brands)",
    "makeInIndiaMapping": {
      "status": "string (Compliant, Non-Compliant, Partial, N/A - overall MII compliance score)",
      "mapped": "integer or string (BOQ/BOM items mapped to MII-compliant OEMs)",
      "unmapped": "integer or string (BOQ/BOM items NOT satisfying MII compliance or without valid OEM mapping)"
    },
    "miiProductStatus": [
      {
        "productName": "string (BOQ/BOM item name exactly as written in tender - MUST be a real product name, NEVER 'N/A' or 'Not Applicable' or 'Miscellaneous')",
        "category": "string (e.g., Hardware, Software, Civil, Electrical, Furniture, HVAC, Security, Networking - NEVER 'N/A')",
        "specifications": "string (CRITICAL: Provide DETAILED, COMPREHENSIVE specifications (150-200 characters). If in document → extract. If NOT in document → GENERATE detailed specs based on product type. NEVER use 'N/A' or leave empty. Examples: 'USB 3.1 Gen 2, 10Gbps transfer, gold-plated connectors, 6ft length, braided nylon, reversible design' OR 'REST API integration, 10K tickets/day capacity, ITIL compliant, SLA tracking, multi-tenant architecture, reporting dashboard' OR 'SAML 2.0/OIDC support, multi-factor authentication, role-based access control, 100+ device onboarding, audit logging'. ALWAYS provide 3-5 technical details per product)",
        "quantity": "string (quantity if mentioned, e.g., '1', '10', 'Lumpsum')",
        "unit": "string (unit if mentioned, e.g., 'Nos', 'Set', 'LS')",
        "oem": "string (CRITICAL: If OEM in document → extract it. If NOT in document → PROVIDE UNIQUE, PRODUCT-SPECIFIC OEM. Match OEM to exact product type. Examples: USB cables → 'Anker' or 'Belkin' or 'Cable Matters', Bluetooth adapter → 'TP-Link' or 'ASUS', DVD writer → 'ASUS' or 'LG', SATA cables → 'StarTech' or 'Sabrent', Identity platform → 'Okta' or 'SailPoint', Firewall → 'Fortinet' or 'Palo Alto Networks'. NEVER reuse same OEM for multiple products. NEVER use generic 'Microsoft/IBM/Oracle' for cables/accessories. NEVER use 'Unspecified', 'N/A', 'TBD')",
        "miiStatus": "string (Classification: 'Indian OEM', 'Global OEM', 'MII-Compliant', 'Likely Indian', 'Requires Review')"
      }
    ]
  }
}

CRITICAL INSTRUCTIONS FOR PRODUCT MAPPING:
- Extract products/items from the BOQ or BOM section.
- **LIMIT**: Extract up to 40 most important/representative products per chunk to balance completeness with output limits.
- For each product, search the document chunk for Brand names.
- Populate the miiProductStatus array with the products found (max 40 per chunk).

**CRITICAL CONSISTENCY RULE:**
- productMapping.totalItems MUST EQUAL the length of miiProductStatus array
- technical.totalItems MUST EQUAL productMapping.totalItems
- Example: If miiProductStatus has 3 products, then totalItems MUST be 3 in BOTH sections
- DO NOT count extra items that aren't in the miiProductStatus array

**CRITICAL OEM DIVERSITY RULE:**
- DO NOT assign the same OEM to every product unless they're actually all from that OEM in the document
- Extract ACTUAL OEM from document for each product individually
- If OEM not found for a product, mark as "Unspecified" (backend will provide variety)
- NEVER default all products to the same company
- Example: If 20 products, and only 5 have OEMs in document, extract those 5 and mark rest as "Unspecified"
- Be specific with OEM names.
- Classify MII status based on the lists provided above.
- Prioritization (extract in this order):
  1. ALL items with explicit OEM/brand mentions (MUST include)
  2. High-value items (>₹1L per unit)
  3. Unique/critical technical items
  4. Representative samples of commodity items (e.g., 1-2 cable types, not all 50 variants)
- For repetitive items (e.g., 50 types of cables), include 2-3 representative samples only.

CRITICAL INSTRUCTIONS FOR KEY SPECIFICATIONS:
- For the technical.keySpecifications field, provide DETAILED, INTELLIGENT specifications for the most IMPORTANT products from BOQ/BOM.
- Each specification should be an object with "productName" and "specification" fields.
- **INTELLIGENT GENERATION**: 
  * If specifications ARE in document → Extract them
  * If specifications NOT in document → GENERATE detailed industry-standard specifications based on product name/type
  * NEVER write "No specifications mentioned in document", "N/A", or leave empty - ALWAYS provide meaningful specs
- **BE DETAILED**: Provide 3-5 technical details per product (150-200 characters)
- Include: capacity/size, performance metrics, key features, connectivity, standards, compatibility
- **EXAMPLES (Extract from doc OR Generate if not found)**:
  * {"productName": "USB Type-C Cable", "specification": "USB 3.1 Gen 2, 10Gbps data transfer, 100W power delivery, gold-plated connectors, 6ft braided nylon cable, reversible design"}
  * {"productName": "Bluetooth 5.0 Adapter", "specification": "Bluetooth 5.0, 20m range, Windows/Linux/macOS compatible, low latency, dual-mode support, plug-and-play USB dongle"}
  * {"productName": "SATA Cables", "specification": "SATA III 6Gbps, 18-inch length, right-angle connectors, latching mechanism, supports SSD/HDD, 7-pin data interface"}
  * {"productName": "Ticket Management Platform", "specification": "REST API integration, 4000 users capacity, scalable to 500, ITIL compliant, SLA tracking, multi-tenant, automated workflows, reporting dashboard"}
  * {"productName": "Identity Management (PIM/PAM)", "specification": "SAML 2.0/OIDC, multi-factor authentication, role-based access control, 100+ device onboarding, session recording, audit logging, privileged access"}
  * {"productName": "Forensic Disk Imager", "specification": "Hardware write blocker, live disk imaging, hash verification (MD5/SHA256), supports multiple interfaces, forensic-grade acquisition"}
  * {"productName": "NGFW Appliance", "specification": "20 physical cores, 64GB RAM, minimum throughput 2Gbps, IPS/IDS, SSL inspection, application control, HA/DR support"}
- **EXTRACT OR GENERATE 10-15 DETAILED product specifications** with 3-5 technical details each.


EXAMPLES OF GOOD EXTRACTION:
Product: "MCB 32A Havells or equivalent" → OEM: "Havells", MII Status: "Indian OEM"
Product: "Siemens PLC System" → OEM: "Siemens", MII Status: "Global OEM"
Product: "HVAC System - Voltas/Blue Star" → OEM: "Voltas", MII Status: "Indian OEM"
Product: "Electrical Wiring" (no brand) → OEM: "Unspecified", MII Status: "Likely Indian"
}

IMPORTANT: 
- Return ONLY the JSON object
- Be CONCISE but DATA-COMPLETE
- **NEVER skip**: numbers, dates, deadlines, amounts, percentages, specific requirements
- **DO skip**: generic advice like "ensure quality", "follow guidelines" (without data)
- Include ALL critical data points even if standard (EMD %, turnover, warranty, penalties, etc.)
- Remove ONLY obvious statements without data
- Every numeric value, date, and deadline is CRITICAL - extract them ALL`;

        // Check token count and chunk if necessary
        const estimatedTokens = estimateTokens(documentText);

        console.log(`Estimated tokens: ${estimatedTokens}`);

        if (estimatedTokens > 25000) {
            // Document is too large, need to chunk to avoid output token limits
            console.log('⚡ Document too large, using PARALLEL chunking strategy...');
            return await processLargeDocument(documentText, fileName);
        }

        // Get the generative model
        const model = genAI.getGenerativeModel({ 
            model: MODEL,
            generationConfig: {
                temperature: TEMPERATURE,
                maxOutputTokens: MAX_TOKENS,
                responseMimeType: "application/json"
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });

        // Combine system and user prompts for Gemini
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

        // Make API call to Gemini
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        // Check if response was truncated due to MAX_TOKENS
        if (response.candidates && response.candidates[0]) {
            const finishReason = response.candidates[0].finishReason;
            if (finishReason === 'MAX_TOKENS') {
                console.warn('⚠️  Response truncated due to MAX_TOKENS. Attempting to repair JSON...');
                // Don't throw error - let the repair logic handle it
            }
        }
        
        let responseText = response.text();
        
        // Log the raw response for debugging
        console.log('Raw response length:', responseText.length);
        console.log('First 200 chars:', responseText.substring(0, 200));
        
        // Clean up the response - remove markdown code blocks if present
        responseText = responseText.trim();
        
        // Remove markdown JSON code blocks (```json ... ```)
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        } else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        responseText = responseText.trim();
        
        // Validate we have content
        if (!responseText) {
            throw new Error('Gemini returned an empty response');
        }
        
        // Parse JSON with better error handling
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
                console.error('JSON Repair Failed:', repairError.message);
                console.error('Response text (first 500 chars):', responseText.substring(0, 500));
                console.error('Response text (last 500 chars):', responseText.substring(Math.max(0, responseText.length - 500)));
                throw new Error(`Failed to parse Gemini response as JSON: ${parseError.message}. Response length: ${responseText.length}`);
            }
        }

        return {
            summaries,
            usage: {
                promptTokens: estimatedTokens,
                completionTokens: estimateTokens(responseText),
                totalTokens: estimatedTokens + estimateTokens(responseText)
            },
            model: MODEL
        };

    } catch (error) {
        console.error('Gemini API Error:', error);
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
    // ✅ Larger chunks = fewer API calls = faster processing
    // Gemini 2.5 Flash supports 1M token context window, so we can use larger chunks
    const chunkSize = 120000; // Increased to 120k characters (~30k tokens) for faster processing
    const chunks = [];

    for (let i = 0; i < documentText.length; i += chunkSize) {
        chunks.push(documentText.slice(i, i + chunkSize));
    }

    console.log(`⚡ Processing large document in ${chunks.length} chunks (PARALLEL MODE)...`);

    // ✅ PARALLEL CHUNK PROCESSING - Process 2 chunks at once
    const chunkResults = [];
    const batchSize = 2; // Process 2 chunks in parallel
    const maxRetries = 2;
    
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        console.log(`⚡ Processing chunks ${i + 1}-${Math.min(i + batchSize, chunks.length)}/${chunks.length}...`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (chunk, batchIndex) => {
            const chunkIndex = i + batchIndex;
            let retryCount = 0;
            
            while (retryCount <= maxRetries) {
                try {
                    const result = await generateDepartmentalSummaries(chunk, `${fileName} (Part ${chunkIndex + 1})`);
                    return result.summaries;
                } catch (chunkError) {
                    retryCount++;
                    console.error(`Error processing chunk ${chunkIndex + 1} (attempt ${retryCount}/${maxRetries + 1}):`, chunkError.message);
                    
                    if (retryCount > maxRetries) {
                        console.error(`Failed to process chunk ${chunkIndex + 1}. Using minimal structure...`);
                        return {
                            projectOverview: {},
                            bidManagement: {},
                            technical: {},
                            commercial: {},
                            finance: {},
                            legal: {},
                            scm: {},
                            productMapping: { miiProductStatus: [] }
                        };
                    } else {
                        // Wait before retry (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                }
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        chunkResults.push(...batchResults);
        
        // Small delay between batches to avoid rate limits
        if (i + batchSize < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Get the generative model for consolidation
    const model = genAI.getGenerativeModel({ 
        model: MODEL,
        generationConfig: {
            temperature: TEMPERATURE,
            maxOutputTokens: MAX_TOKENS,
            responseMimeType: "application/json"
        },
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
    });

    // Merge results with a consolidation pass
    const consolidationPrompt = `You are an expert at consolidating document summaries into ULTRA-CONCISE outputs.

Consolidate the following departmental summaries from multiple chunks of the same RFP document.

${JSON.stringify(chunkResults, null, 2)}

**CRITICAL:**
- Merge and synthesize information intelligently
- Extract EXACT financial values - do NOT calculate or make up numbers
- Arrays: 3-5 most important items
- Keep descriptions concise but complete
- Include ALL essential bidding intelligence

Return ONLY a valid JSON object with this EXACT structure:

{
  "projectOverview": {
    "projectName": "string",
    "client": "string",
    "tenderId": "string",
    "bidValue": "string",
    "emd": "string",
    "completionPeriod": "string",
    "lastSubmissionDate": "string"
  },
  "bidManagement": {
    "projectOverview": "string",
    "keyDeadlines": "string",
    "strategy": "string",
    "successFactors": ["array"],
    "keyPoints": ["array"],
    "complianceRequirements": ["array"],
    "riskAreas": ["array"],
    "actionItems": ["array"]
  },
  "technical": {
    "totalItems": "integer or string",
    "compliancePercent": "string",
    "keySpecifications": [{"productName": "string", "specification": "string"}],
    "criticalRequirements": ["array"],
    "riskAreas": ["array"],
    "actionItems": ["array"]
  },
  "commercial": {
    "estimatedValue": "string",
    "paymentTerms": "string",
    "warranties": "string",
    "penalties": "string",
    "keyTerms": ["array"],
    "riskAreas": ["array"]
  },
  "finance": {
    "turnoverRequired": "string",
    "netWorth": "string",
    "bankGuarantee": "string",
    "eligibilityStatus": "string",
    "financialRequirements": ["array"],
    "riskAreas": ["array"]
  },
  "legal": {
    "contractType": "string",
    "liabilityCap": "string",
    "disputeResolution": "string",
    "requiredDocuments": ["array"],
    "complianceRequirements": ["array"],
    "riskAreas": ["array"]
  },
  "scm": {
    "leadTime": "string",
    "criticalItems": "integer or string",
    "miiRequirement": "string",
    "riskLevel": "string",
    "sourcingStrategy": "string",
    "deliverySchedule": "string",
    "warehousingNeeds": "string",
    "qualityControl": "string",
    "supplierRequirements": ["array"],
    "logisticsConstraints": ["array"],
    "inventoryManagement": "string",
    "riskMitigation": ["array"],
    "keyActions": ["array"]
  },
  "productMapping": {
    "sourceType": "string",
    "totalItems": "integer or string",
    "totalOEMs": {
      "count": "integer or string",
      "indian": "integer or string",
      "global": "integer or string"
    },
    "productsMapped": "integer or string",
    "makeInIndiaMapping": {
      "status": "string",
      "mapped": "integer or string",
      "unmapped": "integer or string"
    },
    "miiProductStatus": [
      {
        "productName": "string",
        "category": "string",
        "specifications": "string",
        "quantity": "string",
        "unit": "string",
        "oem": "string",
        "miiStatus": "string"
      }
    ]
  }
}

IMPORTANT: 
- Return ONLY JSON
- Be thorough but concise
- Extract EXACT financial data from document - do NOT calculate or add examples
- Merge products (max 150), dedupe by productName
- Arrays: 3-5 most important items
- Include strategy, success factors, risks, actions
- Focus on actionable bidding intelligence`;

    let finalSummaries;
    try {
        const consolidation = await model.generateContent(consolidationPrompt);
        const consolidationResponse = await consolidation.response;
        
        // Check finish reason first
        if (consolidationResponse.candidates && consolidationResponse.candidates[0]) {
            const finishReason = consolidationResponse.candidates[0].finishReason;
            console.log('Consolidation finish reason:', finishReason);
            
            if (finishReason === 'MAX_TOKENS') {
                console.warn('Consolidation exceeded MAX_TOKENS. Using naive merge instead.');
                throw new Error('Consolidation response exceeded maximum token limit');
            }
        }
        
        let consolidationText = consolidationResponse.text();
        
        // Check for empty response
        if (!consolidationText) {
            console.warn('Consolidation returned empty response. Checking finish reason...');
            if (consolidationResponse.candidates && consolidationResponse.candidates.length > 0) {
                console.warn('Finish Reason:', consolidationResponse.candidates[0].finishReason);
                console.warn('Safety Ratings:', JSON.stringify(consolidationResponse.candidates[0].safetyRatings));
            }
            throw new Error('Empty response from consolidation step');
        }

        // Clean up consolidation response
        console.log('Consolidation response length:', consolidationText.length);
        consolidationText = consolidationText.trim();
        
        // Remove markdown code blocks
        if (consolidationText.startsWith('```json')) {
            consolidationText = consolidationText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        } else if (consolidationText.startsWith('```')) {
            consolidationText = consolidationText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        consolidationText = consolidationText.trim();
        
        try {
            finalSummaries = JSON.parse(consolidationText);
        } catch (parseError) {
            console.warn('Consolidation JSON Parse Error, attempting repair:', parseError.message);
            try {
                const repairedText = repairTruncatedJSON(consolidationText);
                finalSummaries = JSON.parse(repairedText);
                console.log('✓ Consolidation JSON repaired successfully');
            } catch (repairError) {
                console.error('Consolidation JSON Repair Failed:', repairError.message);
                throw new Error(`Failed to parse consolidation response: ${parseError.message}`);
            }
        }
    } catch (consolidationError) {
        console.error('Consolidation failed:', consolidationError.message);
        console.log('Falling back to naive merge strategy...');
        finalSummaries = naiveMergeSummaries(chunkResults);
    }

    return {
        summaries: finalSummaries,
        chunked: true,
        chunkCount: chunks.length,
        model: MODEL
    };
};

/**
 * Attempts to repair a truncated JSON string
 * @param {String} jsonString - The truncated JSON string
 * @returns {String} - Repaired JSON string
 */
const repairTruncatedJSON = (jsonString) => {
    let repaired = jsonString.trim();

    // Remove any trailing incomplete content
    // Look for the last complete JSON value before truncation
    
    // 1. Track structure and string state
    const stack = [];
    let inString = false;
    let lastValidPos = -1;
    let escaped = false;
    
    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        const prevChar = i > 0 ? repaired[i-1] : '';
        
        // Handle escape sequences
        if (escaped) {
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            escaped = true;
            continue;
        }
        
        // Handle string boundaries
        if (char === '"') {
            inString = !inString;
            if (!inString) {
                // Just closed a string
                lastValidPos = i;
            }
            continue;
        }
        
        if (inString) continue;
        
        // Track structure
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
            // Valid structural characters
            if (stack.length > 0) {
                lastValidPos = i;
            }
        }
    }
    
    // If we're inside a string, truncate to last valid position and close the string
    if (inString && lastValidPos >= 0) {
        repaired = repaired.substring(0, lastValidPos + 1);
        repaired += '"';
        inString = false;
    }
    
    // Remove trailing comma if present (common JSON error)
    repaired = repaired.replace(/,(\s*[}\]])/, '$1');
    
    // 2. Rebuild the stack to close remaining structures
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
    
    // Close any remaining open strings
    if (inString) {
        repaired += '"';
    }
    
    // Close remaining openers in reverse order
    while (stack.length > 0) {
        const opener = stack.pop();
        if (opener === '{') repaired += '}';
        if (opener === '[') repaired += ']';
    }
    
    return repaired;
};

/**
 * Naively merges multiple summary objects when AI consolidation fails
 * @param {Array} results - Array of summary objects
 * @returns {Object} - Merged summary object
 */
const naiveMergeSummaries = (results) => {
    if (!results || results.length === 0) return {};
    
    // Deep clone the first result as base
    const merged = JSON.parse(JSON.stringify(results[0]));
    
    for (let i = 1; i < results.length; i++) {
        const current = results[i];
        
        // Helper to merge objects recursively
        const mergeObjects = (target, source, path = '') => {
            for (const key in source) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (Array.isArray(source[key])) {
                    // Ensure target[key] is also an array
                    if (!Array.isArray(target[key])) {
                        target[key] = [];
                    }
                    
                    // Special handling for productMapping.miiProductStatus
                    if (currentPath === 'productMapping.miiProductStatus') {
                        // Deduplicate by productName, keeping the most detailed entry
                        const productMap = new Map();
                        
                        // Add existing products
                        target[key].forEach(product => {
                            if (product.productName) {
                                productMap.set(product.productName, product);
                            }
                        });
                        
                        // Add/update with source products
                        source[key].forEach(product => {
                            if (product.productName) {
                                const existing = productMap.get(product.productName);
                                // Prefer entries with specific OEM over "Unspecified"
                                if (!existing || (product.oem && product.oem !== 'Unspecified' && existing.oem === 'Unspecified')) {
                                    productMap.set(product.productName, product);
                                }
                            }
                        });
                        
                        // Limit to 150 products (prioritize those with known OEMs)
                        const allProducts = Array.from(productMap.values());
                        const withOEM = allProducts.filter(p => p.oem && p.oem !== 'Unspecified');
                        const withoutOEM = allProducts.filter(p => !p.oem || p.oem === 'Unspecified');
                        
                        // Include ALL products with OEMs, then fill remaining space with samples
                        target[key] = [...withOEM, ...withoutOEM].slice(0, 150);
                    } else {
                        // Generic array merge with deduplication
                        const existing = new Set(target[key].map(item => JSON.stringify(item)));
                        source[key].forEach(item => {
                            if (!existing.has(JSON.stringify(item))) {
                                target[key].push(item);
                            }
                        });
                    }
                } else if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    // Handle nested objects
                    if (typeof target[key] !== 'object' || target[key] === null || Array.isArray(target[key])) {
                        target[key] = {};
                    }
                    mergeObjects(target[key], source[key], currentPath);
                } else if (source[key] && source[key] !== 'N/A' && (!target[key] || target[key] === 'N/A')) {
                    // Overwrite if target is empty/N/A and source has value
                    target[key] = source[key];
                }
            }
        };
        
        mergeObjects(merged, current);
    }
    
    return merged;
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
