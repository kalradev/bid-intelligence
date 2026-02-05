import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
from openai import OpenAI
import os
import copy

from core.config import settings
from data.mii_database import get_all_indian_oems, get_all_global_oems

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = None
if settings.OPENAI_API_KEY:
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        logger.info("✅ OpenAI client initialized")
    except Exception as e:
        logger.error(f"❌ OpenAI initialization failed: {str(e)}")
else:
    logger.error("❌ OPENAI_API_KEY not found in settings")

# Configuration
OPENAI_MODEL = "gpt-4o-mini"
TEMPERATURE = 0.3
MAX_TOKENS_OPENAI = 16384

# Chunking configuration
CHUNK_SIZE_OPENAI = 150000
MAX_CONTEXT_OPENAI = 100000

def estimate_tokens(text: str) -> int:
    return len(text) // 4

async def generate_departmental_summaries(document_text: str, file_name: str) -> Dict[str, Any]:
    logger.info(f"🔍 Starting analysis for: {file_name}")
    logger.info(f"   Document length: {len(document_text)} characters")
    if not client:
        raise Exception("OpenAI client not initialized. Please check your OPENAI_API_KEY.")
    
    system_prompt = get_system_prompt()
    user_prompt = build_user_prompt(document_text, file_name)
    
    estimated_tokens = estimate_tokens(document_text)
    document_too_large = estimated_tokens > 25000
    
    try:
        if document_too_large:
            logger.info(f"⚡ Large document ({estimated_tokens} tokens), using OpenAI chunking strategy...")
            result = await process_large_document(document_text, file_name)
        else:
            logger.info(f"🤖 Generating summaries with OpenAI ({OPENAI_MODEL})...")
            result = await generate_with_openai_async(system_prompt, user_prompt)
            logger.info("✅ OpenAI generation successful")
        
        # Check if AI extracted any products, if not try fallback
        summaries = result.get("summaries", {})
        product_count = len(summaries.get("productMapping", {}).get("miiProductStatus", []))
        
        if product_count == 0:
            logger.info("🔄 AI extracted 0 products - trying fallback BOQ extraction...")
            from services.fallback_boq_extractor import enhance_analysis_with_fallback_products
            summaries = enhance_analysis_with_fallback_products(summaries, document_text)
            result["summaries"] = summaries
            product_count = len(summaries.get("productMapping", {}).get("miiProductStatus", []))
        
        # Enrich products with AI-generated OEM recommendations
        if product_count > 0:
            try:
                logger.info(f"🎯 Enriching {product_count} products with AI OEM recommendations...")
                from services.oem_recommendation_service import enrich_products_with_recommendations, get_recommendation_stats
                
                products = summaries.get("productMapping", {}).get("miiProductStatus", [])
                enriched_products = await enrich_products_with_recommendations(products)
                
                # Update summaries with enriched products
                if "productMapping" not in summaries:
                    summaries["productMapping"] = {}
                summaries["productMapping"]["miiProductStatus"] = enriched_products
                result["summaries"] = summaries
                
                # Log recommendation statistics
                stats = get_recommendation_stats(enriched_products)
                logger.info(f"✅ OEM Enrichment Complete:")
                logger.info(f"   - Products enriched: {stats['productsWithRecommendations']}/{stats['totalProducts']}")
                logger.info(f"   - Total recommendations: {stats['totalRecommendations']}")
                logger.info(f"   - Enrichment rate: {stats['enrichmentRate']}%")
            except Exception as e:
                logger.error(f"⚠️ OEM enrichment failed, proceeding without recommendations: {str(e)}")
                logger.info(f"📦 Returning {product_count} products without OEM enrichment")
                # Don't update result - keep original products without enrichment
        
        return result
    except Exception as e:
        logger.error(f"❌ OpenAI generation failed: {str(e)}")
        raise Exception(f"AI generation failed: {str(e)}")

async def generate_with_openai_async(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    # Since openai-python doesn't have a simple async call for sync client, 
    # and we want to avoid complex async setups for now, we'll use run_in_executor if needed,
    # but for simplicity, we'll just run it. FastAPI handles sync routes in threads.
    
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=TEMPERATURE,
        max_tokens=MAX_TOKENS_OPENAI,
        response_format={"type": "json_object"}
    )
    
    response_text = response.choices[0].message.content
    summaries = json.loads(response_text)
    
    # Debug: Log product mapping extraction
    if summaries.get("productMapping"):
        pm = summaries["productMapping"]
        product_count = len(pm.get("miiProductStatus", []))
        logger.info(f"📦 AI extracted {product_count} products in productMapping.miiProductStatus")
        if product_count > 0:
            logger.info(f"   First product: {pm['miiProductStatus'][0].get('productName', 'N/A')} - OEM: {pm['miiProductStatus'][0].get('oem', 'N/A')}")
        else:
            logger.warning("⚠️ AI returned productMapping but miiProductStatus array is empty!")
    else:
        logger.warning("⚠️ AI response does NOT contain productMapping section!")
        logger.warning(f"   Available sections: {list(summaries.keys())}")
    
    return {
        "summaries": summaries,
        "usage": {
            "promptTokens": response.usage.prompt_tokens,
            "completionTokens": response.usage.completion_tokens,
            "totalTokens": response.usage.total_tokens
        },
        "model": OPENAI_MODEL,
        "provider": "openai"
    }

