"""
Fallback BOQ/Product extractor for when AI fails to extract products
This directly parses the document text for product tables
STRICT VALIDATION: Only extracts actual products, filters out headers, dates, instructions
"""
import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def is_section_header(text: str) -> bool:
    """Check if text is a section header (all caps with dots/underscores)"""
    if not text:
        return True
    
    text_stripped = text.strip()
    
    # Remove leading numbers and dots (like "1. GENERAL ............")
    text_clean = re.sub(r'^\s*\d+[\.)]?\s*', '', text_stripped).strip()
    
    # All caps with trailing dots/underscores (like "GENERAL ........................")
    if re.match(r'^[A-Z\s]+[\.\_\-]{5,}$', text_clean):
        return True
    
    # All caps text (likely headers)
    if re.match(r'^[A-Z\s]{15,}$', text_clean):
        return True
    
    # Text with lots of dots/underscores at the end
    if re.search(r'[\.\_\-]{10,}$', text_clean):
        return True
    
    # Common section header patterns
    header_patterns = [
        r'^[A-Z\s]+:?\s*[\.\_\-]{3,}',  # "SECTION NAME: ..."
        r'^[A-Z\s]+\([A-Z\s]+\)',  # "SECTION (SUBSECTION)"
        r'^(GENERAL|PARTICULARS|REQUEST|SCOPE|SERVICE|SPECIAL|AUDIT|FORCE|ITIL|TICKETING|EXIT)',  # Common section names
    ]
    
    for pattern in header_patterns:
        if re.match(pattern, text_clean, re.IGNORECASE):
            return True
    
    return False

def is_date_or_time(text: str) -> bool:
    """Check if text contains dates or time information"""
    date_patterns = [
        r'\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}',  # DD/MM/YYYY or DD-MM-YYYY
        r'\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}',  # DD Month YYYY
        r'(date|time|deadline|closing|opening|publication).*?\d',  # "Date of publication..."
        r'\d{1,2}:\d{2}\s*(am|pm|AM|PM)',  # Time
    ]
    
    text_lower = text.lower()
    for pattern in date_patterns:
        if re.search(pattern, text_lower):
            return True
    
    return False

def is_address_or_location(text: str) -> bool:
    """Check if text is an address or location"""
    address_keywords = [
        'phase', 'okhla', 'new delhi', 'address', 'location', 'office',
        'street', 'road', 'avenue', 'building', 'floor', 'pin', 'pincode'
    ]
    
    text_lower = text.lower()
    if any(keyword in text_lower for keyword in address_keywords):
        # Check if it has address-like structure
        if re.search(r'\d+.*(phase|floor|building|road|street)', text_lower):
            return True
    
    return False

def is_instruction_or_guideline(text: str) -> bool:
    """Check if text is an instruction, guideline, or requirement statement"""
    instruction_patterns = [
        r'^(the|a|an|all|each|any|every|bidders?|bidder|seller|buyer).*?(must|should|shall|will|are|is|has|have|required|need)',
        r'^(it|this|that|these|those).*?(must|should|shall|will|is|are)',
        r'^(please|kindly|note|ensure|make sure)',
        r'^(submission|submitting|submit|upload|provide|furnish|include)',
        r'^(declaration|certificate|document|copy|scanned)',
        r'^(years?|months?|days?).*?(from|after|before|within)',
        r'^(stage|phase|envelope|envelope\s+\d+)',
        r'^(opening|closing|evaluation|qualification|technical|commercial)',
        r'^(pre-qualification|post-qualification|eligibility)',
        r'^(errors?|rectification|arithmetical)',
        r'^(normalized|score|marks?|calculation)',
        r'^(compliance|compliant|meeting|condition)',
        r'^(validity|valid|refund|refunded)',
        r'^(responsibility|responsible|ensure|ensure)',
    ]
    
    text_lower = text.lower().strip()
    for pattern in instruction_patterns:
        if re.match(pattern, text_lower):
            return True
    
    # Check for eligibility/exemption keywords - these are NOT products
    eligibility_keywords = ['exemption', 'eligibility', 'criteria', 'requirement', 'minimum', 'maximum', 
                           'must be', 'should be', 'shall be', 'required to', 'need to', 'qualification',
                           'local content', 'mse', 'msme', 'turnover', 'net worth', 'blacklisting']
    if any(keyword in text_lower for keyword in eligibility_keywords):
        return True
    
    # Check for instruction-like sentence structure
    if text_lower.endswith('.') and len(text_lower) > 50:
        if any(word in text_lower for word in ['must', 'should', 'shall', 'required', 'need to', 'have to']):
            return True
    
    return False

