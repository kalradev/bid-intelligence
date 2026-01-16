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
    if not client:
        raise Exception("OpenAI client not initialized. Please check your OPENAI_API_KEY.")
    
    system_prompt = get_system_prompt()
    user_prompt = build_user_prompt(document_text, file_name)
    
    estimated_tokens = estimate_tokens(document_text)
    document_too_large = estimated_tokens > 25000
    
    try:
        if document_too_large:
            logger.info(f"⚡ Large document ({estimated_tokens} tokens), using OpenAI chunking strategy...")
            return await process_large_document(document_text, file_name)
        
        logger.info(f"🤖 Generating summaries with OpenAI ({OPENAI_MODEL})...")
        result = await generate_with_openai_async(system_prompt, user_prompt)
        logger.info("✅ OpenAI generation successful")
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
- MANDATORY: Use object structure with subheadings, NOT flat arrays
- CRITICAL: If the document contains multiple parts or corrigendums, always prioritize information from the LATEST corrigendum or amendment.
- RESOLVE CONFLICTS: If conflicting values appear for the same requirement, use the MOST SPECIFIC or MOST RECENT value found in the document.
- DEDUPLICATION: Consolidate similar requirements into a single clear statement. Avoid repetition.

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
- If not found, return empty array - DO NOT infer certifications"""

def build_user_prompt(document_text: str, file_name: str) -> str:
    indian_oems = ", ".join(get_all_indian_oems())
    global_oems = ", ".join(get_all_global_oems())
    
    return f"""You are analyzing an RFP/tender document. Extract information into the JSON schema below.

Document: {file_name}

=== DOCUMENT CONTENT ===
{document_text}
=== END DOCUMENT ===

EXTRACTION RULES:
1. PRIORITIZE information with NUMERIC values (amounts, % timelines, quantities, thresholds)
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
- Indian OEMs: {indian_oems}
- Global OEMs: {global_oems}
- If mentions "Make in India", "MII compliant", "Class-I Local" → mark as "MII-Compliant"
- If uncertain, use "Requires Review"

**ESTIMATED VALUE EXTRACTION (Search for ALL alternative names):**
- Estimated Cost, Project Estimate, Indicative Value, etc.

Return ONLY valid JSON with this structure:

{{
  "projectOverview": {{
    "projectName": "string",
    "client": "string",
    "tenderId": "string",
    "bidValue": "string",
    "emd": "string",
    "completionPeriod": "string",
    "lastSubmissionDate": "string"
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
    "estimatedValue": "string",
    "paymentTerms": "string",
    "warranties": "string",
    "penalties": "string",
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
    "turnoverRequired": "string",
    "netWorth": "string",
    "bankGuarantee": "string",
    "eligibilityStatus": "string",
    "financialRequirements": {{ "Turnover": ["array"], "Net Worth": ["array"], "Bank Guarantee": ["array"], "Eligibility": ["array"] }},
    "riskAreas": {{ "Financial": ["array"], "Eligibility": ["array"], "Cash Flow": ["array"], "Guarantees": ["array"] }}
  }},
  "legal": {{
    "contractType": "string",
    "liabilityCap": "string",
    "disputeResolution": "string",
    "requiredDocuments": ["array"],
    "complianceRequirements": {{ "Legal": ["array"], "Regulatory": ["array"], "Documentation": ["array"], "Certifications": ["array"] }},
    "riskAreas": {{ "Legal": ["array"], "Liability": ["array"], "Disputes": ["array"], "Compliance": ["array"] }}
  }},
  "scm": {{
    "leadTime": "string",
    "criticalItems": 0,
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
  }},
  "productMapping": {{
    "sourceType": "string",
    "totalItems": 0,
    "totalOEMs": {{ "count": 0, "indian": 0, "global": 0 }},
    "productsMapped": 0,
    "makeInIndiaMapping": {{ "status": "string", "mapped": 0, "unmapped": 0 }},
    "miiProductStatus": [{{ "productName": "string", "category": "string", "specifications": "string", "quantity": "string", "unit": "string", "oem": "string", "miiStatus": "string" }}]
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
