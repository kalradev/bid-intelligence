# 🤖 Cybersecurity Product OEM Identification Agent

## 📋 Overview

**Purpose:** Automatically identify OEM manufacturers for products with missing or unspecified OEM information.

**Features:**
- ✅ Suggests 2-3 possible OEM manufacturers for each product
- ✅ Returns **strict JSON format only** (no extra text)
- ✅ Includes confidence levels (high/medium/low)
- ✅ Supports both **Indian** and **Global** OEMs
- ✅ Skip products that already have valid OEMs
- ✅ Zero hallucination - uses real OEM database

---

## 🎯 Agent Goals

### **Primary Goal:**
For every product in the provided list, identify OEM (manufacturer) names if they are missing or marked as `Unspecified` / `N/A`.

### **Data Sources:**
1. **Keyword Matching** - Analyzes product names for OEM-specific keywords
2. **Category Database** - Uses MII database for category-based suggestions
3. **Global Knowledge** - Includes worldwide vendors (Indian + Global)

---

## 📊 Output Format

### **Strict JSON Only:**

```json
[
  {
    "productName": "Server Workload Protection Solution",
    "suggestedOEMs": [
      { "oem": "Check Point", "country": "Global" },
      { "oem": "Trend Micro", "country": "Global" },
      { "oem": "Symantec", "country": "Global" }
    ],
    "confidence": "high"
  },
  {
    "productName": "Digital Forensic Suite",
    "suggestedOEMs": [
      { "oem": "EnCase", "country": "Global" },
      { "oem": "FTK", "country": "Global" }
    ],
    "confidence": "medium"
  },
  {
    "productName": "Unknown Product",
    "suggestedOEMs": [],
    "confidence": "low"
  }
]
```

**Rules:**
- ✅ Return ONLY JSON, no explanation or natural language outside the JSON
- ✅ If multiple products require OEM suggestions, include each as a separate JSON object in the array
- ✅ Do not include trailing commas
- ✅ If absolutely no OEM can be found, return `suggestedOEMs: []` with `confidence: "low"`

---

## 🔍 Agent Logic

### **Step 1: Filter Products Needing OEMs**

```javascript
// Skip products with valid OEMs
if (currentOEM === 'Unspecified' || currentOEM === 'N/A' || currentOEM === '') {
    // Needs OEM identification
}
```

### **Step 2: Keyword Analysis**

Product name is analyzed for specific keywords:

| Keywords | Suggested OEMs | Country |
|----------|----------------|---------|
| `firewall`, `ngfw` | Fortinet, Palo Alto, Check Point | Global |
| `endpoint`, `antivirus`, `edr` | QuickHeal, K7 Computing, Trend Micro | Indian + Global |
| `dlp`, `data loss` | Symantec DLP, McAfee DLP, Forcepoint | Global |
| `siem`, `log`, `analyzer` | Splunk, IBM QRadar, LogRhythm | Global |
| `switch` | Cisco Catalyst, HPE Aruba, Juniper | Global |
| `server` | Dell PowerEdge, HP ProLiant, Lenovo | Global |
| `incident`, `response` | Tata Projects, HCL, IBM Services | Indian + Global |

### **Step 3: Category Fallback**

If no keywords match, use category database:

```javascript
// Prefer Indian OEMs first (for MII compliance)
1. categoryOEMs.indian (first 2)
2. categoryOEMs.global (to make 3 total)
3. Absolute fallback: ['Cisco', 'IBM', 'HPE']
```

### **Step 4: Confidence Calculation**

```javascript
if (suggestions.length >= 3 && hasIndianOEM) {
    return 'high';
} else if (suggestions.length >= 2) {
    return 'medium';
} else {
    return 'low';
}
```

---

## 💻 Usage

### **Method 1: Integration with Main Service**

```javascript
const { identifyMissingOEMs } = require('./services/oemAgentService');

// In your enrichment function:
const products = [
    { productName: 'Firewall Solution', oem: 'Unspecified', category: 'Security' },
    { productName: 'Server Hardware', oem: 'Dell', category: 'Hardware' },  // Has OEM
    { productName: 'Unknown Tool', oem: 'N/A', category: 'Software' }
];

const suggestions = identifyMissingOEMs(products);
console.log(JSON.stringify(suggestions, null, 2));
```

**Output:**

```json
[
  {
    "productName": "Firewall Solution",
    "suggestedOEMs": [
      { "oem": "Fortinet", "country": "Global" },
      { "oem": "Palo Alto Networks", "country": "Global" },
      { "oem": "Check Point", "country": "Global" }
    ],
    "confidence": "high"
  },
  {
    "productName": "Unknown Tool",
    "suggestedOEMs": [
      { "oem": "Microsoft", "country": "Global" },
      { "oem": "Oracle", "country": "Global" },
      { "oem": "SAP", "country": "Global" }
    ],
    "confidence": "medium"
  }
]
```

**Note:** "Server Hardware" is **skipped** because it already has `oem: 'Dell'`.

---

### **Method 2: Generate Full Report**

```javascript
const { generateAgentReport } = require('./services/oemAgentService');

const products = [...];
const report = generateAgentReport(products);

// Returns STRICT JSON string (no extra text)
console.log(report);
```

---

## 🧪 Test Examples

### **Example 1: Security Products**

**Input:**

```json
[
  { "productName": "Next Generation Firewall", "oem": "Unspecified", "category": "Security" },
  { "productName": "Endpoint Detection & Response", "oem": "N/A", "category": "Security Software" }
]
```

