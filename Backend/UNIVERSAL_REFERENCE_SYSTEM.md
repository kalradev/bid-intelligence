# UNIVERSAL REFERENCE SYSTEM

## Overview

A deterministic, word-for-word reference system that works for ANY PDF document without hard-coding or semantic similarity.

## Core Principles

1. **NO embeddings, vector DBs, or semantic similarity** for reference linking
2. **NO paraphrasing** - references point to original text verbatim
3. **100% deterministic** matching

## Architecture

### 1. Page-by-Page Extraction (`Backend/services/pageByPageExtractor.js`)

Extracts text from PDFs page-by-page and stores atomic units (sentences, lines, bullet points).

**Features:**
- Uses Python script (`pdfPageExtractor.py`) for accurate page extraction (PyPDF2 or pdfminer)
- Falls back to Node.js method with intelligent page splitting
- Stores extracted data in JSON format for fast retrieval

**Storage:**
- Location: `Backend/data/pageTexts/{fileHash}.json`
- Format: `{ pageNumber, text, sentences[], wordCount }`

### 2. Exact Text Matching (`Backend/services/exactTextMatcher.js`)

Deterministic matching algorithm with three strategies:

**Strategy 1: Full Substring Match**
- Highest confidence (95%+ = 1.0)
- Checks if query is substring of sentence or vice versa

**Strategy 2: Phrase Overlap (>= 70% word overlap)**
- Combines word overlap (70%) + numeric pattern overlap (30%)
- Important for amounts, dates, percentages

**Strategy 3: Regex/Numeric Match**
- Matches using numbers, currency, percentages
- Requires >= 50% word overlap + all numeric patterns match

**Text Normalization:**
- Lowercase
- Collapse multiple spaces
- Keep: numbers, ₹ $ % . ,
- Remove other punctuation

### 3. API Endpoints (`Backend/routes/exactReferenceRoutes.js`)

**POST `/api/reference/exact-match`**
- Find single best exact match
- Returns: `{ matchedText, page, confidence, matchType }`

**POST `/api/reference/exact-matches`**
- Find all exact matches (up to maxResults)
- Returns: `{ references: [{ matchedText, page, confidence, matchType }] }`

### 4. Frontend Integration

**BidManagement.jsx:**
- Updated `handleGetSources` to use exact matching API first
- Falls back to semantic search if exact matching fails
- Converts exact matches to source format for display

**SourceReferenceModal.tsx:**
- Uses exact matched text for highlighting
- Opens PDF at exact page number
- Passes matched text for potential highlighting

## Usage Flow

1. **Document Upload:**
   - Document is analyzed via `/api/rfp/analyze`
   - For PDFs, page-by-page data is extracted and stored automatically

2. **Reference Request:**
   - User clicks "Reference" on a point
   - Frontend calls `/api/reference/exact-matches`
   - System finds exact matches using deterministic algorithm

3. **PDF Opening:**
   - User clicks page number in reference modal
   - PDF opens at exact page
   - Matched text is available for highlighting (requires custom viewer)

## Confidence Thresholds

- **>= 0.85**: Minimum confidence to return a reference
- **>= 0.95**: Considered exact match (confidence = 1.0)
- **0.85 - 0.95**: High confidence match (confidence = actual score)

## Highlighting (Future Enhancement)

Currently, PDF opens at exact page. Full highlighting requires:
- Custom PDF.js viewer component
- Coordinate mapping for text spans
- Highlight overlay rendering

The foundation is in place with `PDFViewerWithHighlight.tsx` component.

## Python Dependencies

For accurate page-by-page extraction, install:
```bash
pip install PyPDF2 pdfminer.six
```

The system will work without Python (using Node.js fallback), but Python extraction is more accurate.

## Testing

Test exact matching:
```bash
curl -X POST http://localhost:3000/api/reference/exact-match \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Tender Fee of ₹5000",
    "fileHash": "your-file-hash"
  }'
```

## Benefits

1. **Universal**: Works for ANY PDF document
2. **Deterministic**: Same query always returns same result
3. **Accurate**: Word-for-word matching, no semantic guessing
4. **Fast**: Pre-extracted page data, no vector search needed
5. **Transparent**: Confidence scores show match quality




