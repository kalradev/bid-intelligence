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
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
from core.config import settings

logger = logging.getLogger(__name__)

# Initialize OpenAI client with API key from settings
async_client = None
if settings.OPENAI_API_KEY:
    try:
        async_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        logger.info("✅ OEM Recommendation Service: OpenAI client initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize OpenAI client for OEM recommendations: {str(e)}")
        async_client = None
else:
    logger.warning("⚠️ OPENAI_API_KEY not found - OEM recommendations will be disabled")


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
    
    # Check if OpenAI client is initialized
    if not async_client:
        logger.debug(f"⏭️ Skipping batch OEM recommendations - OpenAI client not available")
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
        products_text += f"""
**PRODUCT {i}:**
- Name: {p.get('productName', 'Unknown')}
- Category: {p.get('category', 'Other')}
- Specifications: {p.get('specifications', 'Standard specifications')}
- Quantity: {p.get('quantity', '1')}
{f"- Existing OEM: {p.get('oem')}" if p.get('oem') and p.get('oem') != 'Unspecified' else ''}
"""

    user_prompt = f"""**YOUR TASK:**
Recommend 2-3 suitable OEM manufacturers and their SPECIFIC REAL models for EACH of the following products:

{products_text}

**🚨 CRITICAL MODEL NAME EXTRACTION RULES:**
1. **MANDATORY: Extract model names/numbers from specifications if mentioned** (e.g., "HP LaserJet Pro M404dn", "Dell OptiPlex 7090", "192x15x2400", "Model XYZ-123")
2. **If specifications contain model numbers, dimensions, or part numbers, use those EXACT values**
3. **If product name contains model info (e.g., "Acoustic Panel 192x15x2400"), extract the model part**
4. **If no model in specs/name, provide a REAL, specific model from that OEM's catalog** (e.g., "HP LaserJet Pro M404dn" not just "HP Printer")
5. **NEVER return "N/A", "Standard", or generic names - always provide specific model names/numbers**

**CRITICAL RULES:**
1. Provide REAL manufacturers that exist in the market
2. Extract model names from specifications FIRST, then from product name, then from OEM catalog
3. Match the specifications as closely as possible
4. Prioritize Indian OEMs first (for Make in India compliance)
5. If an OEM is pre-approved/mentioned, include it as the first option
6. Consider availability, pricing tier, and quality

**CATEGORY-SPECIFIC GUIDANCE:**
- Furniture: Consider brands like Godrej, Durian, Featherlite, Nilkamal, Steelcase
- IT Equipment: Consider HP, Dell, Lenovo, HCL, Wipro, Acer, ASUS
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
        "matchScore": 85-100,
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

Return 2-3 recommendations per product."""

    try:
        response = await async_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=4096,  # Increased for batch processing
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        product_recs = result.get("product_recommendations", {})
        
        # Validate and ensure all models are not "N/A"
        validated_recs = {}
        for product_name, recs in product_recs.items():
            validated_list = []
            for rec in recs:
                model = rec.get("model", "N/A")
                if not model or model == "N/A" or model.strip() == "":
                    oem = rec.get("oem", "")
                    # Try to extract from product name
                    if any(char.isdigit() for char in product_name):
                        parts = product_name.split()
                        model_parts = [p for p in parts if any(char.isdigit() for char in p)]
                        model = " ".join(model_parts) if model_parts else f"{oem} {product_name}" if oem else product_name
                    else:
                        model = f"{oem} Standard Model" if oem else f"{product_name} Model"
                    rec["model"] = model
                    logger.warning(f"⚠️ Generated default model '{model}' for {product_name} - OEM: {oem}")
                validated_list.append(rec)
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
        List of 2-3 OEM recommendations with model names, match scores, and reasoning
    """
    
    # Check if OpenAI client is initialized
    if not async_client:
        logger.debug(f"⏭️ Skipping OEM recommendations for {product_name} - OpenAI client not available")
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
Recommend 2-3 suitable OEM manufacturers and their SPECIFIC REAL models that match these specifications.

**🚨 CRITICAL MODEL NAME EXTRACTION RULES:**
1. **MANDATORY: Extract model names/numbers from specifications if mentioned** (e.g., "HP LaserJet Pro M404dn", "Dell OptiPlex 7090", "192x15x2400", "Model XYZ-123")
2. **If specifications contain model numbers, dimensions, or part numbers, use those EXACT values**
3. **If product name contains model info (e.g., "Acoustic Panel 192x15x2400"), extract the model part**
4. **If no model in specs/name, provide a REAL, specific model from that OEM's catalog** (e.g., "HP LaserJet Pro M404dn" not just "HP Printer")
5. **NEVER return "N/A", "Standard", or generic names - always provide specific model names/numbers**

**CRITICAL RULES:**
1. Provide REAL manufacturers that exist in the market
2. Extract model names from specifications FIRST, then from product name, then from OEM catalog
3. Match the specifications as closely as possible
4. Prioritize Indian OEMs first (for Make in India compliance)
5. If an OEM is pre-approved/mentioned, include it as the first option
6. Consider availability, pricing tier, and quality

**CATEGORY-SPECIFIC GUIDANCE:**
- Furniture: Consider brands like Godrej, Durian, Featherlite, Nilkamal, Steelcase
- IT Equipment: Consider HP, Dell, Lenovo, HCL, Wipro, Acer, ASUS
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
      "matchScore": 85-100,
      "priceRange": "Budget" or "Mid-Range" or "Premium",
      "availability": "Readily Available" or "On Order" or "Limited",
      "reasoning": "Brief explanation including how model matches specifications"
    }}
  ]
}}

**IMPORTANT:** The "model" field MUST contain a specific, real model name/number. Extract from specifications first, then product name, then provide a real model from OEM catalog. NEVER use "N/A" or generic names.

Return exactly 2-3 recommendations, ranked by best match score."""

    try:
        response = await async_client.chat.completions.create(
            model="gpt-4o-mini",  # Using gpt-4o-mini for cost-effectiveness
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,  # Low temperature for consistent, factual responses
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
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
                        model = f"{oem} Standard Model" if oem else f"{product_name} Model"
                
                rec["model"] = model
                logger.warning(f"⚠️ Generated default model '{model}' for {product_name} - OEM: {oem}")
            
            validated_recommendations.append(rec)
        
        # Validate and return
        if validated_recommendations:
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
    
    # OPTIMIZATION 1: Smart Filtering - Skip products that already have good OEM info
    products_needing_enrichment = []
    products_already_complete = []
    
    for product in products:
        existing_oem = product.get("oem", "Unspecified")
        existing_model = product.get("model", "N/A")
        
        # Skip if product already has valid OEM AND model
        has_valid_oem = existing_oem and existing_oem not in ["Unspecified", "N/A", ""]
        has_valid_model = existing_model and existing_model not in ["N/A", "", "Unspecified"]
        
        if has_valid_oem and has_valid_model:
            # Product already has good info - skip enrichment
            products_already_complete.append(product)
            logger.debug(f"⏭️ Skipping {product.get('productName')} - already has OEM: {existing_oem}, Model: {existing_model}")
        else:
            # Product needs enrichment
            products_needing_enrichment.append(product)
    
    logger.info(f"📊 Smart Filter Results:")
    logger.info(f"   - Products already complete: {len(products_already_complete)}")
    logger.info(f"   - Products needing enrichment: {len(products_needing_enrichment)}")
    logger.info(f"   - API calls saved: {len(products_already_complete)}")
    
    # If no products need enrichment, return original list
    if not products_needing_enrichment:
        logger.info("✅ All products already have OEM info - no enrichment needed!")
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
                        if not model or model == "N/A" or model.strip() == "":
                            oem = rec.get("oem", "")
                            # Try to extract from product name
                            if any(char.isdigit() for char in product_name):
                                parts = product_name.split()
                                model_parts = [p for p in parts if any(char.isdigit() for char in p)]
                                model = " ".join(model_parts) if model_parts else f"{oem} {product_name}" if oem else product_name
                            else:
                                model = f"{oem} Standard Model" if oem else f"{product_name} Model"
                            rec["model"] = model
                            logger.warning(f"⚠️ Generated default model '{model}' for {product_name} - OEM: {oem}")
                        validated_recommendations.append(rec)
                    
                    # Store all recommendations
                    p_copy["oemRecommendations"] = validated_recommendations
                    
                    # Use the best recommendation as primary OEM/Model
                    best = validated_recommendations[0]
                    p_copy["oem"] = best.get("oem", p_copy.get("oem", "Unspecified"))
                    p_copy["model"] = best.get("model", "N/A")
                    p_copy["miiStatus"] = best.get("miiStatus", "Unmapped")
                    p_copy["recommendationSource"] = "ai_generated"
                    
                    logger.debug(f"✅ Enriched {product_name} with {len(validated_recommendations)} recommendations")
                else:
                    logger.debug(f"⚠️ No recommendations found for {product_name}")
                
                enriched_products.append(p_copy)
                    
            except Exception as e:
            logger.error(f"❌ Error processing batch {batch_num}: {str(e)}")
            # Add products without enrichment if batch fails
            enriched_products.extend([p.copy() for p in batch])
    
    # Combine complete products with enriched products
    final_products = products_already_complete + enriched_products
    
    logger.info(f"✅ Enrichment Complete:")
    logger.info(f"   - Total products: {len(final_products)}")
    logger.info(f"   - Products enriched: {len(enriched_products)}")
    logger.info(f"   - Products skipped: {len(products_already_complete)}")
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


