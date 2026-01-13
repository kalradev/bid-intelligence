# 🧪 Testing the Deterministic BOQ Extraction

## Quick Start

### **1. Test with the Provided Script**

```bash
cd Backend
node test-determinism.js <path-to-your-pdf-file>
```

**Example:**
```bash
node test-determinism.js ../samples/sample-boq.pdf
```

This will:
- Extract BOQ 3 times from the same PDF
- Compare results to verify determinism
- Show detailed statistics

### **2. Test via the API**

Start the server:
```bash
npm start
# or
npm run dev
```

Upload a document twice and compare results:

**First Upload:**
```bash
curl -X POST http://localhost:5000/api/rfp/analyze \
  -F "file=@sample-boq.pdf"
```

**Second Upload (same file):**
```bash
curl -X POST http://localhost:5000/api/rfp/analyze \
  -F "file=@sample-boq.pdf"
```

**Expected Result:** Both should return **exactly the same** product count and results.

---

## 📊 What to Look For

### **✅ Signs of Success (Deterministic)**

**In Logs:**
```
🎯 Attempting NEW deterministic BOQ extraction...
📄 PDF has 15 pages
📄 Found 3 potential BOQ pages out of 15 total pages
✅ Extracted 60 rows deterministically

🔄 Mapping 60 rows to products...
✅ Successfully mapped 58 valid products from 60 rows

🔍 Validating 58 products...
✅ 58 products passed validation

🔄 Deduplicating 58 products...
✅ Removed 2 duplicates
   Final count: 56 unique products

✅ DETERMINISTIC EXTRACTION COMPLETE!
   📊 Total Products: 56
   🏭 Unique OEMs: 23
   🇮🇳 Indian OEMs: 12
   🌍 Global OEMs: 11
   ✅ MII Compliance: 45%
```

**Key Indicators:**
- ✅ Same product count on every run
- ✅ Same unique OEM count
- ✅ Same MII percentage
- ✅ "Deterministic extraction SUCCESS" message

### **⚠️ Signs of Fallback (Non-Deterministic)**

**In Logs:**
```
⚠️ Deterministic extraction found no products, falling back to LLM method...
📝 Using TRADITIONAL LLM-based BOQ extraction
```

**Why This Happens:**
- Table extraction couldn't find BOQ table
- PDF has no table structure (scanned image)
- Table format not recognized
- Non-PDF document (DOCX, DOC)

**What This Means:**
- System falls back to old LLM-based method
- Results may vary slightly between runs
- Still functional, but not fully deterministic

---

## 🎯 Test Scenarios

### **Scenario 1: Standard BOQ PDF**

**File Type:** PDF with table-structured BOQ  
**Expected:** ✅ Deterministic extraction  
**Result:** Same product count every time

**Test:**
```bash
node test-determinism.js ./samples/standard-boq.pdf 5
```

Should show:
```
✅✅✅ FULLY DETERMINISTIC ✅✅✅
Same file uploaded multiple times will produce identical results.
```

---

### **Scenario 2: Complex Multi-Page BOQ**

**File Type:** PDF with BOQ spanning multiple pages  
**Expected:** ✅ Deterministic extraction with table merging  
**Result:** All pages merged into single product list

**Test:**
```bash
node test-determinism.js ./samples/multi-page-boq.pdf 3
```

Check logs for:
```
📄 Found 5 potential BOQ pages out of 20 total pages
✅ Extracted 150 rows deterministically
```

---

### **Scenario 3: Scanned PDF (Image-based)**

**File Type:** Scanned PDF (image, no text layer)  
**Expected:** ⚠️ Fallback to LLM method  
**Result:** May vary slightly between runs

**Test:**
```bash
node test-determinism.js ./samples/scanned-boq.pdf 3
```

Expected logs:
```
⚠️ Table extraction found no rows, trying text-based fallback...
⚠️ Falling back to traditional LLM-based extraction...
```

**Note:** To make scanned PDFs deterministic, you would need to add OCR preprocessing.

---

### **Scenario 4: DOCX/DOC Files**

**File Type:** Word documents  
**Expected:** ⚠️ LLM-based extraction (deterministic extraction only works for PDFs)  
**Result:** May vary slightly

**Test via API:**
```bash
curl -X POST http://localhost:5000/api/rfp/analyze \
  -F "file=@sample-boq.docx"
```

Logs will show:
```
ℹ️ Non-PDF document, using traditional LLM-based extraction...
```

---

## 📈 Measuring Success

### **Key Metrics to Track:**

1. **Product Count Consistency**
   - Upload same file 10 times
   - Record product count each time
   - **Success:** All 10 runs have same count
   - **Failure:** Counts vary (58, 60, 65, etc.)

2. **OEM Assignment Stability**
   - Check if same products get same OEMs
   - **Success:** Product "Dell Server" always gets "Dell"
   - **Failure:** Sometimes "Dell", sometimes "HP"

3. **MII Percentage Consistency**
   - Track MII compliance percentage
   - **Success:** Always same percentage
   - **Failure:** Varies between runs

4. **Processing Time**
   - Compare old vs new method
   - **Expected:** Similar or slightly faster

---

## 🐛 Troubleshooting

### **Problem: "Table extraction failed"**

**Possible Causes:**
- PDF is image-based (scanned)
- No table structure in PDF
- Corrupted PDF file

**Solutions:**
1. Check if PDF has selectable text
2. Try a different PDF
3. System will automatically fall back to LLM method

---

### **Problem: "Non-deterministic results detected"**

**Possible Causes:**
- LLM temperature too high
- OEM enrichment using random selection
- Parallel processing issues

