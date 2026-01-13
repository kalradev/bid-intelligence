# OEM Enrichment System - User Guide

## Overview

The OEM Enrichment System automatically identifies Original Equipment Manufacturers (OEMs) for products in tender documents and verifies their MII (Make In India) compliance status using web search and AI.

## Features

✅ **Comprehensive MII Database**: 500+ Indian and Global OEMs across all industries
✅ **Web Search Integration**: Automatic OEM lookup using SERP API or DuckDuckGo
✅ **MII Verification**: Automatic classification of Indian vs Global OEMs
✅ **Category-based Suggestions**: Intelligent OEM suggestions based on product categories
✅ **Confidence Scoring**: Each enrichment includes a confidence score (0-100%)
✅ **Real-time Processing**: Enriches all products in seconds

## How It Works

### 1. Initial Document Analysis
When you upload a tender document, the system:
- Extracts all products from BOQ/BOM
- Searches for brand names in the document
- Classifies known OEMs from our database
- Marks unknown products as "Unspecified"

### 2. OEM Enrichment (Click "Enrich OEMs" Button)
For products marked as "Unspecified", the system:
1. Searches for the product online using web search APIs
2. Extracts brand/manufacturer names from search results
3. Matches against our comprehensive OEM database (500+ brands)
4. Classifies as Indian OEM, Global OEM, or requires manual review
5. Assigns confidence scores based on data source quality

### 3. MII Classification
Each product is classified into one of these categories:

- **Indian OEM**: Confirmed Indian manufacturer (e.g., Havells, Polycab, Voltas)
- **Global OEM**: Confirmed foreign manufacturer (e.g., Siemens, Cisco, Dell)
- **MII-Compliant**: Explicitly mentioned as Make In India compliant
- **Likely Indian**: Inferred as Indian (e.g., local construction materials)
- **Requires Review**: Could not be confidently classified

## Using the System

### Method 1: From Product Mapping Page
1. Upload and analyze a tender document
2. Navigate to "Product Mapping" page
3. Click **"Enrich OEMs"** button (green button with search icon)
4. Wait for enrichment to complete (shows progress)
5. View enrichment statistics in popup
6. Review updated product table with new OEM information

### Method 2: From Global Intelligence Page
1. Navigate to "Global Intelligence" page
2. Click **"Enrich OEMs"** button in the header
3. Wait for processing
4. View enriched data with filters (Country, MII Status)

## Configuration

### Environment Variables (.env)

```env
# Optional: SERP API for enhanced web search
SERP_API_KEY=your_serpapi_key_here

# Required: Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
```

### Using SERP API (Optional but Recommended)
For better enrichment accuracy, sign up for a free SERP API account:

1. Visit https://serpapi.com
2. Sign up for free tier (100 searches/month)
3. Copy your API key
4. Add to `.env` file: `SERP_API_KEY=your_key`
5. Restart backend server

**Without SERP API**: System uses DuckDuckGo API (free, no API key required, lower accuracy)

## MII Database Coverage

### Indian OEMs (300+ Companies)
- **Electrical**: Havells, Polycab, Anchor, Finolex, KEI, V-Guard, Crompton, Bajaj Electricals, etc.
- **IT**: HCL, Wipro, Infosys, TCS, QuickHeal, eScan, Matrix, etc.
- **HVAC**: Voltas, Blue Star, Lloyd, Symphony, Godrej, etc.
- **Construction**: UltraTech, ACC, Ambuja, JK Cement, Asian Paints, JSW Steel, Tata Steel, etc.
- **Automotive**: Tata Motors, Mahindra, Bajaj Auto, TVS, Hero MotoCorp, etc.
- **Solar**: Tata Power Solar, Adani Solar, Vikram Solar, Waaree, etc.
- **Defense**: HAL, BEL, BEML, BDL, L&T Defence, etc.
- **Medical**: BPL Medical, Trivitron, Wipro GE Healthcare, etc.

