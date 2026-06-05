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
        r'^[A-Z\s,]+:?\s*[\.\_\-]{3,}',  # "SECTION NAME: ..."
        r'^[A-Z\s,]+\([A-Z\s,]+\)',  # "SECTION (SUBSECTION)"
        r'^(GENERAL|PARTICULARS|REQUEST|SCOPE|SERVICE|SPECIAL|AUDIT|FORCE|ITIL|TICKETING|EXIT|CONTRACT|PAYMENT|WARRANTY|PENALTY)',  # Common section names
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


def is_ministry_state_or_eligibility_row(text: str) -> bool:
    """Skip rows from ministry/state lists, eligibility tables, department lists - NOT products."""
    if not text or len(text) < 2:
        return False
    t = text.strip().lower()
    # Header or label for ministry/state/department tables
    if re.search(r'ministry|state\s*name|department\s*name|office\s*name|location\s*name', t):
        return True
    if re.search(r'eligibility|qualification\s*criteria|pre-qualification', t) and len(t) < 80:
        return True
    # Common non-product table headers
    if re.search(r'^(sr|s\.?no|sl\.?no)[.\s]*$', t) and len(t) < 15:
        return True
    # Row that looks like "Ministry of X" or "State Name" or just a ministry/state name
    if re.match(r'^(ministry|department|state|office)\s+(of|name)?', t):
        return True
    return False

def looks_like_product(text: str, from_table_row: bool = False) -> bool:
    """Check if text looks like an actual product name. If from_table_row, accept more generic names."""
    if not text or len(text) < 3:
        return False
    text_stripped = text.strip()
    if len(text_stripped) > 300:
        return False

    product_indicators = [
        r'[A-Z]{2,}\d+',
        r'\d+\s*(gb|tb|mb|ghz|mhz|w|v|amp|ah|core|cores|ram|ssd|hdd)',
        r'(server|switch|router|firewall|sensor|device|equipment|system|software|license|subscription|module)',
        r'(platform|solution|management|interface|gateway|controller|appliance|application|tool|utility)',
        r'(security|network|cloud|storage|backup|recovery|monitoring|analytical|intelligence|analytics)',
        r'(laptop|desktop|tablet|monitor|printer|scanner|camera|workstation|handset|terminal)',
        r'(processor|memory|storage|hardware|component|peripheral|accessory|cable|connector)',
        r'\b(siem|soar|itsm|tip|dast|sast|iam|pam|endpoint|antivirus|edr|xdr|vulnerability|scanner|gsoc)\b',
        r'(computer|pc|ac|air\s*conditioner|ups|projector|furniture|chair|table|cabinet)',
        r'(item|product|goods|material|equipment|machine|unit)\b',
        r'(\d+(?:st|nd|rd|th)\s*year\s*(?:camc|amc)\s*rate|\b(?:camc|amc)\s*rate\b)',  # BOQ rate line items
    ]
    indicator_count = sum(1 for pattern in product_indicators if re.search(pattern, text_stripped, re.IGNORECASE))
    if indicator_count > 0:
        return True
    # In table context, accept short descriptive names (e.g. "Laptop", "Printer")
    if from_table_row and 3 <= len(text_stripped) <= 120:
        return True
    if len(text_stripped) < 10:
        return False
    return True


# PDF unicode artifacts and label fragments to strip from product names
_CID_PATTERN = re.compile(r'\(cid:\d+\)', re.IGNORECASE)
_LABEL_ARTIFACTS = re.compile(
    r'^(?:dd|वस्तु\s*श्रेणी|item\s*category|product\s*category)[\s\/]*',
    re.IGNORECASE
)


def clean_product_name(name: str) -> str:
    """Remove PDF (cid:XX) artifacts and label fragments from product names."""
    if not name or not isinstance(name, str):
        return name
    s = _CID_PATTERN.sub('', name)
    s = _LABEL_ARTIFACTS.sub('', s)
    s = re.sub(r'[\s\/]+$', '', s)
    s = re.sub(r'^\s+', '', s)
    # If still starting with garbage (non-letter), take from first letter (e.g. ".../ Monitors" -> "Monitors")
    if s:
        for i, c in enumerate(s):
            if c.isalpha():
                s = s[i:].strip()
                break
    return s[:100].strip() if s else name


def _is_garbled_or_non_product_token(name: str) -> bool:
    """Reject obvious header/garbled tokens from Item Category extraction."""
    if not name or not name.strip():
        return True
    n = name.strip()
    lower = n.lower()
    if lower in {"bid details", "item category", "product category", "details", "category"}:
        return True
    # Repeated-char artifact like "बबडड ववववररणण"
    if len(n) >= 4:
        pairs = [n[i:i + 2] for i in range(0, len(n) - 1, 2)]
        if pairs:
            repeated = sum(1 for p in pairs if len(p) == 2 and p[0] == p[1])
            if repeated >= len(pairs) * 0.5:
                return True
    return False


