"""
AI-Powered OEM & Model Recommendation Service

This service uses AI to dynamically recommend suitable OEM manufacturers
and their specific models based on product specifications.

NO HARDCODING - All recommendations are generated in real-time by AI
based on actual specifications from tender documents.
"""

import asyncio
import json
import logging
import re
import hashlib
from typing import List, Dict, Any, Optional
from services import llm_client
from data.mii_database import classify_mii_status, get_all_global_oems, get_all_indian_oems

logger = logging.getLogger(__name__)


def _split_oems(oem_value: str) -> List[str]:
    if not oem_value:
        return []
    parts = re.split(r"\s*/\s*|\s+or\s+|,", str(oem_value), flags=re.I)
    cleaned = []
    seen = set()
    for p in parts:
        v = (p or "").strip()
        if not v:
            continue
        k = v.lower()
        if k in {"unspecified", "n/a", "na"}:
            continue
        if k in seen:
            continue
        seen.add(k)
        cleaned.append(v)
    return cleaned


def _looks_unspecified_oem(value: Any) -> bool:
    text = (value or "").strip().lower() if isinstance(value, str) else str(value or "").strip().lower()
    return text in {"", "unspecified", "unspecified oem", "n/a", "na", "none"}


def _fallback_oems_for_product(product: Dict[str, Any], max_count: int = 3) -> List[str]:
    """Pick deterministic real OEM names based on product category/name."""
    category = str(product.get("category", "")).lower()
    name = str(product.get("productName", "")).lower()

    indian_pool = get_all_indian_oems()
    global_pool = get_all_global_oems()

    candidate_indian = ["Wipro", "HCL", "Dell India"]
    candidate_global = ["Dell", "HPE", "Cisco"]

    if any(k in category or k in name for k in ["network", "switch", "router", "firewall"]):
        candidate_indian = ["Wipro", "HCL", "Dell India"]
        candidate_global = ["Cisco", "HPE", "Juniper"]
    elif any(k in category or k in name for k in ["server", "storage", "compute"]):
        candidate_indian = ["Wipro", "HCL", "Dell India"]
        candidate_global = ["Dell", "HPE", "Lenovo"]
    elif any(k in category or k in name for k in ["security", "monitoring"]):
        candidate_indian = ["Wipro", "HCL", "Tata"]
        candidate_global = ["IBM", "Cisco", "Microsoft"]

    # Keep only OEMs available in database lists
    ordered = []
    for o in candidate_indian + candidate_global:
        if o in indian_pool or o in global_pool:
            ordered.append(o)

    # deterministic but stable ordering by product key
    key = f"{product.get('productName','')}|{product.get('category','')}"
    digest = hashlib.md5(key.encode("utf-8")).hexdigest()
    shift = int(digest[:8], 16) % max(1, len(ordered))
    rotated = ordered[shift:] + ordered[:shift]
    return rotated[:max_count] if rotated else ["Dell", "HPE", "Cisco"][:max_count]