def get_system_prompt() -> str:
    return """You are an expert RFP/tender analyst. Extract critical bidding intelligence from tender documents.

🚨 CRITICAL PRIORITY: PRODUCT EXTRACTION IS MANDATORY
- You MUST extract ALL products from BOQ/BOM/product lists if they exist in the document
- This is the HIGHEST PRIORITY extraction task
- Extract productName, category, oem, model, specifications, quantity, unit for EVERY product found
- ⚠️ CRITICAL: ALL products MUST go into productMapping.miiProductStatus array
- ⚠️ DO NOT put products in technical.keySpecifications - that's for technical specs only, NOT product lists
- If NO products found after thorough search, return empty array [] for productMapping.miiProductStatus

FOCUS: Extract UNIQUE, SPECIFIC information needed to WIN the bid.

OUTPUT RULES:
- PRIORITIZE data with NUMBERS (amounts, percentages, dates, quantities, thresholds)
- EXCLUDE only truly generic requirements (e.g., "bid in INR", "submit original documents", "EMD refundable")
- Include ALL relevant requirements, deadlines, specifications, and critical information
- Arrays: Extract 5-10 items per category to ensure comprehensive coverage
- ⚠️ EXCEPTION: For eligibility criteria (preQualificationCriteria), extract ALL items from tables - no limit, extract every row
- Include both differentiating factors AND standard requirements that are explicitly mentioned
- NO generic advice - only document-specific, actionable intelligence

🚨 CRITICAL: Extract maximum information from the document!
- If Bid Value not explicitly found, check for Estimated Value, Project Value, or Contract Value and use that
- ⚠️ If NONE of these are found, return "N/A" - DO NOT calculate or assume
- ⚠️ DO NOT use formulas to calculate missing values (e.g., don't calculate Bid Value from EMD percentage)
- ⚠️ DO NOT infer values from context - only extract explicitly stated amounts
- Only use "N/A" if absolutely no related information exists in the document
- For dates, deadlines, amounts: Extract even if partially mentioned (e.g., "by end of month" → infer approximate date)
- For specifications: Extract all technical details, standards, and requirements mentioned

CRITICAL: ORGANIZED SUMMARIES WITH SUBHEADINGS
- Organize successFactors, keyPoints, complianceRequirements, and riskAreas by logical categories
- Use subheadings like: "Financial", "Technical", "Operational", "Legal", "Timeline", "Quality", "Compliance", etc.
- Group related items together under appropriate subheadings
- Example structure: {"Financial": ["item1", "item2"], "Technical": ["item3", "item4"]}
- MANDATORY: Use object structure with subheadings, NOT flat arrays
- CRITICAL: If the document contains multiple parts or corrigendums, always prioritize information from the LATEST corrigendum or amendment.
- RESOLVE CONFLICTS: If conflicting values appear for the same requirement, use the MOST SPECIFIC or MOST RECENT value found in the document.
- DEDUPLICATION: Consolidate similar requirements into a single clear statement. Avoid repetition.
- ⚠️ EXCEPTION FOR ELIGIBILITY CRITERIA: DO NOT deduplicate eligibility criteria from tables - extract EVERY row as a separate item, even if they seem similar. Each row in an eligibility criteria table is a distinct requirement that must be listed separately.

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

📋 BID MANAGEMENT EXTRACTION (CRITICAL - COMPREHENSIVE EXTRACTION REQUIRED):

For bidManagement.projectOverview: Extract a comprehensive 3-4 sentence description covering:
- Complete project scope, objectives, and key deliverables
- Estimated value or contract size if mentioned
- Timeline or completion period with milestones
- Key stakeholders, departments, or beneficiary organizations involved
- Project location and implementation areas
→ Example: "Supply, installation and commissioning of 500 desktop computers with peripherals for XYZ Department across 25 district offices in State. Project includes comprehensive 3-year onsite warranty, training for 100 staff members, and data migration from existing systems. Estimated value: ₹5 crores. Implementation timeline: 90 days from LOI."

For bidManagement.keyDeadlines: Extract ALL critical dates with complete details:
- Bid submission deadline (exact date, time, and location)
- Technical bid opening (date, time, venue)
- Financial bid opening (date, time, venue)
- Pre-bid meeting (date, time, venue, registration process)
- Site visit dates (dates, contact person, mandatory/optional)
- Clarification deadline (last date for queries)
- Document download deadline
- Any other milestone dates mentioned
→ Format: Provide dates in clear format with full context

For bidManagement.strategy: Provide 3-4 sentence strategic recommendation covering:
- Key winning factors based on evaluation criteria and weightage
- Competitive positioning advice (pricing, technical, compliance)
- Risk mitigation approach for identified risks
- Resource allocation priorities and timeline management
- Compliance and documentation strategy
→ Be specific based on actual tender requirements, not generic advice

For bidManagement.successFactors: Extract 12-20 items per category:
- Financial: EMD amount & exemptions, payment milestones, advance %, retention %, bank guarantees, turnover requirements, financial eligibility, MSME benefits
- Technical: Evaluation criteria, scoring methodology, minimum qualifying marks, technical weightage, product specifications, OEM requirements, testing requirements, certifications
- Operational: Delivery schedule, installation timeline, commissioning period, training requirements, support services, AMC terms, manpower deployment, project management
- Compliance: Documentation checklist, certifications, registrations, undertakings, affidavits, approvals, regulatory compliance, mandatory submissions
- Timeline: Bid submission, technical opening, financial opening, pre-bid meeting, clarifications, site visit, contract signing, delivery milestones
- emdExemption: MSME exemption conditions, Startup India exemption, women entrepreneurs, SC/ST exemptions, specific exemption clauses
- technicalEvaluationCriteria: Scoring pattern, marks distribution, evaluation parameters, minimum qualifying criteria, comparative methodology, weightage allocation
- preQualificationCriteria: 🚨 CRITICAL - Extract ALL eligibility-related requirements from the ENTIRE document EXACTLY AS WRITTEN! 
  * ⚠️ VALIDATION RULE: Extract ONLY what is EXPLICITLY written in the document - DO NOT infer, create, or generate criteria that are not in the document
  * ⚠️ DO NOT change amounts, dates, or numbers (e.g., if document says "Rs. 20 crore", extract "Rs. 20 crore" exactly - do NOT change to "₹10 crores" or any other amount)
  * ⚠️ DO NOT add criteria that are not in the document (e.g., if document doesn't explicitly mention "blacklisting", do NOT add it)
  * ⚠️ Before adding any criterion, verify it exists in the document text - if you cannot find the exact text, DO NOT add it
  * ALL rows from eligibility criteria tables (extract EXACTLY AS WRITTEN with FULL text)
  * Look for tables with columns like "S. No.", "Eligibility Criteria", "Compliance", "Documents to be submitted", "Appendix-B", "Bidder's Eligibility Criteria"
  * Search for section headings like "Bidder's Eligibility Criteria", "Eligibility Criteria", "Pre-Qualification Criteria", "Appendix-B"
  * Extract EVERY row as a separate item with COMPLETE, FULL text - DO NOT shorten, summarize, or abbreviate
  * Copy the text EXACTLY as it appears in the document, word-for-word, including all details, dates, amounts, percentages
  * If table spans multiple pages, extract ALL rows from ALL pages
  * Include ALL criteria listed in eligibility tables: Experience requirements, financial turnover, net worth, registration requirements, blacklisting status, company registration type, certifications, compliance with government orders, MSME status, profitability, client references, litigations, debarment, etc.
  * ⚠️ IMPORTANT: Also include eligibility-related requirements from Financial, Technical, Operational sections ONLY if they are explicitly stated as eligibility criteria in the document
  * DO NOT differentiate or separate eligibility criteria into different sections - put ALL eligibility requirements here
  * If eligibility criteria are in a table format, extract ALL rows with FULL text - do NOT skip any entries

For bidManagement.keyPoints: Extract 20-30 items total across categories:
- Deadlines: ALL dates with times and locations
- Requirements: ALL mandatory requirements with specifications
- Specifications: ALL technical specs with standards and certifications
- Financial: ALL payment terms, guarantees, penalties with amounts
- Compliance: ALL documentation and certification needs
→ Be exhaustive - extract EVERY important point from document

For bidManagement.complianceRequirements: Extract 12-18 items per category:
- Financial: Audited financial statements, turnover certificates, net worth certificates, solvency certificates, BG formats
- Technical: Product certifications, test reports, OEM authorizations, technical compliance certificates, quality certifications
- Documentation: Company registration, PAN card, GST registration, EPF/ESI registration, tender fee receipt, EMD proof
- Legal: Power of attorney, non-blacklisting affidavit, integrity pact, undertakings, legal declarations

For bidManagement.riskAreas: Extract 10-15 items per category:
- Financial: Payment delays, retention risks, penalty exposure, BG requirements, turnover shortfall
- Technical: Specification gaps, testing failures, OEM dependency, integration challenges
- Operational: Delivery delays, resource constraints, installation challenges, training gaps
- Timeline: Compressed schedules, dependency risks, milestone pressure, approval delays

For bidManagement.actionItems: Provide 15-25 specific actionable items:
→ Include task, owner, deadline, priority
→ Example: "Obtain OEM authorization letter (Procurement team, 7 days before submission, High priority)"

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

🔍 DEPARTMENT-SPECIFIC DETAILED EXTRACTION GUIDELINES:

**💼 COMMERCIAL DEPARTMENT - Comprehensive Extraction:**
- estimatedValue: Search for "estimated cost", "project value", "budget", "tender value", "contract value", "approximate cost", "work value", "total cost"
  → Extract exact amount with currency
  → Example: "₹2.5 crores (estimated project value)"

- paymentTerms: Search for "payment", "milestone payment", "advance", "within X days", "MSME payment", "retention", "release schedule", "payment schedule", "payment within"
  → Combine ALL payment-related info from entire document into one comprehensive statement
  → Include: advance %, milestone %, retention %, MSME terms, payment timeline
  → Example: "30% advance on PO, 50% on delivery, 15% on installation, 5% retention for 90 days. MSME vendors: 100% within 45 days. Payment processed within 30 days of invoice submission."

- warranties: Search for "warranty", "guarantee", "DLP", "defect liability period", "maintenance", "AMC", "free service", "OEM warranty", "comprehensive warranty", "onsite warranty", "replacement warranty"
  → Combine warranty period, coverage, terms, conditions into detailed statement
  → Include: duration, what's covered, response time, replacement terms, AMC details
  → Example: "3 years comprehensive OEM warranty covering parts and labor with onsite support. 24-hour response time, 48-hour replacement of defective parts. Optional 2-year AMC at 8% of product cost available after warranty."

- penalties: Search for "liquidated damages", "LD", "penalty", "late delivery penalty", "delay charges", "deduction", "% per week", "% per day", "penalty clause", "performance penalty", "late penalty"
  → Extract ALL penalty clauses, percentages, rates, maximum caps
  → Include: rate (% per week/day), maximum cap, trigger conditions
  → Example: "Liquidated damages: 0.5% per week of delay, maximum 10% of contract value. Penalties applicable beyond 2-week grace period. Deducted from running bills or security deposit."

**💰 FINANCE DEPARTMENT - Comprehensive Extraction:**
- turnoverRequired: Search for "minimum turnover", "annual turnover", "average turnover", "₹X crores", "last 3 years", "last 3 financial years", "financial requirement", "revenue requirement", "turnover criteria"
  → Extract exact amounts, time periods, and averaging method
  → Example: "₹10 crores average annual turnover in last 3 financial years (FY 2021-22, 2022-23, 2023-24). Single year minimum: ₹8 crores required."

- netWorth: Search for "net worth", "minimum net worth", "positive net worth", "financial standing", "capital requirement", "equity", "net worth requirement"
  → Include amount and time reference
  → Example: "Positive net worth of minimum ₹5 crores as on last financial year closing"

- bankGuarantee: Search for "performance BG", "PBG", "bank guarantee", "security deposit", "performance security", "% of contract", "performance bond", "BG validity"
  → Include percentage/amount, duration, conditions, encashment terms
  → Example: "Performance Bank Guarantee of 10% of contract value, valid for project duration + 60 days. To be submitted within 15 days of LOI. Unconditional and irrevocable."

**⚖️ LEGAL DEPARTMENT - Comprehensive Extraction:**
- contractType: Search for "contract type", "type of contract", "fixed price", "lump sum", "rate contract", "AMC", "perpetual license", "annual contract", "fixed cost contract", "unit rate contract"
  → If not explicitly found, infer from payment structure or project nature
  → Example: "Fixed price lump sum contract" or "Annual rate contract with price escalation"

- disputeResolution: Search for "arbitration", "dispute resolution", "dispute settlement", "jurisdiction", "governing law", "mediation", "courts", "arbitrator", "arbitration clause", "applicable law"
  → Combine location, method, process, and governing law
  → Example: "Disputes resolved through arbitration under Indian Arbitration and Conciliation Act, 1996. Single arbitrator appointed mutually. Jurisdiction: Delhi High Court. Governing law: Indian Contract Act."

- liabilityCap: Search for "liability limit", "maximum liability", "limitation of liability", "indemnity limit", "cap on liability", "liability cap", "indemnity clause"
  → Extract amount or percentage cap
  → Example: "Liability capped at 100% of contract value. Consequential damages excluded."

**📦 SCM DEPARTMENT - Comprehensive Extraction:**
- leadTime: Search for "delivery period", "delivery schedule", "completion time", "within X days", "within X weeks", "supply schedule", "supply timeline", "implementation timeline", "completion period", "delivery timeline"
  → Extract complete delivery/completion timeline with milestones
  → Example: "Delivery within 45 days from PO, installation within 15 days of delivery, commissioning within 7 days of installation. Total implementation: 67 days maximum."

- miiRequirement: Search for "Make in India", "MII", "Class-I local", "Class-II local", "local content", "indigenous content", "indigenous", "domestic manufacturer", "local supplier", "local content requirement", "% local content"
  → Extract percentage requirement, compliance criteria, and exemptions
  → Example: "Minimum 50% local content required for Class-I local supplier status. Preference given to Make in India products. Class-II local supplier: minimum 20% local content."

**📊 BID MANAGEMENT DEPARTMENT - Comprehensive Arrays:**
- successFactors: Extract 12-20 items per category (not just 5-10):
  → Financial: ALL financial requirements, guarantees, payment terms, EMD, turnover, BG details
  → Technical: ALL technical criteria, evaluation marks, scoring methodology, minimum qualifying marks
  → Operational: ALL delivery timelines, installation requirements, training, support services, manpower
  → Compliance: ALL documentation, certifications, regulatory compliance, mandatory submissions
  → Timeline: ALL deadlines, milestones, critical dates, submission windows

- keyPoints: Extract 20-30 items total across all categories (be very comprehensive):
  → Deadlines: ALL dates and time-sensitive requirements
  → Requirements: ALL mandatory requirements, specifications, conditions
  → Specifications: ALL technical specs, standards, certifications, quality requirements
  → Financial: ALL financial terms, schedules, guarantees, penalties
  → Compliance: ALL compliance requirements, documentation needs, regulatory obligations

- complianceRequirements: Extract 12-18 items per category:
  → Financial: Audited statements, turnover certificates, BG formats, solvency certificates
  → Technical: Test certificates, OEM authorizations, product certifications, compliance certificates
  → Documentation: Company registration, PAN, GST, EMD proof, tender fee, undertakings
  → Legal: Power of attorney, non-blacklisting affidavit, integrity pact, legal declarations

- actionItems: Provide 15-25 specific actionable items for bid preparation with deadlines and owners"""

