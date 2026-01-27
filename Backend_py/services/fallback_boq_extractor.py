"""
Fallback BOQ/Product extractor for when AI fails to extract products
This directly parses the document text for product tables
"""
import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def _is_service_rfp(document_text: str) -> bool:
    """
    Detect if this is a service RFP based on keywords in the document
    """
    text_lower = document_text.lower()
    service_keywords = [
        'service', 'services', 'solution', 'solutions', 'consulting', 'consultancy',
        'support', 'training', 'maintenance', 'implementation', 'deployment',
        'soc', 'siem', 'managed services', 'professional services', 'advisory',
        'license', 'licenses', 'licensing', 'subscription', 'saas', 'cloud service'
    ]
    
    # Count service keywords
    service_count = sum(1 for keyword in service_keywords if keyword in text_lower)
    
    # If we find 3+ service keywords, it's likely a service RFP
    if service_count >= 3:
        return True
    
    # Also check for common service RFP phrases
    service_phrases = [
        'service rfp', 'services tender', 'consulting services', 'support services',
        'training services', 'professional services', 'managed services',
        'solution implementation', 'service delivery', 'service provider'
    ]
    
    if any(phrase in text_lower for phrase in service_phrases):
        return True
    
    return False

def _is_top_level_item(product_name: str, all_products: List[Dict[str, Any]]) -> bool:
    """
    Determine if an item is a top-level service item (not a sub-item)
    For service RFPs, we only want top-level items like "SOC Solution", not detailed specs
    """
    product_lower = product_name.lower()
    
    # Top-level items typically:
    # 1. Are longer (service names are usually descriptive)
    # 2. Contain service keywords
    # 3. Don't look like specifications or sub-items
    
    service_indicators = ['solution', 'service', 'services', 'license', 'licenses', 'support', 'training']
    if any(indicator in product_lower for indicator in service_indicators):
        return True
    
    # Sub-items typically:
    # - Are very short (< 10 chars)
    # - Start with numbers/letters like "1.1", "a)", "i)"
    # - Look like specifications (contain ":", "=", ">", "<")
    if len(product_name) < 10:
        return False
    
    if re.match(r'^[a-z0-9][\.\)]\s*', product_lower):
        return False
    
    if any(char in product_name for char in [':', '=', '>', '<', 'specification', 'spec']):
        return False
    
    return True

def _extract_from_table_section(tables_section: str) -> List[Dict[str, Any]]:
    """
    Extract products from the extracted tables section (from PDF table extraction)
    """
    products = []
    lines = tables_section.split('\n')
    current_table = []
    in_table = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check if this is a table marker
        if line.startswith("--- TABLE"):
            if current_table and in_table:
                # Process previous table
                table_products = _parse_table_rows(current_table)
                products.extend(table_products)
            current_table = []
            in_table = True
            continue
        
        if in_table and '|' in line:
            # This is a table row
            cells = [c.strip() for c in line.split('|') if c.strip()]
            if len(cells) >= 2:  # At least 2 columns
                current_table.append(cells)
    
    # Process last table
    if current_table and in_table:
        table_products = _parse_table_rows(current_table)
        products.extend(table_products)
    
    return products