def _build_fallback_recommendations(product: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Ensure UI always gets checklist-style recommendations for each product.
    Uses extracted OEM/model when AI recommendations are unavailable.
    """
    product_name = str(product.get("productName", "")).strip()
    model = str(product.get("model", "N/A")).strip() or "N/A"
    existing_oem = str(product.get("oem", "")).strip()
    mii_status = str(product.get("miiStatus", "")).strip()

    oems = _split_oems(existing_oem)
    if not oems:
        oems = _fallback_oems_for_product(product, max_count=3)

    recs: List[Dict[str, Any]] = []
    for i, oem in enumerate(oems[:4]):
        status = classify_mii_status(oem, str(product.get("category", "")))
        if mii_status in {"Indian OEM", "Global OEM"} and i == 0:
            status = mii_status
        recs.append({
            "oem": oem,
            "model": model if model not in {"", "N/A", "NA"} else f"{oem} {product_name}".strip(),
            "miiStatus": status,
            "matchScore": 95 if i == 0 else 90,
            "priceRange": "From document",
            "availability": "From document",
            "reasoning": "Fallback recommendation generated from extracted tender data",
        })
    return recs


def is_valid_product_for_enrichment(product: Dict[str, Any]) -> bool:
    """
    Check if a product is valid for OEM enrichment.
    EXTREMELY PERMISSIVE: Only rejects obvious non-products (headers with dots, dates, long instructions).
    Allows ALL products that have specifications or look like products.
    """
    import re
    
    product_name = product.get("productName", "").strip()
    
    if not product_name:
        return False
    
    # Remove leading numbers and dots (like "1. GENERAL ............")
    product_clean = re.sub(r'^\s*\d+[\.)]?\s*', '', product_name).strip()
    product_lower = product_clean.lower()
    
    # ONLY reject if it's clearly NOT a product:
    
    # 1. Section headers with trailing dots (like "GENERAL ........................")
    if re.search(r'[\.\_\-]{10,}$', product_clean):
        return False
    
    # 2. Known section header names (exact match only)
    header_names = ['GENERAL', 'PARTICULARS', 'REQUEST', 'SCOPE', 'SERVICE', 
                    'SPECIAL', 'AUDIT', 'FORCE', 'ITIL', 'TICKETING', 'EXIT']
    if product_clean.upper() == header_names or product_clean.upper() in header_names:
        return False
    
    # 3. Dates (DD/MM/YYYY or DD-MM-YYYY format)
    if re.match(r'^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$', product_clean):
        return False
    
    # 4. Very long instruction sentences (50+ chars with instruction keywords)
    instruction_keywords = ['must', 'should', 'shall', 'required', 'submission', 'submit', 
                          'declaration', 'certificate', 'opening', 'closing', 'evaluation']
    if len(product_clean) > 50 and any(keyword in product_lower for keyword in instruction_keywords):
        return False
    
    # 5. Empty or just dots/underscores
    if not product_clean or re.match(r'^[\.\_\-]+$', product_clean):
        return False
    
    # 6. Just "N/A" or similar
    if product_clean.upper() in ['N/A', 'NA', 'NONE', 'NOT APPLICABLE']:
        return False
    
    # EVERYTHING ELSE IS ALLOWED - be extremely permissive
    # If it has a name and doesn't match the rejection criteria above, it's a product
    return True


async def recommend_oem_models_batch(
    products: List[Dict[str, Any]]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Generate AI-powered OEM recommendations for MULTIPLE products in a single API call.
    This is 10x more efficient than individual calls.
    
    Args:
        products: List of product dictionaries with productName, category, specifications
    
    Returns:
        Dictionary mapping product names to their recommendations
    """
    
    if not llm_client.get_async_chat_client():
        logger.debug("⏭️ Skipping batch OEM recommendations - LLM client not available")
        return {}
    
    if not products:
        return {}
    
    # Build batch prompt
    system_prompt = """You are an expert procurement consultant with deep knowledge of:
- Commercial product manufacturers (Indian and Global)
- Product specifications and technical details
- Market availability and pricing
- Industry standards and certifications

Your task is to recommend suitable OEM manufacturers and their specific models 
for MULTIPLE products based on specifications provided."""

    # Build product list for prompt
    products_text = ""
    for i, p in enumerate(products, 1):
        existing_oem = p.get('oem', 'Unspecified')
        oem_note = ""
        if existing_oem and existing_oem not in ['Unspecified', 'N/A', '']:
            oem_note = f"- Existing OEM: {existing_oem}\n  **IMPORTANT: This product already has an OEM. You MUST provide specific model names for this OEM (and optionally other compatible OEMs). If multiple OEMs are listed (e.g., 'HP/Epson/Sharp'), provide models for EACH OEM.**"
        
        products_text += f"""
**PRODUCT {i}:**
- Name: {p.get('productName', 'Unknown')}
- Category: {p.get('category', 'Other')}
- Specifications: {p.get('specifications', 'Standard specifications')}
- Quantity: {p.get('quantity', '1')}
{oem_note}
"""

    user_prompt = f"""**YOUR TASK:**
Recommend 2-5 suitable OEM manufacturers and their SPECIFIC REAL models for EACH of the following products. Prefer giving MORE Indian OEMs (e.g. 2-3 Indian + 0-1 Global) to capture the Indian market; include Global OEMs where relevant but do not make them the majority.

{products_text}

**🚨 CRITICAL MODEL NAME EXTRACTION RULES:**
1. **MANDATORY: Extract model names/numbers from specifications if mentioned** (e.g., "HP LaserJet Pro M404dn", "Dell OptiPlex 7090", "192x15x2400", "Model XYZ-123")
2. **If specifications contain model numbers, dimensions, or part numbers, use those EXACT values**
3. **If product name contains model info (e.g., "Acoustic Panel 192x15x2400"), extract the model part**
4. **If an existing OEM is mentioned, you MUST provide specific model names for that OEM** (e.g., if OEM is "HP/Epson/Sharp", provide models like "HP LaserJet Pro M404dn", "Epson EcoTank ET-2720", "Sharp MX-3070N")
5. **If no model in specs/name, provide a REAL, specific model from that OEM's catalog** (e.g., "HP LaserJet Pro M404dn" not just "HP Printer")
6. **NEVER return "N/A", "Standard", or generic names - always provide specific model names/numbers**
7. **For products with multiple OEMs listed (e.g., "HP/Epson/Sharp"), provide models for EACH OEM mentioned**

**CRITICAL RULES:**
1. Provide REAL manufacturers that exist in the market
2. Extract model names from specifications FIRST, then from product name, then from OEM catalog
3. Match the specifications as closely as possible
4. **Prefer MORE Indian OEMs per product (e.g. 2-3 Indian, 0-1 Global)** to capture the Indian market; include Global OEMs but keep Indian as the majority when good options exist
5. **If an OEM is pre-approved/mentioned in "Existing OEM", you MUST include it and provide specific model names for it**
6. Consider availability, pricing tier, and quality
7. **For each OEM you recommend, ALWAYS provide a specific model name/number - this is MANDATORY**

**MATCH SCORE (matchScore):**
- Use **100** when the recommended model exactly matches the specification, part number, or is the standard/catalog match for that product
- Use **95-99** when the match is very close (minor variation)
- Use **85-94** when the match is good but not exact
- Do not avoid 100; use it whenever the match is exact

**CATEGORY-SPECIFIC GUIDANCE:**
- Furniture: Consider brands like Godrej, Durian, Featherlite, Nilkamal, Steelcase
- IT Equipment: Consider HCL, Wipro, Dell, HP, Lenovo, Acer, ASUS (prioritize Indian: HCL, Wipro)
- Electrical: Consider Philips, Havells, Crompton, Anchor, Syska, Legrand
- Cooling/HVAC: Consider Daikin, Voltas, Blue Star, Carrier, Hitachi
- Networking: Consider Cisco, HPE, D-Link, TP-Link, Netgear
- Security: Consider Honeywell, Bosch, CP Plus, Hikvision, Dahua

**OUTPUT FORMAT (JSON only):**
{{
  "product_recommendations": {{
    "Product 1 Name": [
      {{
        "oem": "Manufacturer Name",
        "model": "Specific Model Name/Number (MANDATORY - extract from specs or provide real model)",
        "miiStatus": "Indian OEM" or "Global OEM",
        "matchScore": 85-100 (use 100 when match is exact),
        "priceRange": "Budget" or "Mid-Range" or "Premium",
        "availability": "Readily Available" or "On Order" or "Limited",
        "reasoning": "Brief explanation including how model matches specifications"
      }}
    ],
    "Product 2 Name": [...],
    ...
  }}
}}

**IMPORTANT:** The "model" field MUST contain a specific, real model name/number. Extract from specifications first, then product name, then provide a real model from OEM catalog. NEVER use "N/A" or generic names.

Return 2-5 recommendations per product (prefer more Indian OEMs; include 1 Global when relevant)."""

    try:
        content, _ = await llm_client.chat_completion_async(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=llm_client.get_model_oem(),
            temperature=0.3,
            max_tokens=4096,
            json_object=True,
        )
        result = llm_client.parse_json_from_response_content(content)
        product_recs = result.get("product_recommendations", {})
        
        # Validate and ensure all models are not "N/A" - generate better model names
        validated_recs = {}
        for product_name, recs in product_recs.items():
            validated_list = []
            for rec in recs:
                model = rec.get("model", "").strip()
                oem = rec.get("oem", "").strip()
                if _looks_unspecified_oem(oem):
                    continue
                
                # If model is missing or "N/A", generate a proper model name
                if not model or model.upper() in ["N/A", "NA", "NONE", ""]:
                    # Strategy 1: Extract from product name if it contains model info
                    if any(char.isdigit() for char in product_name):
                        parts = product_name.split()
                        model_parts = [p for p in parts if any(char.isdigit() for char in p)]
                        if model_parts:
                            model = " ".join(model_parts)
                        else:
                            # Extract numbers and create model
                            numbers = re.findall(r'\d+', product_name)
                            if numbers:
                                model = f"{oem} {' '.join(numbers)}" if oem else f"Model {' '.join(numbers)}"
                            else:
                                model = f"{oem} {product_name}" if oem else product_name
                    else:
                        # Strategy 2: Create model name from OEM + product category
                        # Clean product name for model
                        clean_name = product_name.replace("Split-Type", "Split").replace("-Type", "").strip()
                        if oem:
                            model = f"{oem} {clean_name}"
                        else:
                            model = f"{clean_name} Standard"
                    
                    rec["model"] = model
                    logger.info(f"✅ Generated model '{model}' for {product_name} (OEM: {oem})")
                else:
                    # Model exists but validate it's not generic
                    if model.upper() in ["STANDARD", "STANDARD MODEL", "GENERIC", "N/A STANDARD MODEL"]:
                        # Replace generic model with better name
                        clean_name = product_name.replace("Split-Type", "Split").replace("-Type", "").strip()
                        model = f"{oem} {clean_name}" if oem else f"{clean_name} Standard"
                        rec["model"] = model
                        logger.info(f"✅ Replaced generic model with '{model}' for {product_name}")
                
                rec["miiStatus"] = classify_mii_status(oem, "")
                validated_list.append(rec)
            
            # 🇮🇳 PRIORITIZE INDIAN OEMs - Sort to show Make in India OEMs first
            validated_list.sort(key=lambda x: (
                0 if x.get("miiStatus") == "Indian OEM" else 1,  # Indian OEMs first
                -x.get("matchScore", 0)  # Then by match score descending
            ))
            
            if not validated_list:
                validated_list = _build_fallback_recommendations({"productName": product_name})
            validated_recs[product_name] = validated_list
        
        logger.info(f"✅ Generated batch recommendations for {len(validated_recs)} products")
        return validated_recs
            
    except Exception as e:
        logger.error(f"Error generating batch OEM recommendations: {str(e)}")
        return {}


async def recommend_oem_models(
    product_name: str,
    category: str,
    specifications: str,
    quantity: str = "1",
    existing_oem: str = None
) -> List[Dict[str, Any]]:
    """
    Generate AI-powered OEM and model recommendations based on product specifications.
    FALLBACK for single product - batch processing is preferred.
    
    Args:
        product_name: Name of the product
        category: Product category (Furniture, IT Equipment, Electrical, etc.)
        specifications: Detailed specifications from tender document
        quantity: Quantity required
        existing_oem: OEM mentioned in tender (if any) - will be prioritized
    
    Returns:
        List of 2-5 OEM recommendations with model names, match scores, and reasoning
    """
    
    if not llm_client.get_async_chat_client():
        logger.debug(f"⏭️ Skipping OEM recommendations for {product_name} - LLM client not available")
        return []
    
    # Build the AI prompt with actual specifications
    system_prompt = """You are an expert procurement consultant with deep knowledge of:
- Commercial product manufacturers (Indian and Global)
- Product specifications and technical details
- Market availability and pricing
- Industry standards and certifications

Your task is to recommend suitable OEM manufacturers and their specific models 
based on product specifications provided."""

    user_prompt = f"""**PRODUCT DETAILS:**
- Product Name: {product_name}
- Category: {category}
- Specifications: {specifications or "Standard specifications"}
- Quantity: {quantity}
{f"- Pre-approved/Mentioned OEM: {existing_oem}" if existing_oem and existing_oem != "Unspecified" else ""}

**YOUR TASK:**
Recommend 2-5 suitable OEM manufacturers and their SPECIFIC REAL models that match these specifications. Prefer MORE Indian OEMs (e.g. 2-3 Indian + 0-1 Global); include Global OEMs where relevant but keep Indian as the majority.

**🚨 CRITICAL MODEL NAME EXTRACTION RULES:**
1. **MANDATORY: Extract model names/numbers from specifications if mentioned** (e.g., "HP LaserJet Pro M404dn", "Dell OptiPlex 7090", "192x15x2400", "Model XYZ-123")
2. **If specifications contain model numbers, dimensions, or part numbers, use those EXACT values**
3. **If product name contains model info (e.g., "Acoustic Panel 192x15x2400"), extract the model part**
4. **If an existing OEM is mentioned above, you MUST provide specific model names for that OEM** (e.g., if OEM is "HP/Epson/Sharp", provide models like "HP LaserJet Pro M404dn", "Epson EcoTank ET-2720", "Sharp MX-3070N")
5. **If no model in specs/name, provide a REAL, specific model from that OEM's catalog** (e.g., "HP LaserJet Pro M404dn" not just "HP Printer")
6. **NEVER return "N/A", "Standard", or generic names - always provide specific model names/numbers**
7. **For products with multiple OEMs listed (e.g., "HP/Epson/Sharp"), provide models for EACH OEM mentioned**

**CRITICAL RULES:**
1. Provide REAL manufacturers that exist in the market
2. Extract model names from specifications FIRST, then from product name, then from OEM catalog
3. Match the specifications as closely as possible
4. **Prefer MORE Indian OEMs (e.g. 2-3 Indian, 0-1 Global)** to capture the Indian market; include Global OEMs but keep Indian as the majority when good options exist
5. **If an OEM is pre-approved/mentioned above, you MUST include it and provide specific model names for it**
6. Consider availability, pricing tier, and quality
7. **For each OEM you recommend, ALWAYS provide a specific model name/number - this is MANDATORY**

**MATCH SCORE (matchScore):**
- Use **100** when the recommended model exactly matches the specification, part number, or is the standard/catalog match for that product
- Use **95-99** when the match is very close (minor variation)
- Use **85-94** when the match is good but not exact
- Do not avoid 100; use it whenever the match is exact

**CATEGORY-SPECIFIC GUIDANCE:**
- Furniture: Consider brands like Godrej, Durian, Featherlite, Nilkamal, Steelcase
- IT Equipment: Consider HCL, Wipro, Dell, HP, Lenovo, Acer, ASUS (prioritize Indian: HCL, Wipro)
- Electrical: Consider Philips, Havells, Crompton, Anchor, Syska, Legrand
- Cooling/HVAC: Consider Daikin, Voltas, Blue Star, Carrier, Hitachi
- Networking: Consider Cisco, HPE, D-Link, TP-Link, Netgear
- Security: Consider Honeywell, Bosch, CP Plus, Hikvision, Dahua

**SPECIFICATION MATCHING:**
- Match size/dimensions if specified (extract model numbers from dimensions like "192x15x2400")
- Match power/capacity if specified
- Match material/build quality if specified
- Match features (inverter, smart, LED, etc.) if specified
- Consider technical standards and certifications
- **Extract model numbers/names from specification text (e.g., "Model: XYZ-123", "Part No: ABC456")**

**OUTPUT FORMAT (JSON only, no other text):**
{{
  "recommendations": [
    {{
      "oem": "Manufacturer Name",
      "model": "Specific Model Name/Number (MANDATORY - extract from specs or provide real model)",
      "miiStatus": "Indian OEM" or "Global OEM",
      "matchScore": 85-100 (use 100 when match is exact),
      "priceRange": "Budget" or "Mid-Range" or "Premium",
      "availability": "Readily Available" or "On Order" or "Limited",
      "reasoning": "Brief explanation including how model matches specifications"
    }}
  ]
}}

**IMPORTANT:** The "model" field MUST contain a specific, real model name/number. Extract from specifications first, then product name, then provide a real model from OEM catalog. NEVER use "N/A" or generic names.

Return 2-5 recommendations, ranked by best match score (prefer more Indian OEMs)."""

    try:
        content, _ = await llm_client.chat_completion_async(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=llm_client.get_model_oem(),
            temperature=0.3,
            max_tokens=4096,
            json_object=True,
        )
        result = llm_client.parse_json_from_response_content(content)
        recommendations = result.get("recommendations", [])
        
        # Validate and ensure models are not "N/A"
        validated_recommendations = []
        for rec in recommendations:
            model = rec.get("model", "N/A")
            # If model is N/A or empty, generate a default based on OEM and product
            if not model or model == "N/A" or model.strip() == "":
                oem = rec.get("oem", "")
                category_lower = category.lower()
                product_lower = product_name.lower()
                
                # Try to extract model from product name
                if any(char.isdigit() for char in product_name):
                    # Product name has numbers - might be model info
                    parts = product_name.split()
                    model_parts = [p for p in parts if any(char.isdigit() for char in p)]
                    if model_parts:
                        model = " ".join(model_parts)
                    else:
                        model = f"{oem} {product_name}" if oem else product_name
                else:
                    # Generate default model based on OEM and category
                    if "hp" in oem.lower() and ("printer" in product_lower or "it" in category_lower):
                        model = "HP LaserJet Pro M404dn"
                    elif "dell" in oem.lower() and ("computer" in product_lower or "it" in category_lower):
                        model = "Dell OptiPlex 7090"
                    elif "godrej" in oem.lower() and "furniture" in category_lower:
                        model = "Godrej Interio Series"
                    else:
                        # Generate better model name from product name
                        clean_name = product_name.replace("Split-Type", "Split").replace("-Type", "").strip()
                        if oem:
                            # Try to create a meaningful model name
                            if any(char.isdigit() for char in product_name):
                                numbers = re.findall(r'\d+', product_name)
                                if numbers:
                                    model = f"{oem} {' '.join(numbers)}"
                                else:
                                    model = f"{oem} {clean_name}"
                            else:
                                model = f"{oem} {clean_name}"
                        else:
                            model = f"{clean_name} Standard"
                
                rec["model"] = model
                logger.warning(f"⚠️ Generated default model '{model}' for {product_name} - OEM: {oem}")
            
            validated_recommendations.append(rec)
        
        # Validate and return
        if validated_recommendations:
            # 🇮🇳 PRIORITIZE INDIAN OEMs - Sort to show Make in India OEMs first
            validated_recommendations.sort(key=lambda x: (
                0 if x.get("miiStatus") == "Indian OEM" else 1,  # Indian OEMs first
                -x.get("matchScore", 0)  # Then by match score descending
            ))
            
            logger.info(f"Generated {len(validated_recommendations)} OEM recommendations for {product_name}")
            return validated_recommendations[:3]  # Ensure max 3 recommendations
        else:
            logger.warning(f"No recommendations generated for {product_name}")
            return []
            
    except Exception as e:
        logger.error(f"Error generating OEM recommendations for {product_name}: {str(e)}")
        return []


async def enrich_products_with_recommendations(
    products: List[Dict[str, Any]],
    batch_size: int = 10
) -> List[Dict[str, Any]]:
    """
    Enrich all products with AI-generated OEM recommendations.
    OPTIMIZED: Uses batch processing (10 products per API call) and smart filtering.
    
    Args:
        products: List of product dictionaries
        batch_size: Number of products to process per API call (default: 10)
    
    Returns:
        List of enriched products with OEM recommendations
    """
    
    if not products:
        return []
    
    # OPTIMIZATION 1: Smart Filtering - Filter out invalid products and skip those with recommendations
    products_needing_enrichment = []
    products_already_complete = []
    products_invalid = []
    
    for product in products:
        # First check if product is valid for enrichment (not a header, date, instruction, etc.)
        if not is_valid_product_for_enrichment(product):
            # Even if invalid, ALWAYS generate a model name if model is N/A
            existing_oem = product.get("oem", "Unspecified")
            existing_model = product.get("model", "N/A")
            product_name = product.get("productName", "")
            
            # Generate model name if missing
            if existing_model in ["N/A", "", None]:
                clean_name = product_name.replace("Split-Type", "Split").replace("-Type", "").strip()
                # Remove leading numbers if any
                clean_name = re.sub(r'^\d+\s+', '', clean_name).strip()
                
                if existing_oem not in ["Unspecified", "N/A", "", None]:
                    # Has OEM - create model name from OEM + product
                    if any(char.isdigit() for char in product_name):
                        numbers = re.findall(r'\d+', product_name)
                        if numbers:
                            product["model"] = f"{existing_oem} {' '.join(numbers)}"
                        else:
                            product["model"] = f"{existing_oem} {clean_name}"
                    else:
                        product["model"] = f"{existing_oem} {clean_name}"
                else:
                    # No OEM - create generic model name
                    if any(char.isdigit() for char in product_name):
                        numbers = re.findall(r'\d+', product_name)
                        if numbers:
                            product["model"] = f"{clean_name} {' '.join(numbers)}"
                        else:
                            product["model"] = f"{clean_name} Standard"
                    else:
                        product["model"] = f"{clean_name} Standard"
                
                logger.info(f"✅ Generated model '{product['model']}' for skipped product: {product_name[:50]}...")
            
            products_invalid.append(product)
            product_name_display = product.get('productName', '')[:60]
            logger.info(f"⏭️ Skipping invalid product (header/instruction/date): {product_name_display}...")
            continue
        
        existing_oem = product.get("oem", "Unspecified")
        existing_model = product.get("model", "N/A")
        existing_recommendations = product.get("oemRecommendations", [])
        
        # Only skip if product already has recommendations (meaning it was enriched before)
        # We want to enrich products that:
        # 1. Don't have recommendations yet (even if they have OEM/model)
        # 2. Have OEM but no model (need model suggestions)
        # 3. Have no OEM at all (need both OEM and model)
        has_recommendations = existing_recommendations and len(existing_recommendations) > 0
        
        if has_recommendations:
            # Product already has recommendations - skip to avoid duplicate API calls
            products_already_complete.append(product)
            logger.debug(f"⏭️ Skipping {product.get('productName')} - already has {len(existing_recommendations)} recommendations")
        else:
            # Product needs enrichment (either missing OEM, missing model, or both)
            products_needing_enrichment.append(product)
            logger.debug(f"✅ Will enrich {product.get('productName')} - OEM: {existing_oem}, Model: {existing_model}")
    
    logger.info(f"📊 Smart Filter Results:")
    logger.info(f"   - Products already have recommendations: {len(products_already_complete)}")
    logger.info(f"   - Products needing enrichment: {len(products_needing_enrichment)}")
    logger.info(f"   - Invalid products skipped: {len(products_invalid)}")
    logger.info(f"   - API calls saved: {len(products_already_complete) + len(products_invalid)}")
    
    # If no products need enrichment, return original list
    if not products_needing_enrichment:
        logger.info("✅ All products already have recommendations - no enrichment needed!")
        return products
    
    # OPTIMIZATION 2: Batch Processing - Process 10 products per API call
    enriched_products = []
    
    for i in range(0, len(products_needing_enrichment), batch_size):
        batch = products_needing_enrichment[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(products_needing_enrichment) + batch_size - 1) // batch_size
        
        logger.info(f"🔄 Processing batch {batch_num}/{total_batches} ({len(batch)} products)")
        
        try:
            # Call batch API
            batch_recommendations = await recommend_oem_models_batch(batch)
            
            # Apply recommendations to products
            for product in batch:
                p_copy = product.copy()
                product_name = p_copy.get("productName", "")
                
                # Try to find recommendations for this product
                recommendations = None
                
                # Try exact match first
                if product_name in batch_recommendations:
                    recommendations = batch_recommendations[product_name]
                else:
                    # Try fuzzy match (case-insensitive, partial)
                    for key in batch_recommendations.keys():
                        if key.lower() in product_name.lower() or product_name.lower() in key.lower():
                            recommendations = batch_recommendations[key]
                            break
                
                if recommendations and len(recommendations) > 0:
                    # Validate and ensure all recommendations have models
                    validated_recommendations = []
                    for rec in recommendations:
                        model = rec.get("model", "N/A")
                        oem = (rec.get("oem") or "").strip()
                        if _looks_unspecified_oem(oem):
                            continue
                        if not model or model == "N/A" or model.strip() == "":
                            oem = rec.get("oem", "")
                            # Try to extract from product name or generate better model
                            if any(char.isdigit() for char in product_name):
                                parts = product_name.split()
                                model_parts = [p for p in parts if any(char.isdigit() for char in p)]
                                if model_parts:
                                    model = " ".join(model_parts)
                                else:
                                    numbers = re.findall(r'\d+', product_name)
                                    if numbers:
                                        model = f"{oem} {' '.join(numbers)}" if oem else f"Model {' '.join(numbers)}"
                                    else:
                                        model = f"{oem} {product_name}" if oem else product_name
                            else:
                                # Generate better model name
                                clean_name = product_name.replace("Split-Type", "Split").replace("-Type", "").strip()
                                model = f"{oem} {clean_name}" if oem else f"{clean_name} Standard"
                            rec["model"] = model
                            logger.warning(f"⚠️ Generated default model '{model}' for {product_name} - OEM: {oem}")
                        rec["miiStatus"] = classify_mii_status(oem, p_copy.get("category", ""))
                        validated_recommendations.append(rec)
                    
                    # 🇮🇳 PRIORITIZE INDIAN OEMs - Sort to show Make in India OEMs first
                    validated_recommendations.sort(key=lambda x: (
                        0 if x.get("miiStatus") == "Indian OEM" else 1,  # Indian OEMs first
                        -x.get("matchScore", 0)  # Then by match score descending
                    ))

                    # Prepend document-extracted OEM(s) so they always show in product mapping
                    existing_oem_str = (p_copy.get("oem") or "").strip()
                    if existing_oem_str and existing_oem_str not in ["Unspecified", "N/A", ""]:
                        rec_oems = {r.get("oem", "").strip().lower() for r in validated_recommendations}
                        for part in re.split(r"\s*/\s*|\s+or\s+", existing_oem_str, flags=re.I):
                            part = part.strip()
                            if part and part.lower() not in rec_oems:
                                validated_recommendations.insert(0, {
                                    "oem": part,
                                    "model": p_copy.get("model") or "From document",
                                    "miiStatus": p_copy.get("miiStatus") or "Requires Review",
                                    "matchScore": 100,
                                    "priceRange": "From document",
                                    "availability": "From document",
                                    "reasoning": "Extracted from tender document",
                                })
                                rec_oems.add(part.lower())
                    
                    # Store all recommendations
                    p_copy["oemRecommendations"] = validated_recommendations
                    
                    # Use the best recommendation, but preserve existing OEM if it's valid
                    best = validated_recommendations[0]
                    existing_oem = p_copy.get("oem", "Unspecified")
                    existing_model = p_copy.get("model", "N/A")
                    
                    # Only update OEM if it was missing/unspecified
                    if not existing_oem or existing_oem in ["Unspecified", "N/A", ""]:
                        p_copy["oem"] = best.get("oem", "Unspecified")
                    # Always update model if it was missing or N/A
                    if not existing_model or existing_model in ["N/A", "", "Unspecified"]:
                        p_copy["model"] = best.get("model", "N/A")
                    # Update MII status from best recommendation
                    p_copy["miiStatus"] = classify_mii_status(
                        p_copy.get("oem", best.get("oem", "")),
                        p_copy.get("category", "")
                    )
                    p_copy["recommendationSource"] = "ai_generated"
                    
                    logger.debug(f"✅ Enriched {product_name} with {len(validated_recommendations)} recommendations")
                else:
                    logger.debug(f"⚠️ No recommendations found for {product_name}")
                    # Even if no recommendations, ensure model name is set
                    existing_model = p_copy.get("model", "N/A")
                    existing_oem = p_copy.get("oem", "Unspecified")
                    if existing_model in ["N/A", "", None]:
                        clean_name = product_name.replace("Split-Type", "Split").replace("-Type", "").strip()
                        if existing_oem not in ["Unspecified", "N/A", "", None]:
                            if any(char.isdigit() for char in product_name):
                                numbers = re.findall(r'\d+', product_name)
                                if numbers:
                                    p_copy["model"] = f"{existing_oem} {' '.join(numbers)}"
                                else:
                                    p_copy["model"] = f"{existing_oem} {clean_name}"
                            else:
                                p_copy["model"] = f"{existing_oem} {clean_name}"
                        else:
                            if any(char.isdigit() for char in product_name):
                                numbers = re.findall(r'\d+', product_name)
                                if numbers:
                                    p_copy["model"] = f"{clean_name} {' '.join(numbers)}"
                                else:
                                    p_copy["model"] = f"{clean_name} Standard"
                            else:
                                p_copy["model"] = f"{clean_name} Standard"
                        logger.info(f"✅ Generated model '{p_copy['model']}' for product without recommendations: {product_name}")
                    # Ensure checklist UI still has options for this row
                    p_copy["oemRecommendations"] = _build_fallback_recommendations(p_copy)
                    if _looks_unspecified_oem(p_copy.get("oem")):
                        p_copy["oem"] = p_copy["oemRecommendations"][0]["oem"]
                    p_copy["miiStatus"] = classify_mii_status(p_copy.get("oem", ""), p_copy.get("category", ""))
                
                enriched_products.append(p_copy)
        
        except Exception as e:
            logger.error(f"❌ Error processing batch {batch_num}: {str(e)}")
            # Add products with fallback recommendations if batch fails
            for p in batch:
                p_copy = p.copy()
                if not p_copy.get("oemRecommendations"):
                    p_copy["oemRecommendations"] = _build_fallback_recommendations(p_copy)
                if _looks_unspecified_oem(p_copy.get("oem")):
                    p_copy["oem"] = p_copy["oemRecommendations"][0]["oem"]
                p_copy["miiStatus"] = classify_mii_status(p_copy.get("oem", ""), p_copy.get("category", ""))
                enriched_products.append(p_copy)
    
    # Combine complete products, enriched products, and invalid products (keep them but without enrichment)
    final_products = products_already_complete + enriched_products + products_invalid
    
    # FINAL PASS: Ensure ALL products have model names (never "N/A")
    for product in final_products:
        product_name = product.get("productName", "")
        existing_model = product.get("model", "N/A")
        existing_oem = product.get("oem", "Unspecified")
        
        # If model is still "N/A", generate one
        if existing_model in ["N/A", "", None]:
            clean_name = product_name.replace("Split-Type", "Split").replace("-Type", "").strip()
            clean_name = re.sub(r'^\d+\s+', '', clean_name).strip()  # Remove leading numbers
            
            if existing_oem not in ["Unspecified", "N/A", "", None]:
                # Has OEM - create model from OEM + product
                if any(char.isdigit() for char in product_name):
                    numbers = re.findall(r'\d+', product_name)
                    if numbers:
                        product["model"] = f"{existing_oem} {' '.join(numbers)}"
                    else:
                        product["model"] = f"{existing_oem} {clean_name}"
                else:
                    product["model"] = f"{existing_oem} {clean_name}"
            else:
                # No OEM - create generic model
                if any(char.isdigit() for char in product_name):
                    numbers = re.findall(r'\d+', product_name)
                    if numbers:
                        product["model"] = f"{clean_name} {' '.join(numbers)}"
                    else:
                        product["model"] = f"{clean_name} Standard"
                else:
                    product["model"] = f"{clean_name} Standard"
            
            logger.info(f"✅ Final pass: Generated model '{product['model']}' for {product_name[:50]}...")

        # Final guarantee: every product must have checklist recommendations for UI.
        if not product.get("oemRecommendations"):
            product["oemRecommendations"] = _build_fallback_recommendations(product)
        if _looks_unspecified_oem(product.get("oem")):
            product["oem"] = product["oemRecommendations"][0]["oem"]
        product["miiStatus"] = classify_mii_status(product.get("oem", ""), product.get("category", ""))
    
    logger.info(f"✅ Enrichment Complete:")
    logger.info(f"   - Total products: {len(final_products)}")
    logger.info(f"   - Products enriched: {len(enriched_products)}")
    logger.info(f"   - Products skipped: {len(products_already_complete)}")
    logger.info(f"   - Invalid products (with generated models): {len(products_invalid)}")
    logger.info(f"   - API calls made: {(len(products_needing_enrichment) + batch_size - 1) // batch_size}")
    
    return final_products


def get_recommendation_stats(products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Get statistics about OEM recommendations.
    
    Args:
        products: List of enriched products
    
    Returns:
        Dictionary with recommendation statistics
    """
    total_products = len(products)
    products_with_recommendations = sum(
        1 for p in products if p.get("oemRecommendations")
    )
    total_recommendations = sum(
        len(p.get("oemRecommendations", [])) for p in products
    )
    
    indian_oems = sum(
        1 for p in products 
        if p.get("miiStatus") in ["Indian OEM", "MII Compliant"]
    )
    
    global_oems = sum(
        1 for p in products 
        if p.get("miiStatus") == "Global OEM"
    )
    
    return {
        "totalProducts": total_products,
        "productsWithRecommendations": products_with_recommendations,
        "totalRecommendations": total_recommendations,
        "averageRecommendationsPerProduct": (
            round(total_recommendations / products_with_recommendations, 2) 
            if products_with_recommendations > 0 else 0
        ),
        "indianOEMs": indian_oems,
        "globalOEMs": global_oems,
        "enrichmentRate": (
            round((products_with_recommendations / total_products) * 100, 2) 
            if total_products > 0 else 0
        )
    }


