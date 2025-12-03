#!/usr/bin/env python3
"""
Deterministic PDF Table Extractor using tabula-py
Extracts exact table structure from PDF BOQ documents
"""

import sys
import json
import tabula
import pandas as pd
from pathlib import Path

def extract_tables_from_pdf(pdf_path):
    """
    Extract all tables from PDF
    Returns structured data with exact rows and columns
    """
    try:
        # Extract all tables from PDF
        # lattice=True for bordered tables, stream=True for borderless
        tables = tabula.read_pdf(
            pdf_path,
            pages='all',
            multiple_tables=True,
            lattice=True,
            stream=True,
            silent=True
        )
        
        if not tables or len(tables) == 0:
            return {
                'success': False,
                'error': 'No tables found in PDF',
                'tables': []
            }
        
        # Process each table
        processed_tables = []
        total_rows = 0
        
        for idx, table in enumerate(tables):
            if table is None or table.empty:
                continue
            
            # Convert DataFrame to list of lists
            # Reset index and convert to dict
            table_dict = table.to_dict('records')
            
            # Get headers
            headers = list(table.columns)
            
            # Get rows
            rows = []
            for record in table_dict:
                row = [str(record.get(col, '')).strip() for col in headers]
                # Filter out empty rows
                if any(cell for cell in row if cell and cell != 'nan'):
                    rows.append(row)
            
            if len(rows) > 0:
                processed_tables.append({
                    'tableIndex': idx,
                    'headers': headers,
                    'rows': rows,
                    'rowCount': len(rows)
                })
                total_rows += len(rows)
        
        return {
            'success': True,
            'tableCount': len(processed_tables),
            'totalRows': total_rows,
            'tables': processed_tables
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'tables': []
        }

def identify_boq_table(tables_data):
    """
    Identify which table is the BOQ based on headers
    """
    if not tables_data['success'] or not tables_data['tables']:
        return None
    
    boq_keywords = ['item', 'description', 'quantity', 'rate', 'amount', 'unit', 's.no', 'sr.no', 'boq', 'bom']
    
    best_match = None
    best_score = 0
    
    for table in tables_data['tables']:
        headers_text = ' '.join(table['headers']).lower()
        score = sum(1 for keyword in boq_keywords if keyword in headers_text)
        
        if score > best_score and table['rowCount'] > 5:  # At least 5 rows
            best_score = score
            best_match = table
    
    return best_match

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'No PDF path provided'
        }))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    # Check if file exists
    if not Path(pdf_path).exists():
        print(json.dumps({
            'success': False,
            'error': f'File not found: {pdf_path}'
        }))
        sys.exit(1)
    
    # Extract tables
    result = extract_tables_from_pdf(pdf_path)
    
    if result['success']:
        # Identify BOQ table
        boq_table = identify_boq_table(result)
        
        if boq_table:
            output = {
                'success': True,
                'method': 'tabula-deterministic',
                'rowCount': boq_table['rowCount'],
                'headers': boq_table['headers'],
                'rows': boq_table['rows'],
                'metadata': {
                    'totalTablesFound': result['tableCount'],
                    'totalRowsAllTables': result['totalRows']
                }
            }
        else:
            # Return all tables if no clear BOQ found
            all_rows = []
            all_headers = []
            for table in result['tables']:
                if not all_headers:
                    all_headers = table['headers']
                all_rows.extend(table['rows'])
            
            output = {
                'success': True if all_rows else False,
                'method': 'tabula-deterministic-merged',
                'rowCount': len(all_rows),
                'headers': all_headers,
                'rows': all_rows,
                'metadata': {
                    'totalTablesFound': result['tableCount'],
                    'merged': True
                }
            }
    else:
        output = result
    
    # Output JSON to stdout
    print(json.dumps(output, ensure_ascii=False))