def build_user_prompt(document_text: str, file_name: str) -> str:
    indian_oems = ", ".join(get_all_indian_oems())
    global_oems = ", ".join(get_all_global_oems())
    
    return f"""You are analyzing an RFP/tender document. Extract information into the JSON schema below.

Document: {file_name}

=== DOCUMENT CONTENT ===
{document_text}
=== END DOCUMENT ===

EXTRACTION RULES:
🚨 CRITICAL VALIDATION RULE: For eligibility criteria (preQualificationCriteria), you MUST extract ONLY what is EXPLICITLY written in the document. Before adding any criterion to preQualificationCriteria:
- Search the document text for the EXACT wording
- If you cannot find the exact text or a very close match, DO NOT add it
- DO NOT infer, create, or generate criteria that are not explicitly stated
- DO NOT change amounts, dates, or numbers (e.g., if document says "Rs. 20 crore", extract "Rs. 20 crore" not "₹10 crores")
- If the document shows a table with eligibility criteria, extract ONLY from that table - do NOT add criteria from other sections unless they are explicitly marked as eligibility criteria

1. PRIORITIZE information with NUMERIC values (amounts, percentages, dates, quantities, thresholds)
2. For ALL departmental fields: Write DETAILED, COMPREHENSIVE summaries (2-4 sentences minimum)
3. Arrays: Extract MINIMUM 10-15 items per category (more is better - aim for 15-20+)
   ⚠️ EXCEPTION: For eligibility criteria (preQualificationCriteria), extract ALL rows from tables EXACTLY as written - extract every single row, no minimum or maximum limit, but ONLY extract what is actually in the document
4. Combine information from multiple document sections into cohesive summaries
5. Use alternative search terms and synonyms for every field
6. Extract from tables, annexures, appendices, footnotes, conditions, clauses, all sections

**🚨 ELIGIBILITY CRITERIA / PRE-QUALIFICATION CRITERIA EXTRACTION (CRITICAL - HIGHEST PRIORITY):**

You are a document extraction engine for eligibility criteria.

TASK:
Extract ALL eligibility criteria EXACTLY as written in the document into bidManagement.successFactors.preQualificationCriteria array.
Do NOT add, rephrase, summarize, or infer anything.
Do NOT generate points that are not present in the document.
Do NOT shorten the text.

RULES:
- Only use text that appears in the provided document context
- If something is not present, DO NOT create it
- Keep original numbering if present (1, 2, 3…)
- Keep full sentences as-is
- Preserve table structure meaning
- Output all points even if they are long
- If criteria span multiple pages, merge them and extract ALL
- Look for tables with columns like: "S. No.", "Eligibility Criteria", "Compliance (Yes/No)", "Documents to be submitted", "Criteria", "Requirement", "Bidder's Eligibility Criteria", "Appendix-B"
- Search for section headings like: "Bidder's Eligibility Criteria", "Eligibility Criteria", "Pre-Qualification Criteria", "Qualification Criteria", "Appendix-B"
- Each row in the eligibility criteria table = ONE separate item in bidManagement.successFactors.preQualificationCriteria array
- Extract the FULL text of each eligibility criterion from the "Eligibility Criteria" column (or equivalent column name)
- DO NOT change amounts, dates, or numbers (e.g., if document says "Rs. 20 crore", extract "Rs. 20 crore" exactly)
- DO NOT add criteria that are not in the document
- DO NOT infer or create criteria based on context
- If eligibility criteria are not found in the document, return empty array []

OUTPUT FORMAT:
Extract each criterion as a separate string in the preQualificationCriteria array:
["Full criterion 1 text exactly as written", "Full criterion 2 text exactly as written", ...]

⚠️ CRITICAL: The user expects to see ALL eligibility criteria EXACTLY as written in the document - do NOT create, infer, or modify any criteria

**EXAMPLE - Correct Eligibility Criteria Extraction:**

If the document has an eligibility criteria table:

DOCUMENT TABLE SHOWS:
S. No. 1: "The Bidder must be an Indian Company/ LLP /Partnership firm registered under applicable Act in India."
S. No. 2: "The Bidder (including its OEM, if any) must comply with the requirements contained in O.M. No. 6/18/2019-PPD, dated 23.07.2020 order (Public Procurement No. 1), order (Public Procurement No. 2) dated 23.07.2020 and order (Public Procurement No. 3) dated 24.07.2020"
S. No. 3: "The Bidder must have an average turnover of minimum Rs. 20 crore during last 03 (three) financial year(s) i.e. FY22-23, FY23-24 and FY24-25. In case of MSME, the Bidder must have a cumulative turnover of minimum Rs.20 crore for last 03 (three) financial year(s) i.e. FY22-23, FY23-24 and FY24-25."

❌ WRONG OUTPUT:
- Extract only 4-5 "most important" criteria
- Shorten: "Bidder must be Indian company"
- Change amounts: "₹10 crores" or "₹20 crores" (document says "Rs. 20 crore")
- Add criteria not in document: "No blacklisting status" (if not in document)
- Infer criteria based on context

✅ CORRECT OUTPUT (preQualificationCriteria array):
[
  "The Bidder must be an Indian Company/ LLP /Partnership firm registered under applicable Act in India.",
  "The Bidder (including its OEM, if any) must comply with the requirements contained in O.M. No. 6/18/2019-PPD, dated 23.07.2020 order (Public Procurement No. 1), order (Public Procurement No. 2) dated 23.07.2020 and order (Public Procurement No. 3) dated 24.07.2020",
  "The Bidder must have an average turnover of minimum Rs. 20 crore during last 03 (three) financial year(s) i.e. FY22-23, FY23-24 and FY24-25. In case of MSME, the Bidder must have a cumulative turnover of minimum Rs.20 crore for last 03 (three) financial year(s) i.e. FY22-23, FY23-24 and FY24-25."
]

⚠️ CRITICAL VALIDATION CHECKLIST:
- ✅ Extract EXACTLY as written - preserve "Rs. 20 crore" not "₹20 crores" or "₹10 crores"
- ✅ Extract ALL rows from the table - if table has 10 rows, extract all 10
- ✅ Each criterion is COMPLETE text exactly as it appears in the document
- ✅ DO NOT add criteria that are not in the document
- ✅ DO NOT infer or create criteria based on what "makes sense"
- ✅ If you cannot find the exact text in the document, DO NOT add it
- ✅ If eligibility criteria are not found in the document, return empty array []

**🚨 FINANCIAL VALUES (bidValue, EMD) - STRICT RULES:**
- ONLY extract if EXPLICITLY stated in document
- DO NOT calculate one from the other
- DO NOT infer or assume
- If not found after thorough search, OMIT field from JSON

**🚨 ALL OTHER FIELDS (Non-financial) - AGGRESSIVE EXTRACTION REQUIRED:**
- NEVER leave fields empty or return simple "N/A"
- Search using ALL alternative terms and synonyms
- Extract from related sections and context
- Infer reasonable values from document content
- Combine multiple mentions into comprehensive detailed statements
- Write detailed 2-4 sentence summaries for descriptive fields
- Extract 10-20+ items for array fields
- Only say "Not specified in document" if absolutely no related info exists anywhere

**📋 EXAMPLES - Good vs Bad Extraction:**
❌ BAD: "warranties": "N/A"
✅ GOOD: "warranties": "Comprehensive 3-year OEM warranty covering all parts and labor, followed by optional 2-year AMC at 8% of product cost. Warranty includes onsite support within 24 hours and replacement of defective parts within 48 hours."

❌ BAD: "paymentTerms": "N/A"
✅ GOOD: "paymentTerms": "30% advance payment on PO, 60% on delivery and installation, 10% retention released after 3-month warranty period. MSME vendors eligible for 100% payment within 45 days as per MSME Act."

❌ BAD: successFactors.Financial: ["EMD required", "Payment terms"]
✅ GOOD: successFactors.Financial: ["EMD: ₹2.5 lakhs (2% of estimated value)", "30% advance payment on PO", "60% on delivery and installation", "10% retention for 90 days", "MSME exemption available from EMD", "Payment within 30 days of invoice", "Bank guarantee required for advance payment", "Performance bank guarantee: 10% of contract value", "No EMD for startups registered under Startup India", "Financial turnover: ₹10 crores in last 3 years required"]

**🚨 PRODUCT EXTRACTION MANDATORY**: 
- Search ONLY in BOQ/BOM/product list sections for actual products/items
- ⚠️ ALL products MUST go into productMapping.miiProductStatus array
- ⚠️ DO NOT extract eligibility criteria, exemptions, requirements, or conditions as products
- ⚠️ Products must be actual items/services that can be procured (e.g., Server, Computer, Software, Furniture, Equipment)
- Extract products from product tables only - do NOT extract from eligibility/requirement sections
- Extract at least 5-10 products if any product information exists in BOQ/BOM sections
- If NO products found in BOQ/BOM sections after thorough search, return empty array []

**🚨 CONSISTENCY MANDATE**: 
- lastSubmissionDate in projectOverview MUST match bidManagement.keyDeadlines
11. **🚨 CRITICAL - EMD vs BID VALUE DISTINCTION (MANDATORY)**:
   - ⚠️ EMD (Earnest Money Deposit) and Bid Value are DIFFERENT and should NEVER be the same
   - ⚠️ EMD is typically 1-2% of the Bid Value (e.g., if Bid Value is ₹10 Crores, EMD might be ₹2 Lakhs or 0.2%)
   - ⚠️ EMD is a small security deposit, Bid Value is the total contract/project value
   - Search for EMD using: "EMD", "Earnest Money Deposit", "Security Deposit", "Bid Security", "Tender Fee", "EMD amount"
   - Search for Bid Value using: "Bid Value", "Estimated Value", "Project Value", "Contract Value", "Tender Value", "Work Value", "Total Value", "Estimated Cost"
   - ⚠️ CRITICAL: ONLY extract values that are EXPLICITLY mentioned in the document
   - ⚠️ DO NOT calculate EMD from Bid Value (e.g., don't calculate "2% of bid value" if not mentioned)
   - ⚠️ DO NOT calculate Bid Value from EMD (e.g., don't reverse-calculate "EMD is 2%, so bid value is...")
   - ⚠️ DO NOT assume or infer values - only extract what is directly stated
   - If you find "EMD: ₹3,51,000" and "Bid Value: ₹3,51,000", this is WRONG - one of them is incorrect
   - If EMD and Bid Value appear the same, check if one is actually a percentage (e.g., "EMD: 2% of bid value")
   - If document says "EMD: ₹3,51,000" and no separate Bid Value mentioned, return "N/A" for Bid Value - DO NOT calculate it
   - If document says "Bid Value: ₹10 Crores" and no EMD mentioned, return "N/A" for EMD - DO NOT calculate it
   - DO NOT copy EMD value to Bid Value or vice versa - they are fundamentally different amounts
   - EMD is usually mentioned near bid submission requirements, Bid Value is usually in project description or financial section
   - If not found in document, return "N/A" - NEVER assume or calculate

**TENDER ID EXTRACTION (CRITICAL - Search for ALL alternative names):**
🚨 MANDATORY: Search ENTIRE document for Tender ID using ALL these alternative names:
- Tender Reference Number, Tender Ref No., Bid ID, Bid Reference Number
- RFP Number, RFP ID, RFQ Number, EOI Number
- Procurement Reference Number, Procurement ID
- Notice Number, NIT Number (Notice Inviting Tender Number), NIT ID
- Enquiry Number, Quotation Number, Notice ID

**CORRIGENDUM & MULTI-DOC HANDLING:**
- If the text contains both a base RFP and one or more Corrigendums/Amendments, use the information from the LATEST corrigendum when terms contradict the original RFP.
- Clearly note changes in deadlines, financial requirements, or technical specifications that were introduced by corrigendums.
- When resolving conflicts, the LATEST document/section always takes precedence.

⚠️ STRICT RULES:
1. Search for ALL the above terms in the document
2. Extract the EXACT value/number found (e.g., "RFP-2024-001", "NIT-123/2024", "Tender No. ABC/XYZ/2024")
3. Do NOT use the filename (e.g., "RFP-Volume2_merged.pdf") unless NO tender ID is found anywhere in the document
4. If multiple tender IDs found, use the MOST PROMINENT one (usually in header/first page/title)
5. If NONE found after searching all terms → Use filename as last resort only

**🚨 PRODUCT EXTRACTION (CRITICAL - HIGHEST PRIORITY):**
🚨 MANDATORY: You are a document parser, NOT a summarizer. Follow the steps EXACTLY. Do not skip steps.

**SYSTEM ROLE:**
You are a document parser, not a summarizer.

**TASK:**
Follow the steps EXACTLY. Do not skip steps.

========================
STEP 1 — CANDIDATE DETECTION
========================
Scan the entire document and list EVERY line or heading that describes
any action or deliverable (supply, installation, configuration, setup,
commissioning, deployment, service, etc.).

Output as:
CANDIDATES:
- exact text
- page number (if known)

Do not deduplicate.
Do not summarize.
Do not group.
Just dump all candidates.

Look for:
- "Supply of ...", "Supply and ...", "Supply, ..."
- "Installation of ...", "Install ...", "Installing ..."
- "Configuration of ...", "Configure ...", "Configuring ..."
- "Setup of ...", "Set up ...", "Setting up ..."
- "Commission of ...", "Commissioning ...", "Commission ..."
- "Deploy ...", "Deployment of ...", "Deploying ..."
- "Upgrade ...", "Upgrading ...", "Upgrade of ..."
- "Maintain ...", "Maintenance of ...", "Maintaining ..."
- "Provide ...", "Provision of ...", "Providing ..."
- Any heading or line that describes work to be performed
- BOQ lines with quantity or delivery days
- Section titles that describe deliverables

========================
STEP 2 — SEMANTIC GROUPING
========================
Group the above candidates that refer to the same deliverable
even if worded differently.

Group by:
action + item + location

Example:
- "Supply of Server at Mumbai" and "Supply Of Server At Akashvani Mumbai" = same group
- "Installation of Server at Mumbai" = different group (different action)
- "Supply of Server at Pune" = different group (different location)

========================
STEP 3 — DEDUPLICATION
========================
From each group, keep only one representative entry
unless quantity differs.

If same product appears multiple times with same quantity → keep one
If same product appears with different quantities → keep both

========================
STEP 4 — FINAL OUTPUT
========================
Return ONLY the final result in productMapping.miiProductStatus array format:

Each product should be an object with:
{
  "productName": "exact product name as in document",
  "category": "...",
  "quantity": "...",
  "unit": "...",
  "oem": "...",
  "model": "...",
  "specifications": "...",
  "miiStatus": "..."
}

RULES:
- Use only text found in the document
- Do NOT hallucinate
- Do NOT skip steps
- Services count as products
- Extract exact text as written - do NOT summarize, shorten, or rewrite
- Preserve exact wording: "Supply Of Server At Akashvani Mumbai" not "Server at Mumbai"

⚠️ CRITICAL VALIDATION BEFORE EXTRACTION:
Before adding ANY item to productMapping.miiProductStatus, ask yourself:
1. Is this an actual PRODUCT or SERVICE that can be supplied/procured?
2. Does it have a clear product/service name (e.g., "Server", "Installation Service", "Configuration Service")?
3. Does it match a pattern like "Supply of...", "Installation of...", "Configuration of..."?
4. Does it contain words like "exemption", "eligibility", "requirement", "criteria", "minimum", "must", "should", "shall"?
   → If YES to question 4, DO NOT extract it - it's NOT a product!
5. Does it end with "Yes" or "No"? (e.g., "...Experience Yes")
   → If YES, DO NOT extract it - it's likely an eligibility criterion!

**CRITICAL: WHERE TO PUT PRODUCTS:**
- ⚠️ ALL products and services MUST go into: productMapping.miiProductStatus (array)
- ⚠️ DO NOT put products in technical.keySpecifications
- ⚠️ technical.keySpecifications is ONLY for technical specifications text, NOT for product lists
- ⚠️ productMapping.miiProductStatus is the ONLY correct location for product extraction
- If you find products mentioned in technical specs, extract them to productMapping.miiProductStatus, NOT technical.keySpecifications

**🚨 CRITICAL VALIDATION - WHAT IS A PRODUCT/SERVICE:**
- ⚠️ Products/Services are PHYSICAL ITEMS or SERVICES that can be procured/supplied:
  * Products: Server, Desktop Computer, Software License, Chair, Table, AC Unit, Router, Switch, etc.
  * Services: Installation, Configuration, Supply, Maintenance, Support, etc.
  * Include location-specific items: "Supply of Server at Mumbai", "Installation of Server at Pune", etc.
- ⚠️ DO NOT extract eligibility criteria, exemptions, requirements, or conditions as products
- ⚠️ DO NOT extract text like "MSE Exemption for Years Of Experience Yes", "Minimum 50% Local Content", "Eligibility Criteria", etc. as products
- ⚠️ DO NOT extract section headers, instructions, or guidelines as products
- ⚠️ Products/Services must be actual items/services listed in BOQ/BOM/product tables or clearly stated in the document
- ⚠️ If text contains words like "exemption", "eligibility", "requirement", "criteria", "minimum", "must", "should", "shall" - it is likely NOT a product
- ⚠️ Products/Services typically have: Item name, Quantity, Unit, Specifications, Make/Model, Location
- ⚠️ Before adding any item to productMapping.miiProductStatus, verify it is an actual product/service that can be supplied, NOT a requirement or condition

**SEARCH STRATEGY - PATTERN-BASED COMPREHENSIVE EXTRACTION:**
1. **Scan ENTIRE document (all pages, all sections):**
   - Start from page 1, go through every page
   - Do NOT skip any pages
   - Look in: Item Category sections, BOQ tables, section headings, consignee lists, product descriptions

2. **Pattern-based detection:**
   - Search for patterns: "Supply of...", "Installation of...", "Configuration of...", "Supply installation and configuration of..."
   - Look for headings ending with locations: "...at Mumbai", "...at Pune", "...at Akashvani Mumbai"
   - Identify BOQ lines with quantity or delivery days
   - Find section titles that describe deliverables

3. **Semantic grouping:**
   - Group similar phrases: "Supply of Server at Mumbai" = "Supply Of Server At Akashvani Mumbai" (normalize and extract once)
   - Each unique combination: action + item + location = one product
   - Example: "Supply of Server at Mumbai" and "Supply of Server at Pune" = 2 different products (different locations)

4. **Multi-signal validation:**
   - Check Item Category section
   - Check BOQ headings
   - Check section titles
   - Check consignee list headings
   - If 2+ signals confirm same deliverable → extract as product

5. **Extract services separately:**
   - "Supply of Server" = one product
   - "Installation of Server" = different product
   - "Configuration of Server" = different product
   - Each service type is a separate product

6. **Extract location-specific items separately:**
   - "Server at Mumbai" and "Server at Pune" = DIFFERENT products
   - Same item at different locations = separate products

7. **Deduplication:**
   - If same product appears multiple times, extract ONCE
   - If quantity differs, treat as separate products

8. **DO NOT extract from:**
   - Eligibility criteria sections
   - Exemption sections
   - Requirement sections
   - Text containing "exemption", "eligibility", "requirement", "criteria"

9. **MANDATORY: Extract ALL products/services from ALL pages**

**EXTRACTION RULES - STRICT ACCURACY:**
- Extract exact text as written in document - do NOT summarize, shorten, rewrite, or hallucinate
- If document says "Supply Of Server At Akashvani Mumbai", extract exactly that, not "Server at Mumbai"
- If a heading or line describes work to be performed, treat it as a potential product
- Use action-based pattern detection: Look for action verbs (supply, install, configure, setup, commission, deploy, upgrade, maintain, provide, etc.)
- If you find multiple pages with products/services, extract ALL unique products
- If document mentions different actions separately, extract each as a separate product/service
- If product names include locations, extract them as separate products (different locations = different products)
- If you find a table with products (BOQ/BOM), extract EVERY row as a separate product into productMapping.miiProductStatus
- If product name is missing, use the item description or first column value
- If multiple products are listed in one row, split them into separate entries in productMapping.miiProductStatus
- Use semantic grouping: Group similar phrases referring to the same deliverable
- Deduplication: Count each unique action + item + location once unless quantity differs
- Count total: If document says "Total Quantity = 6", ensure you extract 6 unique products/services
- ⚠️ VALIDATION CHECKLIST - Before adding ANY item to productMapping.miiProductStatus:
  * ✅ Is it an actual product/service that can be supplied? (e.g., Server, Installation Service, Configuration Service)
  * ✅ Does it have a clear product/service name? (e.g., "Server", "Installation", "Configuration")
  * ✅ Is it from a BOQ/BOM/product table or clearly stated product/service description?
  * ❌ Does it contain "exemption", "eligibility", "requirement", "criteria", "minimum", "must", "should", "shall"?
     → If YES, DO NOT extract - it's NOT a product! REJECT IT IMMEDIATELY!
  * ❌ Is it a sentence describing a requirement? (e.g., "MSE Exemption for Years Of Experience Yes")
     → If YES, DO NOT extract - it's NOT a product! REJECT IT IMMEDIATELY!
  * ❌ Does it end with "Yes" or "No"? (e.g., "...Experience Yes", "...Content Yes")
     → If YES, DO NOT extract - it's likely an eligibility criterion! REJECT IT IMMEDIATELY!
  * ❌ Does it start with "MSE", "MSME", or contain "Exemption"?
     → If YES, DO NOT extract - it's an exemption/eligibility criterion! REJECT IT IMMEDIATELY!
  * ❌ Does it look like a checkbox item or eligibility question? (e.g., "MSE Exemption for Years Of Experience Yes")
     → If YES, DO NOT extract - it's NOT a product! REJECT IT IMMEDIATELY!
- Count total products/services: If document says "Total Quantity = 6", ensure you extract 6 products/services
- Search for product headings: Look for "Supply Of", "Installation Of", "Configuration Of" - these are products/services
- Extract from ALL pages: If page 5 has "Supply of Server at Mumbai" and page 6 has "Supply of Server at Pune", extract BOTH
- If NO products found after thorough search in BOQ/BOM sections, return empty array [] for productMapping.miiProductStatus
- ⚠️ REMEMBER: Products go in productMapping.miiProductStatus, NOT in technical.keySpecifications
- ⚠️ CRITICAL: DO NOT extract eligibility criteria, exemptions, or requirements as products - if text contains these words, skip it!

**EXAMPLE - What IS and IS NOT a Product:**

❌ NOT PRODUCTS - ABSOLUTELY DO NOT EXTRACT THESE (These are eligibility criteria/exemptions):
- "MSE Exemption for Years Of Experience Yes" ← THIS IS WRONG - DO NOT EXTRACT
- "Minimum 50% Local Content required" ← THIS IS WRONG - DO NOT EXTRACT
- "Eligibility Criteria" ← THIS IS WRONG - DO NOT EXTRACT
- "The Bidder must be an Indian Company" ← THIS IS WRONG - DO NOT EXTRACT
- "Average annual turnover of ₹20 crores required" ← THIS IS WRONG - DO NOT EXTRACT
- "Bank Guarantee of 5% required" ← THIS IS WRONG - DO NOT EXTRACT
- Any text containing: "exemption", "eligibility", "requirement", "criteria", "minimum", "must", "should", "shall"
- Any text ending with "Yes" or "No" (e.g., "...Experience Yes", "...Content Yes")
- Any text starting with "MSE", "MSME" followed by "Exemption"
- Section headers, instructions, requirements, exemptions, criteria

⚠️ CRITICAL: If you see "MSE Exemption for Years Of Experience Yes" in the document, DO NOT extract it as a product. It is an eligibility criterion, NOT a product! REJECT IT IMMEDIATELY!

✅ ACTUAL PRODUCTS/SERVICES - EXTRACT THESE (These are real products/services):
- "Supply of Server at Akashvani Mumbai" (from product description/heading)
- "Supply of Server at Akashvani Pune" (from product description/heading)
- "Installation of Server at Akashvani Mumbai" (from product description/heading)
- "Installation of Server at Akashvani Pune" (from product description/heading)
- "Configuration of Server at Akashvani Mumbai" (from product description/heading)
- "Configuration of Server at Akashvani Pune" (from product description/heading)
- "Server" (from BOQ table)
- "Desktop Computer" (from product list)
- "Office Chair" (from BOM)
- "Split-Type AC 1.5 Ton" (from item list)
- "Network Switch 24 Port" (from product table)
- "Software License" (from BOQ)

⚠️ CRITICAL: If you see "MSE Exemption for Years Of Experience Yes" in the document, DO NOT extract it as a product. It is an eligibility criterion, NOT a product!

**EXAMPLE - Document with Multiple Products (Action-Based Pattern Detection):**

If document shows across multiple pages:
- Page 5: "Supply Of Server At Akashvani Mumbai" (heading describing work to be performed)
- Page 6: "Supply Of Server At Akashvani Pune" (heading describing work to be performed)
- Page 7: "Installation Of Server At Akashvani Mumbai" (heading describing work to be performed)
- Page 8: "Installation Of Server At Akashvani Pune" (heading describing work to be performed)
- Page 9: "Configuration Of Server At Akashvani Mumbai" (heading describing work to be performed)
- Page 10: "Configuration Of Server At Akashvani Pune" (heading describing work to be performed)
- Document states "Total Quantity = 6"

**Action-Based Pattern Detection:**
- Found action "Supply" with item "Server" at locations "Mumbai" and "Pune" → 2 unique products
- Found action "Installation" with item "Server" at locations "Mumbai" and "Pune" → 2 unique products
- Found action "Configuration" with item "Server" at locations "Mumbai" and "Pune" → 2 unique products
- Each unique combination: action + item + location = separate product
- Total: 6 unique products

**Multi-Signal Validation:**
- Signal 1: Headings confirm "Supply Of Server At..." (2 locations)
- Signal 2: BOQ/Item Category confirms same items
- Signal 3: Consignee lists confirm delivery locations
- At least 2 signals confirm each deliverable → Extract as products

**Extract ALL 6 products/services (exact text as in document):**
[
  {"productName": "Supply Of Server At Akashvani Mumbai", "quantity": "1", ...},
  {"productName": "Supply Of Server At Akashvani Pune", "quantity": "1", ...},
  {"productName": "Installation Of Server At Akashvani Mumbai", "quantity": "1", ...},
  {"productName": "Installation Of Server At Akashvani Pune", "quantity": "1", ...},
  {"productName": "Configuration Of Server At Akashvani Mumbai", "quantity": "1", ...},
  {"productName": "Configuration Of Server At Akashvani Pune", "quantity": "1", ...}
]

⚠️ CRITICAL: Extract exact text as written - "Supply Of Server At Akashvani Mumbai" not "Supply of Server at Mumbai"
⚠️ CRITICAL: If a heading or line describes work to be performed, treat it as a potential product
⚠️ CRITICAL: Use action-based detection - look for verbs: supply, install, configure, setup, commission, deploy, upgrade, maintain, provide, etc.

**OEM & MODEL EXTRACTION (CRITICAL - MANDATORY):**
- ⚠️ ALWAYS extract model names - NEVER return "N/A" for model unless absolutely impossible
- Search for brand names in: product descriptions, "Approved Makes", specifications, "Make & Model" columns, brand columns
- Search for model numbers/names in: "Model:", "Model No:", "Part Number:", "SKU:", "Product Code:", product descriptions
- Multiple brands listed → extract FIRST one mentioned AND extract model for that brand
- Keywords to look for: "Make:", "Brand:", "Model:", "Model No:", "or equivalent", "Approved Manufacturer", "Manufacturer"
- Extract model number/name if present (e.g., "Dell PowerEdge R750", "HP ProLiant DL380", "Cisco Catalyst 9300", "Model XYZ-123")
- If model not explicitly found but product name contains model info (like "Dell R750 Server"), extract it from product name
- If product name IS a model identifier (like "Model 2", "Variant A"), use that as the model
- If specifications mention model numbers/codes, extract them as the model
- For generic products (like "False Ceiling", "Manager Table", "Split-Type AC"), infer a standard model name based on specifications:
  * Example: "False Ceiling" with specs → "Standard False Ceiling Panel [specs]"
  * Example: "Manager Table" → "Standard Manager Table [dimensions if mentioned]"
  * Example: "Split-Type AC" with capacity → "Standard Split AC [tonnage]"
- Only return "Unspecified" for OEM if NO brand found after searching ENTIRE document
- Only return "N/A" for model if NO model information exists AND product is too generic to infer
- Extract model from product name/description if separate model field not found
- ⚠️ CRITICAL: If product has OEM but model is "N/A", try harder - check specifications, product name, and related text for model clues

**MII STATUS:**
- Indian OEMs: {indian_oems}
- Global OEMs: {global_oems}
- If mentions "Make in India", "MII compliant", "Class-I Local" → mark as "MII-Compliant"
- If uncertain, use "Requires Review"

**🚨 DEPARTMENT-SPECIFIC EXTRACTION MANDATES (NO N/A ALLOWED):**

**COMMERCIAL DEPARTMENT:**
- estimatedValue: Search for: "Estimated Cost", "Project Value", "Contract Value", "Approximate Cost", "Budget", "Total Value", "Work Value"
- paymentTerms: Search for: "Payment Schedule", "Payment Milestones", "Billing Terms", "Payment Conditions", "Invoice Terms", "MSME Payment", "Payment within X days"
- warranties: Search for: "Warranty Period", "Guarantee", "Defect Liability Period", "DLP", "Maintenance Period", "AMC", "Comprehensive Warranty", "Onsite Warranty"
- penalties: Search for: "Liquidated Damages", "LD", "Penalty Clause", "Delay Penalty", "Performance Penalty", "Compensation for Delay"
- pricingBid requirements: Search for: "Price Bid Format", "Financial Bid", "Annexure", "BOQ", "Price Schedule", "Bid Submission Format"
- evaluationCriteria: Search for: "Evaluation Methodology", "Selection Criteria", "Lowest Cost", "L1", "QCBS", "Two Cover System", "Technical-Financial Weightage"

**FINANCE DEPARTMENT:**
- turnoverRequired: Search for: "Minimum Turnover", "Annual Turnover", "Financial Turnover", "Revenue Requirement", "₹X crores in last 3 years"
- bankGuarantee: Search for: "Performance Bank Guarantee", "PBG", "Security Deposit", "BG", "Performance Security", "X% of contract value"
- paymentTerms: Search for: "Payment Schedule", "Advance Payment", "Milestone Payment", "Retention Money", "Payment Cycle", "Invoice Payment Terms"

**LEGAL DEPARTMENT:**
- contractType: Search for: "Type of Contract", "Agreement Type", "Fixed Price", "Lump Sum", "Rate Contract", "Annual Maintenance Contract"
- liabilityCap: Search for: "Liability Limitation", "Maximum Liability", "Cap on Liability", "Indemnity Limit", "Liability not exceeding"
- disputeResolution: Search for: "Arbitration", "Dispute Settlement", "Jurisdiction", "Governing Law", "Mediation", "Arbitration Clause"
- complianceDocuments: Search for: "Mandatory Documents", "Required Certificates", "Compliance Requirements", "Supporting Documents", "Legal Documents"

**SCM (Supply Chain) DEPARTMENT:**
- leadTime: Search for: "Delivery Period", "Delivery Schedule", "Supply Timeline", "Completion Period", "Delivery within X days/weeks"
- criticalItems: Search for: "Critical Components", "Long Lead Items", "Import Items", "Specialized Equipment", "Key Materials"
- riskLevel: Infer from: delivery complexity, import dependencies, specialized items, timeline constraints, supplier availability
- sourcingStrategy: Extract from: "Preferred Vendors", "Approved Makes", "OEM Requirements", "Local Sourcing", "Make in India"

**TECHNICAL DEPARTMENT:**
- keySpecifications: Extract ALL technical specs, standards, performance criteria, compliance requirements
- criticalRequirements: Search for: "Mandatory Requirements", "Technical Specifications", "Performance Standards", "Quality Standards", "IS/ISO Standards"

**EXTRACTION STRATEGY FOR ALL DEPARTMENTS:**
1. Search ENTIRE document (all pages, annexures, appendices, tables)
2. Use ALL synonyms and alternative terms listed above
3. Extract from context if exact term not found (e.g., warranty info from maintenance section)
4. Combine information from multiple sections
5. NEVER leave fields as "N/A" - extract related/partial information instead
6. If truly not found after exhaustive search, OMIT field from JSON (don't include key)

Return ONLY valid JSON with this structure:

{{
  "projectOverview": {{
    "projectName": "string (extract from title, header, or tender name)",
    "client": "string (issuing authority, department, organization)",
    "tenderId": "string (RFP/NIT/Tender ID - search using ALL alternative terms)",
    "bidValue": "string (OPTIONAL - ONLY include if EXPLICITLY mentioned. Search: Bid Value, Project Value, Contract Value, Estimated Cost)",
    "emd": "string (OPTIONAL - ONLY include if EXPLICITLY mentioned. Search: EMD, Earnest Money, Bid Security, Security Deposit)",
    "completionPeriod": "string (delivery/completion timeline - extract from project duration, delivery schedule)",
    "lastSubmissionDate": "string (bid submission deadline - extract from important dates, submission timeline)"
    ⚠️ CRITICAL: emd and bidValue are OPTIONAL fields
    ⚠️ ONLY include if explicitly found in document
    ⚠️ DO NOT calculate one from the other
    ⚠️ If not found, OMIT the field entirely
  }},
  "bidManagement": {{
    "projectOverview": "string",
    "keyDeadlines": "string",
    "strategy": "string",
    "successFactors": {{
      "Financial": ["array"],
      "Technical": ["array"],
      "Operational": ["array"],
      "Compliance": ["array"],
      "Timeline": ["array"],
      "emdExemption": ["array"],
      "technicalEvaluationCriteria": ["array"],
      "preQualificationCriteria": ["array"]
    }},
    "keyPoints": {{
      "Deadlines": ["array"],
      "Requirements": ["array"],
      "Specifications": ["array"],
      "Financial": ["array"],
      "Compliance": ["array"]
    }},
    "complianceRequirements": {{
      "Financial": ["array"],
      "Technical": ["array"],
      "Documentation": ["array"],
      "Legal": ["array"]
    }},
    "riskAreas": {{
      "Financial": ["array"],
      "Technical": ["array"],
      "Operational": ["array"],
      "Timeline": ["array"]
    }},
    "riskFactors": {{
      "liquidatedDamages": ["array"],
      "siteSurvey": ["array"],
      "certifications": ["array"]
    }},
    "actionItems": ["array"]
  }},
  "technical": {{
    "totalItems": 0,
    "compliancePercent": "string",
    "keySpecifications": [{{ "productName": "string", "specification": "string" }}],
    "criticalRequirements": {{ "Performance": ["array"], "Standards": ["array"], "Compatibility": ["array"], "Quality": ["array"] }},
    "riskAreas": {{ "Technical": ["array"], "Compatibility": ["array"], "Performance": ["array"], "Standards": ["array"] }},
    "actionItems": ["array"]
  }},
  "commercial": {{
    "estimatedValue": "string (search: Estimated Cost, Project Value, Budget, Approximate Cost - extract from financial/commercial section)",
    "paymentTerms": "string (search: Payment Schedule, Milestone Payment, Payment within X days, MSME terms - combine from multiple sections)",
    "warranties": "string (search: Warranty Period, Guarantee, DLP, Maintenance, AMC - extract from technical/commercial terms)",
    "penalties": "string (search: Liquidated Damages, LD, Penalty Clause, Delay Penalty - extract from contract/penalty section)",
    "pricingAppointment": [{{ "event": "string", "date": "string", "time": "string", "location": "string", "notes": "string" }}],
    "pricingBid": {{
      "requirements": ["array"],
      "submissionInstructions": ["array"],
      "evaluationCriteria": ["array"],
      "documentsNeeded": ["array"],
      "paymentTerms": ["array"],
      "taxesAndCharges": ["array"]
    }},
    "keyTerms": {{ "Payment": ["array"], "Warranty": ["array"], "Penalties": ["array"], "Contract": ["array"] }},
    "riskAreas": {{ "Financial": ["array"], "Payment": ["array"], "Penalties": ["array"], "Contract": ["array"] }}
  }},
  "finance": {{
    "turnoverRequired": "string (search: Minimum Turnover, Annual Turnover, ₹X crores in last 3 years, Financial Requirement)",
    "netWorth": "string (search: Net Worth, Minimum Net Worth, Financial Standing, Capital Requirement)",
    "bankGuarantee": "string (search: Performance BG, PBG, Bank Guarantee, Security Deposit, X% of contract value)",
    "eligibilityStatus": "string (infer from turnover/financial requirements - e.g., 'Requires ₹50L turnover')",
    "financialRequirements": {{ "Turnover": ["array"], "Net Worth": ["array"], "Bank Guarantee": ["array"], "Eligibility": ["array"] }},
    "riskAreas": {{ "Financial": ["array"], "Eligibility": ["array"], "Cash Flow": ["array"], "Guarantees": ["array"] }}
  }},
  "legal": {{
    "contractType": "string (search: Type of Contract, Fixed Price, Lump Sum, Rate Contract, AMC - extract from agreement/contract section)",
    "liabilityCap": "string (search: Liability Limitation, Maximum Liability, Indemnity Limit, Cap on Liability - extract from legal/liability section)",
    "disputeResolution": "string (search: Arbitration, Dispute Settlement, Jurisdiction, Governing Law, Mediation - extract from legal clauses)",
    "requiredDocuments": ["array"],
    "complianceRequirements": {{ "Legal": ["array"], "Regulatory": ["array"], "Documentation": ["array"], "Certifications": ["array"] }},
    "riskAreas": {{ "Legal": ["array"], "Liability": ["array"], "Disputes": ["array"], "Compliance": ["array"] }}
  }},
  "scm": {{
    "leadTime": "string (search: Delivery Period, Delivery Schedule, Supply Timeline, Completion within X days/weeks - extract from timeline section)",
    "criticalItems": 0,
    "miiRequirement": "string (search: Make in India, MII, Class-I Local, Local Content, Indigenous - extract from compliance/eligibility)",
    "riskLevel": "string (infer from: delivery complexity, specialized items, import dependencies, timeline - e.g., 'High', 'Medium', 'Low')",
    "sourcingStrategy": "string (infer from: Approved Makes, OEM requirements, vendor preferences, local sourcing mentions)",
    "deliverySchedule": "string (extract complete delivery timeline with milestones from delivery/completion section)",
    "warehousingNeeds": "string (extract from installation, storage, handling requirements if mentioned)",
    "qualityControl": "string (search: Quality Standards, Inspection, Testing Requirements, QC Process, Acceptance Criteria)",
    "supplierRequirements": ["array"],
    "logisticsConstraints": ["array"],
    "inventoryManagement": "string",
    "riskMitigation": ["array"],
    "keyActions": ["array"]
  }},
  "productMapping": {{
    "sourceType": "string (e.g., 'BOQ', 'BOM', 'Schedule of Items')",
    "totalItems": <number of products extracted>,
    "totalOEMs": {{ "count": 0, "indian": 0, "global": 0 }},
    "productsMapped": 0,
    "makeInIndiaMapping": {{ "status": "string", "mapped": 0, "unmapped": 0 }},
    "miiProductStatus": [
      {{ 
        "productName": "string (REQUIRED - extract from document, e.g., 'Acoustic Panels', 'Split-Type AC')",
        "category": "string (e.g., 'Infrastructure', 'Electronics', 'HVAC', 'Software')",
        "specifications": "string (full technical specs from document)",
        "quantity": "string (if mentioned in document, else 'N/A')",
        "unit": "string (if mentioned in document, else 'N/A')",
        "oem": "string (brand/manufacturer name if found, else 'Unspecified')",
        "model": "string (model number/name if found, else 'N/A')",
        "miiStatus": "string (will be set later, use 'Pending Classification' for now)"
      }}
    ]
    ⚠️ CRITICAL: ALL products from BOQ/BOM/product lists MUST go here in miiProductStatus array
    ⚠️ DO NOT put products in technical.keySpecifications - that section is for technical specs text only
    ⚠️ If you find products like 'Acoustic Panels' or 'Split-Type AC', extract them HERE, not in technical section
    ⚠️ CRITICAL: ALL products from BOQ/BOM/product lists MUST go here in miiProductStatus array
    ⚠️ DO NOT put products in technical.keySpecifications - that section is for technical specs text only
    ⚠️ If you find products like 'Acoustic Panels' or 'Split-Type AC', extract them HERE, not in technical section
  }}
}}
"""