### Global OEMs (200+ Companies)
- **IT**: Microsoft, Apple, Dell, HP, Lenovo, IBM, Oracle, Cisco, etc.
- **Electrical**: Siemens, Schneider, ABB, Honeywell, Legrand, etc.
- **HVAC**: Daikin, Carrier, Trane, Mitsubishi, LG, Samsung, etc.
- **Networking**: Cisco, Juniper, Palo Alto, Fortinet, etc.
- **Medical**: GE Healthcare, Siemens Healthineers, Philips, Medtronic, etc.

## Enrichment Statistics

After enrichment, you'll receive:
- **Total Products**: Number of products processed
- **Enriched Count**: Successfully enriched products
- **Indian OEMs**: Count of Indian manufacturers
- **Global OEMs**: Count of foreign manufacturers
- **Unspecified**: Products still requiring manual review
- **MII Compliance**: Percentage of Indian OEMs
- **Avg Confidence**: Average confidence score (0-100%)

## Confidence Scores

| Score Range | Source | Reliability |
|------------|--------|-------------|
| 90-100% | Found in SERP API + Database Match | Very High |
| 70-89% | Found in DuckDuckGo + Database Match | High |
| 50-69% | Extracted from Product Name | Medium |
| 30-49% | Category-based Suggestion | Low |
| 0-29% | Not Found / Unspecified | Very Low |

## Best Practices

1. **Review Low Confidence Items**: Always manually verify products with confidence < 50%
2. **Update Database**: If you find missing OEMs, add them to `Backend/data/miiDatabase.js`
3. **Re-run Enrichment**: You can click "Enrich OEMs" multiple times to improve results
4. **Use SERP API**: For production use, enable SERP API for better accuracy
5. **Check Categories**: Ensure product categories are correctly classified for better suggestions

## Troubleshooting

### "Backend server not running" Error
**Solution**: 
```bash
cd Backend
npm install
npm start
```

### Low Enrichment Rate
**Possible Causes**:
- Products have very generic names (e.g., "Cable", "Wire")
- No SERP API key configured
- Internet connection issues

**Solutions**:
- Configure SERP API key for better results
- Check product names in document are descriptive
- Manually review and update unspecified items

### "Unspecified" Still Shows After Enrichment
**Reasons**:
- Product name too generic to identify manufacturer
- Not found in web search results
- Not in our OEM database

**Solutions**:
- Manually add OEM information in the database
- Check if product has alternate names/brands
- Review original tender document for brand specifications

## API Endpoints

### POST `/api/rfp/enrich-oems`
Enriches products with OEM information

**Request Body**:
```json
{
  "products": [
    {
      "productName": "Server",
      "category": "IT Hardware",
      "oem": "Unspecified",
      "miiStatus": "Requires Review"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "products": [...],
    "stats": {
      "total": 100,
      "enriched": 85,
      "indianOEMs": 45,
      "globalOEMs": 40,
      "unspecified": 15,
      "avgConfidence": 78,
      "enrichmentRate": "85%",
      "miiCompliance": "45%"
    }
  }
}
```

## Database Updates

To add new OEMs to the database:

1. Open `Backend/data/miiDatabase.js`
2. Add company name to appropriate category array:
   - `indianOEMs.<category>` for Indian companies
   - `globalOEMs.<category>` for Global companies
3. Restart backend server
4. Re-run enrichment

Example:
```javascript
electrical: [
    'Havells', 
    'Polycab', 
    'Your New Company Name', // Add here
    ...
],
```

## Performance

- **Processing Speed**: ~2-3 products/second
- **Rate Limiting**: 500ms delay between searches
- **Batch Size**: Unlimited (processes all products)
- **Memory Usage**: Low (~50MB for 1000 products)

## Support & Enhancement Requests

For issues or feature requests:
1. Check this guide first
2. Review error messages in browser console (F12)
3. Check backend logs
4. Add new OEMs to database as needed

## Version History

- **v1.0** (Current): Initial release with web search integration
  - 500+ OEMs in database
  - SERP API and DuckDuckGo support
  - Automatic MII classification
  - Confidence scoring