def is_table_header(text: str) -> bool:
    """Check if text is a table header row"""
    header_keywords = [
        'sr.no', 'sl.no', 's.no', 'serial', 'item', 'description', 
        'product', 'quantity', 'unit', 'rate', 'amount', 'total',
        'specification', 'model', 'oem', 'make', 'brand'
    ]
    
    text_lower = text.lower()
    # If text contains multiple header keywords, it's likely a header row
    keyword_count = sum(1 for keyword in header_keywords if keyword in text_lower)
    if keyword_count >= 2:
        return True
    
    return False

def looks_like_product(text: str) -> bool:
    """Check if text looks like an actual product name"""
    if not text or len(text) < 5:
        return False
    
    text_lower = text.lower().strip()
    
    # REJECT: Eligibility criteria, exemptions, requirements - these are NOT products
    rejection_keywords = [
        'exemption', 'eligibility', 'criteria', 'requirement', 'minimum', 'maximum',
        'must be', 'should be', 'shall be', 'required to', 'need to', 'qualification',
        'local content', 'mse', 'msme', 'turnover', 'net worth', 'blacklisting',
        'years of experience', 'for years', 'exemption for', 'criteria for'
    ]
    if any(keyword in text_lower for keyword in rejection_keywords):
        logger.debug(f"   ❌ Rejected (eligibility/exemption): {text[:60]}")
        return False
    
    # REJECT: Text ending with "Yes" or "No" - these are eligibility checkboxes
    if text_lower.strip().endswith((' yes', ' no', 'yes', 'no')):
        logger.debug(f"   ❌ Rejected (ends with Yes/No): {text[:60]}")
        return False
    
    # REJECT: Text starting with "MSE" or "MSME" followed by exemption/eligibility words
    if re.match(r'^(mse|msme)\s+(exemption|eligibility)', text_lower):
        logger.debug(f"   ❌ Rejected (MSE/MSME exemption): {text[:60]}")
        return False
    
    # Products often contain:
    # - Model numbers (alphanumeric codes)
    # - Technical terms
    # - Brand names
    # - Specifications
    
    product_indicators = [
        r'[A-Z]{2,}\d+',  # Model codes like "ABC123", "X1-Carbon"
        r'\d+\s*(gb|tb|mb|ghz|mhz|w|v|amp|ah)',  # Technical specs
        r'(server|switch|router|firewall|sensor|device|equipment|system|software|license)',
        r'(laptop|desktop|tablet|monitor|printer|scanner|camera)',
        r'(processor|memory|storage|hardware|component)',
        r'(chair|table|furniture|ac|air conditioner|cooling|heating)',
        r'(server|computer|workstation|printer|scanner)',
    ]
    
    indicator_count = sum(1 for pattern in product_indicators if re.search(pattern, text, re.IGNORECASE))
    
    # If it has product indicators, it's likely a product
    if indicator_count > 0:
        return True
    
    # If it's very short and doesn't look like a product, skip
    if len(text) < 10:
        return False
    
    # If it's too long (likely a sentence/instruction), skip
    if len(text) > 150:
        return False
    
    # If it contains question-like structure or ends with "Yes/No", it's likely not a product
    if re.search(r'\b(yes|no|required|applicable)\s*$', text_lower):
        logger.debug(f"   ❌ Rejected (yes/no/required): {text[:60]}")
        return False
    
    # Default: if it passes other filters, consider it
    return True