def _parse_table_rows(table_rows: List[List[str]]) -> List[Dict[str, Any]]:
    """
    Parse table rows into product objects
    """
    products = []
    sr_no_pattern = re.compile(r'^\s*(\d+)[.|)]?\s*')
    
    # Skip header rows - be more aggressive in detecting headers
    start_idx = 0
    header_keywords = [
        'sr.no', 'sl.no', 's.no', 'serial no', 'serial number',
        'item', 'description', 'product', 'quantity', 'qty', 'unit', 
        'rate', 'amount', 'price', 'value', 'total', 'subtotal',
        'specification', 'spec', 'make', 'model', 'brand', 'oem'
    ]
    
    # Check first few rows for headers (sometimes there are multiple header rows)
    for i in range(min(3, len(table_rows))):
        if i >= len(table_rows):
            break
        row_text = ' '.join([str(cell).lower() for cell in table_rows[i] if cell])
        # If this row contains multiple header keywords, it's likely a header
        keyword_count = sum(1 for keyword in header_keywords if keyword in row_text)
        if keyword_count >= 2:  # If 2+ header keywords found, it's a header row
            start_idx = i + 1
            logger.debug(f"   Skipping header row {i+1}: {table_rows[i]}")
        elif keyword_count == 1 and len(row_text.split()) <= 5:  # Short row with header keyword
            start_idx = i + 1
            logger.debug(f"   Skipping short header row {i+1}: {table_rows[i]}")
    
    for row_idx, row in enumerate(table_rows[start_idx:], start=start_idx):
        if not row or len(row) < 2:
            continue
        
        # Find product name - usually in column 1 or 2
        product_name = ""
        sr_no = str(len(products) + 1)
        quantity = "N/A"
        unit = "N/A"
        specifications = ""
        
        # Check first cell for serial number
        if row[0]:
            sr_match = sr_no_pattern.match(row[0])
            if sr_match:
                sr_no = sr_match.group(1)
                # Product name is likely in next cell
                if len(row) > 1:
                    product_name = row[1]
                else:
                    product_name = row[0][len(sr_match.group(0)):].strip()
            else:
                # First cell might be product name
                product_name = row[0]
        
        # If no product name yet, try second cell
        if not product_name and len(row) > 1:
            product_name = row[1]
        
        # STRICT VALIDATION: Skip if product name looks like a header, total, or invalid entry
        if not product_name:
            continue
            
        product_name_lower = product_name.lower().strip()
        
        # Skip headers and labels
        header_keywords = [
            'sr.no', 'sl.no', 's.no', 'serial no', 'serial number',
            'item', 'description', 'product', 'quantity', 'qty', 'unit', 
            'rate', 'amount', 'price', 'value', 'total', 'subtotal', 'sub total',
            'grand total', 'gross total', 'net total', 'sum', 'page', 'continued',
            'cont.', 'header', 'footer', 'note', 'notes', 'remark', 'remarks',
            'specification', 'spec', 'make', 'model', 'brand', 'oem', 'manufacturer',
            'category', 'type', 'variant', 'version', 'n/a', 'na', 'not applicable',
            'tbd', 'to be decided', 'miscellaneous', 'others', 'various', 'etc',
            'annexure', 'annexe', 'appendix', 'schedule', 'table', 'figure'
        ]
        
        # Check if product name is exactly a header keyword or contains it as a standalone word
        if product_name_lower in header_keywords:
            continue
        
        # Check if product name starts with or is just a header keyword
        if any(product_name_lower.startswith(kw + ' ') or product_name_lower == kw for kw in header_keywords):
            continue
        
        # Skip if too short (less than 3 characters)
        if len(product_name.strip()) < 3:
            continue
        
        # Skip if product name is just numbers or special characters
        if product_name.strip().replace('.', '').replace(',', '').replace('-', '').isdigit():
            continue
        
        # Skip if product name is just punctuation or whitespace
        if not any(c.isalnum() for c in product_name):
            continue
        
        # Look for quantity and unit in remaining cells
        for cell in row[2:]:
            if not cell:
                continue
            # Check if it's a number (quantity)
            if re.match(r'^\d+(\.\d+)?$', cell):
                quantity = cell
            # Check for units
            elif cell.lower() in ['nos', 'no', 'pcs', 'units', 'set', 'sets', 'meter', 'meters', 'kg', 'liter', 'ltr', 'each', 'ea']:
                unit = cell
            # Otherwise might be specification
            elif cell and len(cell) > 5:
                if specifications:
                    specifications += " | "
                specifications += cell
        
        # If no specifications found, use remaining cells
        if not specifications and len(row) > 2:
            specs_parts = [c for c in row[2:] if c and len(c) > 3]
            if specs_parts:
                specifications = " | ".join(specs_parts[:3])  # Limit to first 3 spec cells
        
        # FINAL VALIDATION: Ensure product name is meaningful
        # Product name should contain at least one letter (not just numbers/symbols)
        if not any(c.isalpha() for c in product_name):
            logger.debug(f"   Skipping row with non-alphabetic product name: {product_name}")
            continue
        
        # Product name should not be just common words
        common_words = ['the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'of', 'in', 'on', 'at', 'to']
        words = product_name_lower.split()
        if len(words) == 1 and words[0] in common_words:
            logger.debug(f"   Skipping row with common word as product name: {product_name}")
            continue
        
        # Create product
        model = product_name[:50] if product_name else "Standard Model"
        product = {
            "srNo": sr_no,
            "productName": product_name[:200].strip(),  # Limit length and strip whitespace
            "category": "Other",
            "specifications": specifications[:500].strip() if specifications else "",  # Limit length
            "quantity": quantity,
            "unit": unit,
            "oem": "Unspecified",
            "model": model.strip(),
            "miiStatus": "Pending Classification",
            "source": "fallback-extraction-table"
        }
        
        products.append(product)
    
    return products

def extract_products_from_text(document_text: str) -> List[Dict[str, Any]]:
    """
    Extract products from document text when AI fails
    Looks for BOQ/BOM tables and parses them
    """
    logger.info("🔧 Fallback: Attempting direct BOQ extraction from document text...")
    
    products = []
    
    # Strategy 0: Check if there are extracted tables in the text (from PDF table extraction)
    if "=== EXTRACTED TABLES ===" in document_text:
        logger.info("   Found extracted tables section - parsing tables first...")
        tables_section = document_text.split("=== EXTRACTED TABLES ===")[1]
        table_products = _extract_from_table_section(tables_section)
        if table_products:
            logger.info(f"   ✅ Extracted {len(table_products)} products from table section")
            products.extend(table_products)
            # Continue with other strategies to catch any missed products
    
    # Strategy 1: Look for table-like structures with | or tab delimiters
    lines = document_text.split('\n')
    
    # Find sections that might contain BOQ
    boq_section_starts = []
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in ['bill of quantities', 'boq', 'bom', 'bill of materials', 'schedule of items', 'item description', 'annexure', 'annexe', 'schedule', 'technical specifications', 'product list', 'items to be supplied', 'items to be procured', 'list of items', 'item list']):
            boq_section_starts.append(i)
            logger.info(f"   Found potential BOQ section at line {i}: {line[:80]}")
    
    if not boq_section_starts:
        logger.warning("   No BOQ section header found")
        # Try scanning entire document for table-like structures
        logger.info("   Attempting to find tables in entire document...")
        boq_section_starts = [0]
    
    # Extract table rows from all BOQ sections
    all_table_rows = []
    for boq_section_start in boq_section_starts[:5]:  # Check up to 5 sections (increased from 3)
        # Extract table rows from BOQ section (next 500 lines after header, increased from 300)
        table_section = lines[boq_section_start:min(boq_section_start + 500, len(lines))]
        
        # Look for rows with delimiters (| or multiple spaces/tabs)
        for line in table_section:
            # Check if line looks like a table row
            if '|' in line or '\t' in line or re.search(r'\s{3,}', line):
                # Skip empty or header-like rows
                if line.strip() and not all(c in '-=|+\t ' for c in line.strip()):
                    all_table_rows.append(line)
    
    if not all_table_rows:
        logger.warning("   No table rows found in any BOQ section")
        # Try a more aggressive approach - look for numbered lists
        logger.info("   Trying to find numbered item lists...")
        for line in lines:
            # Look for lines starting with numbers (potential product items)
            if re.match(r'^\s*\d+[\.)]\s+\w', line):
                all_table_rows.append(line)
    
    if not all_table_rows:
        logger.warning("   No table rows or numbered lists found")
        if products:  # If we got products from table section, return them
            return products
        return []
    
    logger.info(f"   Found {len(all_table_rows)} potential table rows")
    
    # Parse rows
    sr_no_pattern = re.compile(r'^\s*(\d+)[.|)]?\s*')  # Matches: "1.", "1)", "1 "
    
    for row in all_table_rows[:200]:  # Increased limit from 100 to 200
        # Try to extract product info
        row_clean = row.strip()
        
        # Split by | or tab
        if '|' in row_clean:
            cells = [c.strip() for c in row_clean.split('|') if c.strip()]
        elif '\t' in row_clean:
            cells = [c.strip() for c in row_clean.split('\t') if c.strip()]
        else:
            # Split by multiple spaces
            cells = [c.strip() for c in re.split(r'\s{2,}', row_clean) if c.strip()]
        
        if len(cells) < 2:
            continue
        
        # Check if first cell is a serial number
        sr_match = sr_no_pattern.match(cells[0])
        if sr_match:
            sr_no = sr_match.group(1)
            # Product name is usually the second cell or remainder of first cell
            product_name = cells[1] if len(cells) > 1 else cells[0][len(sr_match.group(0)):].strip()
        else:
            # No serial number, assume first cell is product name
            product_name = cells[0]
            sr_no = str(len(products) + 1)
        
        # STRICT VALIDATION: Skip if product name looks like a header, total, or invalid entry
        if not product_name:
            continue
            
        product_name_lower = product_name.lower().strip()
        
        # Skip headers and labels
        header_keywords = [
            'sr.no', 'sl.no', 's.no', 'serial no', 'serial number',
            'item', 'description', 'product', 'quantity', 'qty', 'unit', 
            'rate', 'amount', 'price', 'value', 'total', 'subtotal', 'sub total',
            'grand total', 'gross total', 'net total', 'sum', 'page', 'continued',
            'cont.', 'header', 'footer', 'note', 'notes', 'remark', 'remarks',
            'specification', 'spec', 'make', 'model', 'brand', 'oem', 'manufacturer',
            'category', 'type', 'variant', 'version', 'n/a', 'na', 'not applicable',
            'tbd', 'to be decided', 'miscellaneous', 'others', 'various', 'etc',
            'annexure', 'annexe', 'appendix', 'schedule', 'table', 'figure'
        ]
        
        # Check if product name is exactly a header keyword or contains it as a standalone word
        if product_name_lower in header_keywords:
            continue
        
        # Check if product name starts with or is just a header keyword
        if any(product_name_lower.startswith(kw + ' ') or product_name_lower == kw for kw in header_keywords):
            continue
        
        # Skip if too short (less than 3 characters)
        if len(product_name.strip()) < 3:
            continue
        
        # Skip if product name is just numbers or special characters
        if product_name.strip().replace('.', '').replace(',', '').replace('-', '').isdigit():
            continue
        
        # Skip if product name is just punctuation or whitespace
        if not any(c.isalnum() for c in product_name):
            continue
        
        # Extract quantity (look for numbers)
        quantity = "N/A"
        unit = "N/A"
        for cell in cells[1:]:
            # Check if cell is a number (quantity)
            if re.match(r'^\d+(\.\d+)?$', cell):
                quantity = cell
            # Check for units
            elif cell.lower() in ['nos', 'no', 'pcs', 'units', 'set', 'sets', 'meter', 'meters', 'kg', 'liter', 'ltr', 'each', 'ea']:
                unit = cell
        
        # FINAL VALIDATION: Ensure product name is meaningful
        # Product name should contain at least one letter (not just numbers/symbols)
        if not any(c.isalpha() for c in product_name):
            continue
        
        # Product name should not be just common words
        common_words = ['the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'of', 'in', 'on', 'at', 'to']
        words = product_name.lower().split()
        if len(words) == 1 and words[0] in common_words:
            continue
        
        # Create product object. Model = short name (productName or "Standard Model"), NOT specifications/dimensions.
        specifications = " | ".join(cells[2:6]) if len(cells) > 2 else ""  # Increased from 2:5 to 2:6
        model = (product_name[:50] if product_name else "Standard Model")
        product = {
            "srNo": sr_no,
            "productName": product_name[:200].strip(),  # Increased from 100 to 200, strip whitespace
            "category": "Other",  # Will be classified later
            "specifications": specifications[:500].strip() if specifications else "",  # Added limit and strip
            "quantity": quantity,
            "unit": unit,
            "oem": "Unspecified",
            "model": model.strip(),
            "miiStatus": "Pending Classification",
            "source": "fallback-extraction"
        }
        
        products.append(product)
    
    # Detect if this is a service RFP
    is_service = _is_service_rfp(document_text)
    if is_service:
        logger.info("   🔍 Detected SERVICE RFP - applying conservative extraction (max 10 top-level items)")
    
    # Final validation pass: Remove any invalid products that might have slipped through
    valid_products = []
    invalid_count = 0
    seen_products = set()  # For deduplication
    
    for product in products:
        product_name = product.get("productName", "").strip()
        
        # Skip if product name is empty or too short
        if not product_name or len(product_name) < 3:
            invalid_count += 1
            continue
        
        # Skip if product name is just numbers
        if product_name.replace('.', '').replace(',', '').replace('-', '').isdigit():
            invalid_count += 1
            continue
        
        # Skip if product name doesn't contain any letters
        if not any(c.isalpha() for c in product_name):
            invalid_count += 1
            continue
        
        # Skip if product name is a header keyword
        product_name_lower = product_name.lower()
        header_keywords = [
            'total', 'subtotal', 'grand total', 'gross total', 'net total',
            'page', 'continued', 'header', 'footer', 'n/a', 'na', 'not applicable',
            'item', 'description', 'product', 'quantity', 'unit', 'rate', 'amount'
        ]
        if product_name_lower in header_keywords:
            invalid_count += 1
            continue
        
        # For service RFPs: Only include top-level service items
        if is_service:
            if not _is_top_level_item(product_name, valid_products):
                invalid_count += 1
                continue
            # Limit to max 10 items for service RFPs
            if len(valid_products) >= 10:
                logger.info(f"   ⚠️ Service RFP limit reached (10 items) - stopping extraction")
                break
        
        # Deduplication: Skip if we've seen this exact product name before
        product_key = product_name_lower.strip()
        if product_key in seen_products:
            invalid_count += 1
            continue
        
        seen_products.add(product_key)
        valid_products.append(product)
    
    if invalid_count > 0:
        logger.info(f"   Filtered out {invalid_count} invalid/duplicate entries")
    
    logger.info(f"   ✅ Fallback extracted {len(valid_products)} valid products")
    if valid_products:
        logger.info(f"   Sample products:")
        for i, p in enumerate(valid_products[:5]):  # Show first 5
            logger.info(f"     {i+1}. {p.get('productName', 'N/A')} (Qty: {p.get('quantity', 'N/A')}, Unit: {p.get('unit', 'N/A')})")
    
    return valid_products


def enhance_analysis_with_fallback_products(analysis_data: Dict[str, Any], document_text: str) -> Dict[str, Any]:
    """
    Check if productMapping is empty and try fallback extraction if needed
    """
    if not analysis_data.get("productMapping"):
        logger.warning("⚠️ No productMapping in analysis data - creating it...")
        analysis_data["productMapping"] = {}
    
    product_mapping = analysis_data["productMapping"]
    current_products = product_mapping.get("miiProductStatus", [])
    
    if len(current_products) == 0:
        logger.info("🔄 AI extracted 0 products - trying fallback BOQ extraction...")
        logger.info(f"   Document text length: {len(document_text)} characters")
        
        # Check if document has table markers
        has_tables = "=== EXTRACTED TABLES ===" in document_text
        logger.info(f"   Has extracted tables: {has_tables}")
        
        fallback_products = extract_products_from_text(document_text)
        
        if fallback_products:
            logger.info(f"✅ Fallback extraction successful: {len(fallback_products)} products found")
            logger.info(f"   Sample products:")
            for i, p in enumerate(fallback_products[:3]):
                logger.info(f"     {i+1}. {p.get('productName', 'N/A')} (Qty: {p.get('quantity', 'N/A')}, Unit: {p.get('unit', 'N/A')})")
            
            product_mapping["miiProductStatus"] = fallback_products
            product_mapping["totalItems"] = len(fallback_products)
            product_mapping["extractionMethod"] = "fallback"
            analysis_data["productMapping"] = product_mapping
        else:
            logger.warning("⚠️ Fallback extraction also found 0 products")
            logger.warning("   Possible reasons:")
            logger.warning("   1. Document may not contain BOQ/BOM in text format")
            logger.warning("   2. Products may be in images/scanned pages")
            logger.warning("   3. Table structure may not be preserved")
            logger.warning("   4. Product list may use non-standard format")
            
            # Still initialize empty array to maintain structure
            product_mapping["miiProductStatus"] = []
            product_mapping["totalItems"] = 0
            product_mapping["extractionMethod"] = "none"
            analysis_data["productMapping"] = product_mapping
    else:
        logger.info(f"✅ AI already extracted {len(current_products)} products - skipping fallback")
    
    return analysis_data