# GeM / form-style "Item Category" field: one line with comma/semicolon-separated product types
# Include corrupted PDF Hindi (ववरातु, णेणे) and plain "category" / "item"
_ITEM_CATEGORY_LABELS = re.compile(
    r'(?:item\s+category|product\s+category|वस्तु\s*श्रेणी|item\s*category\s*\/|product\s*type|'
    r'ववरातु|णेणे|श्रेणी|category\s*\/)',
    re.IGNORECASE
)
# Known product-type words (GeM / IT hardware) – accept these as product names
_KNOWN_PRODUCT_TYPES = {
    'computers', 'computer', 'ups', 'upss', 'printers', 'printer', 'mfms', 'mfm',
    'scanners', 'scanner', 'servers', 'server', 'switches', 'switch', 'laptops', 'laptop',
    'monitors', 'monitor', 'routers', 'router', 'storage', 'workstation', 'workstations',
    'projectors', 'projector', 'cables', 'cable', 'keyboards', 'keyboard', 'mice', 'mouse',
}
# Known brands – skip when they appear as standalone tokens (avoid "HP" as a product)
_KNOWN_BRANDS = {
    'hp', 'dell', 'compaq', 'lenovo', 'tyrone', 'canon', 'apc', 'luminous', 'microtek',
    'samtek', 'asia power', 'solus', 'bpe', 'datex', 'educomp', 'everon', 'eln', 'ibm',
    'cisco', 'hcl', 'acer', 'asus', 'lenovo', 'wipro',
}


def extract_products_from_item_category_field(document_text: str) -> List[Dict[str, Any]]:
    """
    Extract products from GeM-style 'Item Category' / 'वस्तु श्रेणी' field:
    single line with comma/semicolon-separated product types (e.g. Computers, UPSs, Printers).
    """
    if not document_text or len(document_text.strip()) < 10:
        return []
    lines = document_text.split('\n')
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if not _ITEM_CATEGORY_LABELS.search(line_stripped):
            continue
        # Take this line and optionally next line (value can wrap)
        value = line_stripped
        for sep in [':', '/']:
            if sep in value:
                parts = value.split(sep, 1)
                if len(parts) == 2 and parts[0].strip() and _ITEM_CATEGORY_LABELS.search(parts[0]):
                    value = parts[1].strip()
                    break
        if not value or len(value) < 3:
            if i + 1 < len(lines):
                value = lines[i + 1].strip()
            else:
                continue
        # If value still starts with the label (e.g. "Item Category Computers, ..."), strip the label
        value = _ITEM_CATEGORY_LABELS.sub('', value).strip()
        if not value or len(value) < 3:
            continue
        # Remove leading descriptive phrase (e.g. "Customized AMC/CMC for Pre-owned Products - ")
        value = re.sub(r'^[^,;]{10,}?\s*-\s*', '', value, count=1)
        # Split by comma and semicolon only so product list is not broken
        raw_tokens = re.split(r'[,;]', value)
        seen = set()
        products = []
        for idx, token in enumerate(raw_tokens):
            t = token.strip().strip('.;')
            if not t or len(t) < 2 or len(t) > 80:
                continue
            t_lower = t.lower()
            if t_lower in _KNOWN_BRANDS:
                continue
            if t_lower in seen:
                continue
            if re.match(r'^\d+$', t):
                continue
            if re.search(r'\b(amc|cmc|customized|pre-owned|products?)\b', t_lower) and len(t) > 25:
                continue
            known = t_lower in _KNOWN_PRODUCT_TYPES or any(t_lower.startswith(p) for p in _KNOWN_PRODUCT_TYPES)
            if known or looks_like_product(t, from_table_row=True):
                seen.add(t_lower)
                name = t.strip().title() if len(t) < 50 else t.strip()
                name = clean_product_name(name)
                if not name or _is_garbled_or_non_product_token(name):
                    continue
                products.append({
                    "srNo": str(len(products) + 1),
                    "productName": name[:100],
                    "category": "Hardware",
                    "specifications": "",
                    "quantity": "N/A",
                    "unit": "N/A",
                    "oem": "Unspecified",
                    "model": "N/A",
                    "miiStatus": "Pending Classification",
                    "source": "fallback-item-category",
                })
        if products:
            logger.info(f"   ✅ Item Category field: extracted {len(products)} products (GeM-style)")
            return products

    # Fallback: scan document for a block containing multiple known product types (no label needed)
    return _extract_products_by_known_types_scan(document_text)