def extract_products_from_text(document_text: str) -> List[Dict[str, Any]]:
    """
    Extract products from document text when AI fails
    Looks for BOQ/BOM tables and parses them with STRICT validation
    """
    logger.info("🔧 Fallback: Attempting direct BOQ extraction from document text...")
    
    products = []
    lines = document_text.split('\n')
    
    # Find BOQ sections more precisely - prioritize ANNEXURE II/III
    boq_section_starts = []
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        # Prioritize actual BOQ sections
        if re.search(r'annexure\s+(ii|iii|2|3)', line_lower) or \
           re.search(r'bill\s+of\s+(quantities|materials|qty)', line_lower) or \
           re.search(r'\bboq\b', line_lower) or \
           re.search(r'\bbom\b', line_lower):
            boq_section_starts.append(i)
            logger.info(f"   Found potential BOQ section at line {i}: {line[:80]}")
    
    # If no specific BOQ sections found, look for any annexure
    if not boq_section_starts:
        for i, line in enumerate(lines):
            if re.search(r'annexure', line.lower()):
                boq_section_starts.append(i)
                if len(boq_section_starts) >= 5:  # Limit to 5 sections
                    break
    
    if not boq_section_starts:
        logger.warning("   No BOQ section found - searching entire document for tables...")
        boq_section_starts = [0]
    
    # Extract table rows from BOQ sections only
    all_table_rows = []
    for boq_section_start in boq_section_starts[:5]:  # Check up to 5 sections
        # Extract table rows from BOQ section (next 200 lines after header)
        table_section = lines[boq_section_start:min(boq_section_start + 200, len(lines))]
        
        # Look for rows with delimiters (| or tab) - these are likely table rows
        for line in table_section:
            # Only process lines that look like table rows
            if '|' in line or '\t' in line:
                line_clean = line.strip()
                if line_clean and not all(c in '-=|+\t ' for c in line_clean):
                    all_table_rows.append(line_clean)
    
    # If no table rows found, DO NOT fall back to numbered lists
    # Numbered lists in RFP documents are usually section headers, not products
    # Only extract from actual BOQ tables with delimiters
    if not all_table_rows:
        logger.warning("   No table rows found in BOQ sections - strict mode: only extracting from actual tables")
        logger.info("   Skipping numbered lists to avoid extracting section headers as products")
    
    if not all_table_rows:
        logger.warning("   No table rows or numbered lists found")
        return []
    
    logger.info(f"   Found {len(all_table_rows)} potential table rows")
    
    # Parse rows with strict validation
    sr_no_pattern = re.compile(r'^\s*(\d+)[.|)]?\s*')
    quantity_pattern = re.compile(r'\b(\d+(?:\.\d+)?)\s*(nos|no|pcs|units|set|sets|meter|meters|kg|liter|each|ea)\b', re.IGNORECASE)
    
    processed_count = 0
    skipped_count = 0
    
    for row in all_table_rows[:150]:  # Limit to 150 rows for performance
        row_clean = row.strip()
        
        if not row_clean:
            continue
        
        # EARLY FILTERING: Skip obvious non-products before parsing
        if is_section_header(row_clean):
            skipped_count += 1
            logger.debug(f"   ⏭️ Skipped section header: {row_clean[:60]}...")
            continue
        
        if is_date_or_time(row_clean):
            skipped_count += 1
            logger.debug(f"   ⏭️ Skipped date/time: {row_clean[:60]}...")
            continue
        
        if is_address_or_location(row_clean):
            skipped_count += 1
            logger.debug(f"   ⏭️ Skipped address: {row_clean[:60]}...")
            continue
        
        if is_instruction_or_guideline(row_clean):
            skipped_count += 1
            logger.debug(f"   ⏭️ Skipped instruction: {row_clean[:60]}...")
            continue
        
        if is_table_header(row_clean):
            skipped_count += 1
            logger.debug(f"   ⏭️ Skipped table header: {row_clean[:60]}...")
            continue
        
        # Parse the row
        sr_match = sr_no_pattern.match(row_clean)
        sr_no = None
        product_name = None
        quantity = "N/A"
        unit = "N/A"
        cells = []
        
        if sr_match:
            sr_no = sr_match.group(1)
            remaining_text = row_clean[len(sr_match.group(0)):].strip()
            
            if '|' in remaining_text:
                cells = [c.strip() for c in remaining_text.split('|') if c.strip()]
            elif '\t' in remaining_text:
                cells = [c.strip() for c in remaining_text.split('\t') if c.strip()]
            else:
                cells = [c.strip() for c in re.split(r'\s{3,}', remaining_text) if c.strip()]
            
            if not cells:
                cells = [remaining_text] if remaining_text else []
            
            if cells:
                product_name = cells[0]
        else:
            # Try to parse as table row without leading number
            if '|' in row_clean:
                cells = [c.strip() for c in row_clean.split('|') if c.strip()]
            elif '\t' in row_clean:
                cells = [c.strip() for c in row_clean.split('\t') if c.strip()]
            else:
                continue  # Skip non-table rows without numbers
            
            if not cells or len(cells) < 2:
                continue
            
            # Check if first cell is serial number
            sr_match = sr_no_pattern.match(cells[0])
            if sr_match:
                sr_no = sr_match.group(1)
                product_name = cells[1] if len(cells) > 1 else ""
            else:
                product_name = cells[0]
                sr_no = str(len(products) + 1)
        
        # Extract quantity
        if cells:
            for cell in cells[1:]:
                qty_match = quantity_pattern.search(cell)
                if qty_match:
                    quantity = qty_match.group(1)
                    if qty_match.group(2):
                        unit = qty_match.group(2)
                    break
                elif re.match(r'^\d+(\.\d+)?$', cell):
                    quantity = cell
        
        # STRICT VALIDATION of product name
        if not product_name:
            skipped_count += 1
            continue
        
        # Clean product name
        product_name = product_name.strip()
        
        # Remove trailing dots/underscores (section header artifacts) - be aggressive
        product_name = re.sub(r'[\.\_\-]{2,}.*$', '', product_name).strip()
        
        # If after cleaning it's mostly dots/underscores, skip
        if re.match(r'^[\.\_\-]{5,}$', product_name):
            skipped_count += 1
            continue
        
        # Final validation checks - VERY STRICT
        if len(product_name) < 5 or len(product_name) > 150:
            skipped_count += 1
            continue
        
        # Check section header again after cleaning
        if is_section_header(product_name):
            skipped_count += 1
            continue
        
        # Check if it's just dots/underscores
        if re.match(r'^[\.\_\-]{3,}$', product_name):
            skipped_count += 1
            continue
        
        # Check if it's all caps (likely a header)
        if product_name.isupper() and len(product_name) > 10:
            skipped_count += 1
            continue
        
        if is_date_or_time(product_name):
            skipped_count += 1
            continue
        
        if is_instruction_or_guideline(product_name):
            skipped_count += 1
            continue
        
        # Check if it looks like a product - must have product indicators
        if not looks_like_product(product_name):
            skipped_count += 1
            continue
        
        # Additional check: If it doesn't have any technical terms, model numbers, or specs, skip
        # This catches generic headers that passed other checks
        has_technical_content = bool(re.search(r'[A-Z]{2,}\d+|\d+\s*(gb|tb|mb|ghz|mhz|w|v|amp|ah|server|switch|router|firewall|sensor|device|equipment|system|software|license|laptop|desktop|tablet|monitor|printer|scanner|camera|processor|memory|storage|hardware|component)', product_name, re.IGNORECASE))
        if not has_technical_content and len(product_name) < 20:
            # Short text without technical content is likely not a product
            skipped_count += 1
            continue
        
        # Create product object
        product = {
            "srNo": sr_no or str(len(products) + 1),
            "productName": product_name[:100],
            "category": "Other",
            "specifications": " | ".join(cells[2:6]) if len(cells) > 2 else "",
            "quantity": quantity,
            "unit": unit,
            "oem": "Unspecified",
            "model": "N/A",
            "miiStatus": "Pending Classification",
            "source": "fallback-extraction"
        }
        
        products.append(product)
        processed_count += 1
    
    total_processed = len(products) + skipped_count
    logger.info(f"   ✅ Fallback extraction complete:")
    logger.info(f"      - Found {len(all_table_rows)} potential rows")
    logger.info(f"      - Extracted {len(products)} valid products")
    logger.info(f"      - Skipped {skipped_count} non-products (headers/dates/instructions)")
    
    if len(all_table_rows) > 50 and len(products) == 0:
        logger.warning(f"   ⚠️ Found {len(all_table_rows)} potential rows but extracted 0 products")
        logger.warning(f"   ⚠️ This may indicate the document has no BOQ table, or products are in a different format")
    
    if products:
        logger.info(f"   Sample products:")
        for i, p in enumerate(products[:3], 1):
            logger.info(f"      {i}. {p['productName'][:60]}...")
    else:
        logger.warning(f"   ⚠️ No valid products extracted - document may not contain a BOQ/BOM table")
    
    return products


def enhance_analysis_with_fallback_products(analysis_data: Dict[str, Any], document_text: str) -> Dict[str, Any]:
    """
    Check if productMapping is empty and try fallback extraction if needed
    """
    if not analysis_data.get("productMapping"):
        logger.warning("No productMapping in analysis data")
        return analysis_data
    
    product_mapping = analysis_data["productMapping"]
    current_products = product_mapping.get("miiProductStatus", [])
    
    if len(current_products) == 0:
        logger.info("🔄 AI extracted 0 products - trying fallback BOQ extraction...")
        fallback_products = extract_products_from_text(document_text)
        
        if fallback_products:
            logger.info(f"✅ Fallback extraction successful: {len(fallback_products)} products found")
            product_mapping["miiProductStatus"] = fallback_products
            product_mapping["totalItems"] = len(fallback_products)
            product_mapping["extractionMethod"] = "fallback"
            analysis_data["productMapping"] = product_mapping
        else:
            logger.warning("⚠️ Fallback extraction also found 0 products")
    
    return analysis_data