async def process_large_document(document_text: str, file_name: str) -> Dict[str, Any]:
    chunk_size = CHUNK_SIZE_OPENAI
    chunks = [document_text[i:i + chunk_size] for i in range(0, len(document_text), chunk_size)]
    
    logger.info(f"📄 Processing large document with OpenAI in {len(chunks)} chunks...")
    
    chunk_results = []
    for i, chunk in enumerate(chunks):
        # Check for cancellation before processing each chunk
        try:
            logger.info(f"Processing chunk {i + 1}/{len(chunks)}...")
            retry_count = 0
            success = False
            
            while retry_count <= 2 and not success:
                try:
                    system_prompt = get_system_prompt() # Or specialized chunk prompt if needed
                    user_prompt = build_user_prompt(chunk, f"{file_name} (Part {i + 1}/{len(chunks)})")
                    
                    result = await generate_with_openai_async(system_prompt, user_prompt)
                    chunk_results.append(result["summaries"])
                    success = True
                except asyncio.CancelledError:
                    # User cancelled the request - stop processing gracefully
                    logger.info(f"⚠️ Analysis cancelled by user. Stopping at chunk {i + 1}/{len(chunks)}")
                    raise  # Re-raise to propagate cancellation
                except Exception as e:
                    error_str = str(e)
                    # Check for quota errors
                    if "insufficient_quota" in error_str or "429" in error_str:
                        logger.error(f"❌ OpenAI quota exceeded. Please check your billing and plan details.")
                        logger.error(f"   Visit: https://platform.openai.com/account/billing")
                        raise Exception("OpenAI API quota exceeded. Please check your billing and plan details.")
                    
                    retry_count += 1
                    if retry_count <= 2:
                        logger.warning(f"⚠️ Error processing chunk {i + 1} (attempt {retry_count}/3): {error_str[:100]}")
                    else:
                        logger.error(f"❌ Failed to process chunk {i + 1} after 3 attempts. Skipping...")
                        chunk_results.append({
                            "projectOverview": {},
                            "bidManagement": {},
                            "technical": {},
                            "commercial": {},
                            "finance": {},
                            "legal": {},
                            "scm": {},
                            "productMapping": {"miiProductStatus": []}
                        })
                    
                    if retry_count <= 2:
                        await asyncio.sleep(1 * retry_count)
        except asyncio.CancelledError:
            # User cancelled - return partial results if any
            logger.info(f"⚠️ Analysis cancelled. Returning {len(chunk_results)} processed chunks.")
            if chunk_results:
                final_summaries = naive_merge_summaries(chunk_results)
                return {
                    "summaries": final_summaries,
                    "chunked": True,
                    "chunkCount": len(chunks),
                    "processedChunks": len(chunk_results),
                    "cancelled": True,
                    "model": OPENAI_MODEL,
                    "provider": "openai"
                }
            raise  # Re-raise if no chunks were processed
                    
    final_summaries = naive_merge_summaries(chunk_results)
    
    # Debug: Log merged product mapping
    if final_summaries.get("productMapping"):
        pm = final_summaries["productMapping"]
        product_count = len(pm.get("miiProductStatus", []))
        logger.info(f"📦 Merged product mapping: {product_count} products from {len(chunks)} chunks")
    else:
        logger.warning("⚠️ Merged summaries do NOT contain productMapping section!")
    
    return {
        "summaries": final_summaries,
        "chunked": True,
        "chunkCount": len(chunks),
        "model": OPENAI_MODEL,
        "provider": "openai"
    }