def _extract_products_by_known_types_scan(document_text: str) -> List[Dict[str, Any]]:
    """
    Find a segment of text that lists several known product types (Computers, UPSs, Printers, etc.)
    and extract all of them. Works when the Item Category label is missing or corrupted in PDF.
    """
    if not document_text or len(document_text) < 20:
        return []
    text_lower = document_text.lower()
    # Sliding window: find ~800-char block with most known product-type hits
    window_size = 800
    step = 400
    best_start = -1
    best_count = 0
    for start in range(0, max(1, len(document_text) - window_size), step):
        end = min(start + window_size, len(document_text))
        window = text_lower[start:end]
        count = sum(1 for p in _KNOWN_PRODUCT_TYPES if p in window)
        if count > best_count and count >= 3:
            best_count = count
            best_start = start
    if best_start < 0 or best_count < 3:
        return []
    block = document_text[best_start:best_start + window_size]
    # Split by comma, semicolon, newline
    raw_tokens = re.split(r'[,;\n]', block)
    seen = set()
    products = []
    for t in raw_tokens:
        t = t.strip().strip('.;')
        if not t or len(t) < 2 or len(t) > 80:
            continue
        t_lower = t.lower()
        if t_lower in _KNOWN_BRANDS:
            continue
        if t_lower in seen:
            continue
        if re.match(r'^\d+$', t):
            continue
        if re.search(r'\b(amc|cmc|customized|pre-owned|products?)\b', t_lower) and len(t) > 25:
            continue
        known = t_lower in _KNOWN_PRODUCT_TYPES or any(t_lower.startswith(p) for p in _KNOWN_PRODUCT_TYPES)
        if known or looks_like_product(t, from_table_row=True):
            seen.add(t_lower)
            name = t.strip().title() if len(t) < 50 else t.strip()
            name = clean_product_name(name)
            if not name or _is_garbled_or_non_product_token(name):
                continue
            products.append({
                "srNo": str(len(products) + 1),
                "productName": name[:100],
                "category": "Hardware",
                "specifications": "",
                "quantity": "N/A",
                "unit": "N/A",
                "oem": "Unspecified",
                "model": "N/A",
                "miiStatus": "Pending Classification",
                "source": "fallback-item-category-scan",
            })
    if products:
        logger.info(f"   ✅ Known-types scan: extracted {len(products)} products (GeM-style, no label)")
    return products


