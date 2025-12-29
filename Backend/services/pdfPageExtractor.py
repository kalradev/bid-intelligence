"""
UNIVERSAL PAGE-BY-PAGE PDF TEXT EXTRACTION
Works for ANY PDF document - deterministic, no embeddings
"""

import sys
import json
import re
from pathlib import Path

try:
    import PyPDF2
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False

try:
    from pdfminer.high_level import extract_pages
    from pdfminer.layout import LTTextContainer
    HAS_PDFMINER = True
except ImportError:
    HAS_PDFMINER = False

def extract_atomic_units(text):
    """Extract sentences, lines, bullet points from text"""
    if not text:
        return []
    
    units = []
    
    # Split by sentence endings
    sentences = re.split(r'[.!?]\s+', text)
    
    # Split by line breaks
    lines = text.split('\n')
    
    # Combine and deduplicate
    all_units = sentences + lines
    seen = set()
    
    for unit in all_units:
        trimmed = unit.strip()
        if len(trimmed) >= 10 and len(trimmed) <= 500 and trimmed not in seen:
            seen.add(trimmed)
            units.append(trimmed)
    
    return units

def extract_pages_pypdf2(pdf_path):
    """Extract pages using PyPDF2"""
    page_data = []
    
    with open(pdf_path, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)
        total_pages = len(pdf_reader.pages)
        
        for i in range(total_pages):
            try:
                page = pdf_reader.pages[i]
                page_text = page.extract_text()
                
                if page_text and page_text.strip():
                    sentences = extract_atomic_units(page_text)
                    page_data.append({
                        'pageNumber': i + 1,
                        'text': page_text,
                        'sentences': sentences,
                        'wordCount': len(page_text.split())
                    })
            except Exception as e:
                print(f"Warning: Error extracting page {i+1}: {e}", file=sys.stderr)
                continue
    
    return page_data

def extract_pages_pdfminer(pdf_path):
    """Extract pages using pdfminer (more accurate)"""
    page_data = []
    page_num = 0
    
    for page_layout in extract_pages(pdf_path):
        page_num += 1
        page_text = ""
        
        for element in page_layout:
            if isinstance(element, LTTextContainer):
                page_text += element.get_text()
        
        if page_text and page_text.strip():
            sentences = extract_atomic_units(page_text)
            page_data.append({
                'pageNumber': page_num,
                'text': page_text,
                'sentences': sentences,
                'wordCount': len(page_text.split())
            })
    
    return page_data

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'PDF path required'}), file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not Path(pdf_path).exists():
        print(json.dumps({'error': f'PDF file not found: {pdf_path}'}), file=sys.stderr)
        sys.exit(1)
    
    try:
        # Try pdfminer first (more accurate), then PyPDF2
        if HAS_PDFMINER:
            page_data = extract_pages_pdfminer(pdf_path)
        elif HAS_PYPDF2:
            page_data = extract_pages_pypdf2(pdf_path)
        else:
            print(json.dumps({'error': 'No PDF library available. Install pdfminer.six or PyPDF2'}), file=sys.stderr)
            sys.exit(1)
        
        result = {
            'success': True,
            'totalPages': len(page_data),
            'pages': page_data
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()