def naive_merge_summaries(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not results:
        return {}
    
    merged = copy.deepcopy(results[0])
    
    for i in range(1, len(results)):
        current = results[i]
        _merge_objects(merged, current)
        
    return merged

def _merge_objects(target: Dict[str, Any], source: Dict[str, Any], path: str = ''):
    for key, value in source.items():
        current_path = f"{path}.{key}" if path else key
        
        if isinstance(value, list):
            if key not in target or not isinstance(target[key], list):
                target[key] = []
                
            if current_path == 'productMapping.miiProductStatus':
                product_map = {p.get('productName'): p for p in target[key] if p.get('productName')}
                
                for product in value:
                    name = product.get('productName')
                    if name:
                        existing = product_map.get(name)
                        if not existing or (product.get('oem') and product.get('oem') != 'Unspecified' and existing.get('oem') == 'Unspecified'):
                            product_map[name] = product
                
                all_products = list(product_map.values())
                with_oem = [p for p in all_products if p.get('oem') and p.get('oem') != 'Unspecified']
                without_oem = [p for p in all_products if not p.get('oem') or p.get('oem') == 'Unspecified']
                
                target[key] = (with_oem + without_oem)[:200]
            else:
                existing_items = set(json.dumps(item, sort_keys=True) for item in target[key])
                for item in value:
                    item_json = json.dumps(item, sort_keys=True)
                    if item_json not in existing_items:
                        target[key].append(item)
                        existing_items.add(item_json)
        elif isinstance(value, dict) and value is not None:
            if key not in target or not isinstance(target[key], dict):
                target[key] = {}
            _merge_objects(target[key], value, current_path)
        # Favor newer information (from later chunks/corrigendums)
        elif value and value != 'N/A':
            # Overwrite if current target is N/A or if we have a fresh value from a later part
            target[key] = value