def extract_products_from_text(document_text: str) -> List[Dict[str, Any]]:
    """
    Extract products from document text when AI fails
    Tries GeM-style Item Category field first, then BOQ/BOM tables with STRICT validation
    """
    logger.info("🔧 Fallback: Attempting direct BOQ extraction from document text...")

    # GeM / form-style: single "Item Category" field with comma-separated product types
    item_category_products = extract_products_from_item_category_field(document_text)
    if item_category_products:
        return item_category_products

    products = []
    lines = document_text.split('\n')
    
    # Find BOQ sections - only sections that are clearly item/product/goods lists, NOT ministry/state/eligibility
    boq_section_starts = []
    non_boq_section_patterns = [
        r'ministry|state\s*name|department\s*list|office\s*list|list\s+of\s+(ministries|states|offices|departments|locations)',
        r'eligibility|qualification\s*criteria|pre-qualification|post-qualification',
        r'list\s+of\s+bidders|contractors|vendors',
    ]
    boq_patterns = [
        r'bill\s+of\s+(quantities|materials|qty|quantity)|bill\s+of\s+quantity|bill\s+of\s+supply',
        r'\bboq\b', r'\bbom\b',
        r'schedule\s+of\s+(items|supply|products|materials)',
        r'list\s+of\s+(items|products|materials|equipment|goods)',
        r'item\s+list|product\s+(list|schedule|catalog)',
        r'description\s+of\s+(items|goods|products)',
        r'annexure\s+(ii|iii|iv|v|2|3|4|5|\d+).*?(item|product|quantity|supply|boq)',
        r'schedule\s+[a-z]*\s*[-\s]*\s*(i|ii|iii|iv|v|\d+).*?(item|product|quantity)',
    ]
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        if any(re.search(p, line_lower) for p in non_boq_section_patterns):
            continue
        for pat in boq_patterns:
            if re.search(pat, line_lower):
                boq_section_starts.append(i)
                logger.info(f"   Found potential BOQ section at line {i}: {line[:80]}")
                break
    
    # Fallback: look for annexure/schedule that has item/product/quantity nearby (next few lines)
    if not boq_section_starts:
        for i, line in enumerate(lines):
            if re.search(r'annexure|schedule', line.lower()):
                context = " ".join(lines[i:min(i + 5, len(lines))]).lower()
                if re.search(r'item|product|quantity|description|rate|amount', context):
                    if not any(re.search(p, line.lower()) for p in non_boq_section_patterns):
                        boq_section_starts.append(i)
                        if len(boq_section_starts) >= 5:
                            break
    
    if not boq_section_starts:
        logger.warning("   No BOQ section found - searching entire document for tables...")
        boq_section_starts = [0]
    
    # Extract table rows from BOQ sections: pipe/tab-delimited or space-separated columns
    all_table_rows = []
    for boq_section_start in boq_section_starts[:10]:  # Check up to 10 sections
        table_section = lines[boq_section_start:min(boq_section_start + 500, len(lines))]
        for line in table_section:
            line_clean = line.strip()
            if not line_clean or all(c in '-=|+\t ' for c in line_clean):
                continue
            # Rows with | or tab (from PDF table extraction or Excel)
            if '|' in line_clean or '\t' in line_clean:
                all_table_rows.append(line_clean)
                continue
            # Space-separated columns: e.g. "1  Laptop Computer  5  Nos" (2+ spaces between fields)
            parts = re.split(r'\s{2,}', line_clean)
            if len(parts) >= 2 and any(len(p) > 2 for p in parts):
                # Rejoin with | so downstream parsing treats as table row
                all_table_rows.append(" | ".join(p.strip() for p in parts if p.strip()))
    
    if not all_table_rows:
        logger.warning("   No table rows found in BOQ sections")
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
        
        if is_ministry_state_or_eligibility_row(row_clean):
            skipped_count += 1
            logger.debug(f"   ⏭️ Skipped ministry/state/eligibility row: {row_clean[:60]}...")
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
                cells = [c.strip() for c in re.split(r'\s{2,}', remaining_text) if c.strip()]
            
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
        
        # Validation: allow short names in table context (GeM, BOQ often have "Laptop", "Printer")
        from_table_row = len(cells) >= 2 or quantity != "N/A"
        if len(product_name) < 3 or len(product_name) > 150:
            skipped_count += 1
            continue
        if is_section_header(product_name):
            skipped_count += 1
            continue
        if re.match(r'^[\.\_\-]{3,}$', product_name):
            skipped_count += 1
            continue
        if product_name.isupper() and len(product_name) > 15:
            skipped_count += 1
            continue
        if is_date_or_time(product_name):
            skipped_count += 1
            continue
        if is_instruction_or_guideline(product_name):
            skipped_count += 1
            continue
        if not looks_like_product(product_name, from_table_row=from_table_row):
            skipped_count += 1
            continue
        
        if is_ministry_state_or_eligibility_row(product_name):
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
    Check if productMapping is empty or incomplete; try Item Category and fallback BOQ extraction.
    When the document has an Item Category field with more products than the AI found, use it.
    """
    if not analysis_data.get("productMapping"):
        logger.warning("No productMapping in analysis data")
        return analysis_data

    product_mapping = analysis_data["productMapping"]
    current_products = product_mapping.get("miiProductStatus", [])

    # Always try Item Category (GeM-style): if it yields more products, prefer it
    item_category_products = extract_products_from_item_category_field(document_text)
    if item_category_products and len(item_category_products) > len(current_products):
        logger.info(f"🔄 Item Category has {len(item_category_products)} products > AI {len(current_products)} - using Item Category list")
        product_mapping["miiProductStatus"] = item_category_products
        product_mapping["totalItems"] = len(item_category_products)
        product_mapping["extractionMethod"] = "fallback-item-category"
        analysis_data["productMapping"] = product_mapping
        _clean_all_product_names(product_mapping)
        return analysis_data

    if len(current_products) == 0:
        logger.info("🔄 AI extracted 0 products - trying fallback BOQ extraction...")
        fallback_products = extract_products_from_text(document_text)

        if fallback_products:
            logger.info(f"✅ Fallback extraction successful: {len(fallback_products)} products found")
            product_mapping["miiProductStatus"] = fallback_products
            product_mapping["totalItems"] = len(fallback_products)
            product_mapping["extractionMethod"] = "fallback"
            analysis_data["productMapping"] = product_mapping
            _clean_all_product_names(product_mapping)
        else:
            logger.warning("⚠️ Fallback extraction also found 0 products")
    else:
        # Clean existing product names (remove PDF cid: and label artifacts)
        _clean_all_product_names(product_mapping)

    return analysis_data


def _clean_all_product_names(product_mapping: Dict[str, Any]) -> None:
    """Clean productName for all entries in miiProductStatus (in-place)."""
    products = product_mapping.get("miiProductStatus") or []
    for p in products:
        if p.get("productName"):
            p["productName"] = clean_product_name(p["productName"])