**Debug Steps:**
1. Check `rowMappingService.js` temperature setting (should be 0.1)
2. Check `oemEnrichmentService.js` uses deterministic hashing
3. Check logs for specific mismatches

---

### **Problem: "No products found"**

**Possible Causes:**
- Document doesn't contain BOQ
- Table not recognized as BOQ
- Invalid row format

**Solutions:**
1. Check if document actually has a BOQ/BOM
2. Check logs for "Found X potential BOQ pages"
3. If X = 0, table detection needs adjustment

---

## 📝 Test Checklist

Before deploying to production:

- [ ] Test with at least 5 different BOQ PDFs
- [ ] Run each PDF through extraction 3+ times
- [ ] Verify product counts match every time
- [ ] Check OEM assignments are stable
- [ ] Test with large documents (100+ products)
- [ ] Test with multi-page BOQs
- [ ] Test fallback with scanned PDFs
- [ ] Verify DOCX/DOC files still work
- [ ] Check processing time is acceptable
- [ ] Validate MII calculations are correct
- [ ] Test duplicate removal works correctly
- [ ] Verify cache still works with new system

---

## 📊 Sample Test Results

### **Expected Output from test-determinism.js:**

```
════════════════════════════════════════════════════════════
   DETERMINISTIC BOQ EXTRACTION - TEST SUITE
════════════════════════════════════════════════════════════

📄 Testing file: sample-boq.pdf
🔄 Running 3 extraction attempts...

━━━ Run 1/3 ━━━
🚀 ============================================
   DETERMINISTIC BOQ EXTRACTION - NEW FLOW
   ============================================

📋 STEP 1: Table Extraction (Deterministic)
🔍 Starting deterministic table extraction...
✅ Extracted 60 rows deterministically

🔄 STEP 2: Row-by-Row Product Mapping
   Processing batch 1/6 (10 rows)
   Processing batch 2/6 (10 rows)
   ...
✅ Mapped 58 products

🔍 STEP 3: JSON Schema Validation
✅ 58 products passed validation

🔧 STEP 4: Deduplication
✅ Removed 2 duplicates
   Final count: 56 unique products

🏭 STEP 5: OEM Enrichment
✅ OEM enrichment complete

✅ ============================================
   DETERMINISTIC EXTRACTION COMPLETE!
   ============================================
   📊 Total Products: 56
   🏭 Unique OEMs: 23
   🇮🇳 Indian OEMs: 12
   🌍 Global OEMs: 11
   ✅ MII Compliance: 45%
   ⏱️  Processing Time: 35.2s
   ============================================

✅ Extraction successful
   Products: 56
   Unique OEMs: 23
   MII Compliance: 45%

━━━ Run 2/3 ━━━
[... same output ...]
✅ Extraction successful
   Products: 56
   Unique OEMs: 23
   MII Compliance: 45%

━━━ Run 3/3 ━━━
[... same output ...]
✅ Extraction successful
   Products: 56
   Unique OEMs: 23
   MII Compliance: 45%

════════════════════════════════════════════════════════════
   DETERMINISM ANALYSIS
════════════════════════════════════════════════════════════

✅ 3/3 runs succeeded

Comparing Run 1 vs Run 2:
   Product Count: 56 vs 56 - ✅ MATCH
   Unique OEMs:   23 vs 23 - ✅ MATCH
   MII %:         45% vs 45% - ✅ MATCH
   ✅ DETERMINISTIC: Same results on both runs

Comparing Run 2 vs Run 3:
   Product Count: 56 vs 56 - ✅ MATCH
   Unique OEMs:   23 vs 23 - ✅ MATCH
   MII %:         45% vs 45% - ✅ MATCH
   ✅ DETERMINISTIC: Same results on both runs

════════════════════════════════════════════════════════════
   FINAL VERDICT
════════════════════════════════════════════════════════════

✅✅✅ FULLY DETERMINISTIC ✅✅✅

The extraction is consistent across all runs.
Same file uploaded multiple times will produce identical results.

This solves the problem you described:
   ✅ No fluctuating item counts (60 vs 58 vs 65)
   ✅ No hallucinated products
   ✅ No random OEM changes
   ✅ Stable, reproducible output
```

---

## 🎯 Success Criteria

### **The system is working correctly if:**

1. ✅ Same PDF gives same product count (3 runs minimum)
2. ✅ Same products get same OEMs every time
3. ✅ MII percentage doesn't fluctuate
4. ✅ No hallucinated products (only real BOQ items)
5. ✅ Processing completes in reasonable time (<60s)
6. ✅ Logs show "DETERMINISTIC EXTRACTION COMPLETE"
7. ✅ Fallback works for non-table documents
8. ✅ Cache still functions correctly

---

## 📞 Getting Help

If tests fail:

1. **Check Logs:** Look for specific error messages
2. **Run Test Script:** Use `node test-determinism.js` for detailed output
3. **Check API Key:** Ensure `GEMINI_API_KEY` is set in `.env`
4. **Verify Dependencies:** Run `npm install` to ensure all packages installed
5. **Test with Sample:** Try a known-good BOQ PDF first

---

## 🎉 What Success Looks Like

**Before (LLM-based):**
```
Upload #1: 58 products
Upload #2: 60 products
Upload #3: 65 products
Upload #4: 58 products
Result: ❌ Inconsistent
```

**After (Deterministic):**
```
Upload #1: 56 products
Upload #2: 56 products
Upload #3: 56 products
Upload #4: 56 products
Result: ✅ Consistent!
```

---

**Happy Testing! 🚀**