**Output:**

```json
[
  {
    "productName": "Next Generation Firewall",
    "suggestedOEMs": [
      { "oem": "Fortinet", "country": "Global" },
      { "oem": "Palo Alto Networks", "country": "Global" },
      { "oem": "Check Point", "country": "Global" }
    ],
    "confidence": "high"
  },
  {
    "productName": "Endpoint Detection & Response",
    "suggestedOEMs": [
      { "oem": "QuickHeal", "country": "Indian" },
      { "oem": "K7 Computing", "country": "Indian" },
      { "oem": "Trend Micro", "country": "Global" }
    ],
    "confidence": "high"
  }
]
```

---

### **Example 2: Networking Products**

**Input:**

```json
[
  { "productName": "Core Switch 48 Port", "oem": "Unspecified", "category": "Networking" },
  { "productName": "Wireless Access Point", "oem": "", "category": "Network" }
]
```

**Output:**

```json
[
  {
    "productName": "Core Switch 48 Port",
    "suggestedOEMs": [
      { "oem": "Cisco Catalyst", "country": "Global" },
      { "oem": "HPE Aruba", "country": "Global" },
      { "oem": "Juniper Networks", "country": "Global" }
    ],
    "confidence": "high"
  },
  {
    "productName": "Wireless Access Point",
    "suggestedOEMs": [
      { "oem": "Cisco Meraki", "country": "Global" },
      { "oem": "Aruba", "country": "Global" },
      { "oem": "Ruckus", "country": "Global" }
    ],
    "confidence": "high"
  }
]
```

---

### **Example 3: Hardware Products**

**Input:**

```json
[
  { "productName": "Rack Mount Server", "oem": "Unspecified", "category": "Hardware" },
  { "productName": "Storage Array", "oem": "N/A", "category": "Storage" }
]
```

**Output:**

```json
[
  {
    "productName": "Rack Mount Server",
    "suggestedOEMs": [
      { "oem": "Dell PowerEdge", "country": "Global" },
      { "oem": "HP ProLiant", "country": "Global" },
      { "oem": "Lenovo ThinkSystem", "country": "Global" }
    ],
    "confidence": "high"
  },
  {
    "productName": "Storage Array",
    "suggestedOEMs": [
      { "oem": "NetApp", "country": "Global" },
      { "oem": "Dell EMC", "country": "Global" },
      { "oem": "HPE", "country": "Global" }
    ],
    "confidence": "high"
  }
]
```

---

### **Example 4: Services**

**Input:**

```json
[
  { "productName": "Incident Response Retainer Service", "oem": "Unspecified", "category": "Service" }
]
```

**Output:**

```json
[
  {
    "productName": "Incident Response Retainer Service",
    "suggestedOEMs": [
      { "oem": "Tata Consultancy Services", "country": "Indian" },
      { "oem": "Wipro", "country": "Indian" },
      { "oem": "IBM Services", "country": "Global" }
    ],
    "confidence": "high"
  }
]
```

---

## 🎯 Confidence Levels

| Confidence | Criteria | Meaning |
|------------|----------|---------|
| **high** | 3 suggestions + has Indian OEM | Very reliable suggestions |
| **medium** | 2+ suggestions | Moderate reliability |
| **low** | 0-1 suggestions | Uncertain, needs review |

---

## 🔧 Integration Steps

### **Step 1: Import Agent**

```javascript
const { identifyMissingOEMs } = require('./services/oemAgentService');
```

### **Step 2: Call Agent After Extraction**

```javascript
// After extracting products from RFP
const extractedProducts = extractProductsFromDocument(document);

// Run OEM agent on products with missing OEMs
const oemSuggestions = identifyMissingOEMs(extractedProducts);

// Log or display suggestions
console.log('🤖 OEM Agent Suggestions:');
console.log(JSON.stringify(oemSuggestions, null, 2));
```

### **Step 3: Optional - Auto-Apply Top Suggestion**

```javascript
// Auto-apply the first (best) suggestion for each product
oemSuggestions.forEach(suggestion => {
    if (suggestion.suggestedOEMs.length > 0) {
        const topSuggestion = suggestion.suggestedOEMs[0];
        
        // Find product and update
        const product = extractedProducts.find(p => 
            p.productName === suggestion.productName
        );
        
        if (product) {
            product.oem = topSuggestion.oem;
            product.miiStatus = topSuggestion.country === 'Indian' ? 'Indian OEM' : 'Global OEM';
            product.confidence = suggestion.confidence === 'high' ? 75 : 
                                suggestion.confidence === 'medium' ? 60 : 40;
        }
    }
});
```

---

## 📊 Expected Benefits

### **Before Agent:**
```
25 products extracted
→ 15 have "Unspecified" OEM
→ Need manual research
→ Takes hours
```

### **After Agent:**
```
25 products extracted
→ 15 analyzed by agent
→ 45 OEM suggestions generated (3 per product)
→ Takes seconds ✅
→ Confidence levels provided
→ Can auto-apply or show to user
```

---

## 🚀 Next Steps

1. **Test the agent** with your SEBI document
2. **Review suggestions** for accuracy
3. **Integrate** into main enrichment pipeline
4. **Enable auto-apply** for high-confidence suggestions only

---

**Your OEM identification is now AI-powered!** 🤖✨

For deterministic OEM selection, see: `DETERMINISTIC_OEM_FIX.md`


