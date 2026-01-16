# Reference Links Troubleshooting Guide

## 🔍 Problem: "No source references found for this item"

This guide will help you diagnose and fix the reference links issue.

## ✅ Step-by-Step Diagnosis

### Step 1: Check Document ID in Browser

1. Open your browser's Developer Console (F12)
2. Go to the **Console** tab
3. Type this command:
```javascript
console.log('currentDocument:', localStorage.getItem('currentDocument'));
console.log('recentRfpAnalysis:', localStorage.getItem('recentRfpAnalysis'));
console.log('analysisData:', JSON.parse(localStorage.getItem('analysisData'))?.data?.fileHash);
```

**Expected:** You should see a `fileHash` value (long string like `a1b2c3d4e5f6...`)

**If missing:** Re-upload your document

### Step 2: Check Flask Backend is Running

1. Open a new terminal
2. Navigate to: `cd "Chatbot GRC 3\Build_chat"`
3. Run: `py -3.10 app.py`
4. Look for: `* Running on http://0.0.0.0:8080`

**If not running:** Start it now!

### Step 3: Check Document Storage in Pinecone

When you upload a document, check the **Node.js backend console** for:
```
✅ Document stored in Pinecone for chatbot: [filename]
Document ID: [hash]
Chunks stored: [number]
```

**If you don't see this:** The document wasn't stored in Pinecone.

### Step 4: Test Reference Links

1. Click a "Reference" button
2. Open browser **Console** (F12)
3. Look for these messages:
   - `🔍 Fetching sources for query: "..."`
   - `✅ Found documentId from ...`
   - `📡 Calling Node.js backend: ...`
   - `📥 Node.js response status: 200`
   - `✅ Found X sources!`

**If you see errors:** Check the error message

## 🐛 Common Issues & Fixes

### Issue 1: "No documentId found"

**Symptoms:**
- Console shows: `❌ No documentId found in localStorage!`
- Alert: "No document found. Please upload and analyze an RFP document first."

**Fix:**
1. Re-upload your document
2. Make sure analysis completes successfully
3. Check that `localStorage` has the document ID

### Issue 2: Flask Backend Not Running

**Symptoms:**
- Console shows: `❌ Flask backend also failed`
- Error: "Connection refused" or "Network error"

**Fix:**
1. Start Flask backend:
   ```bash
   cd "Chatbot GRC 3\Build_chat"
   py -3.10 app.py
   ```
2. Wait for: `* Running on http://0.0.0.0:8080`
3. Try reference links again

### Issue 3: Document Not Stored in Pinecone

**Symptoms:**
- Console shows: `⚠️ No sources found`
- Flask backend returns empty sources

**Fix:**
1. **Re-upload your document** (with Flask backend running!)
2. Check Node.js console for: `✅ Document stored in Pinecone`
3. Check Flask console for: `Successfully stored X chunks`
4. Try reference links again

### Issue 4: Query Doesn't Match Content

**Symptoms:**
- Flask backend returns 200 OK
- But `sources: []` (empty array)

**Fix:**
1. The query might be too specific
2. Try a simpler query (e.g., "turnover" instead of "minimum annual turnover of ₹50 lakhs")
3. Check if the document actually contains that text

## 🔧 Quick Fix Checklist

- [ ] Flask backend is running on port 8080
- [ ] Node.js backend is running on port 3000
- [ ] Document was uploaded AFTER Flask backend started
- [ ] Console shows "Document stored in Pinecone"
- [ ] Browser console shows documentId when clicking Reference
- [ ] No CORS errors in browser console
- [ ] Network tab shows successful API calls

## 📝 Testing Steps

1. **Start Flask Backend:**
   ```bash
   cd "Chatbot GRC 3\Build_chat"
   py -3.10 app.py
   ```

2. **Start Node.js Backend:**
   ```bash
   cd Backend
   npm start
   ```

3. **Upload Document:**
   - Go to Upload page
   - Upload your RFP document
   - Wait for analysis to complete

4. **Check Storage:**
   - Node.js console: Should show "Document stored in Pinecone"
   - Flask console: Should show "Successfully stored X chunks"

5. **Test Reference Links:**
   - Go to Bid Management page
   - Click any "Reference" button
   - Check browser console for logs
   - Should see sources in modal

## 🆘 Still Not Working?

If reference links still don't work after following all steps:

1. **Check Browser Console:**
   - Look for any red error messages
   - Copy the full error message

2. **Check Backend Consoles:**
   - Node.js backend: Look for API call logs
   - Flask backend: Look for `/get-sources` endpoint logs

3. **Verify Document in Pinecone:**
   - Check Flask backend console when clicking Reference
   - Should see: `🔍 Getting sources for query: ...`
   - Should see: `✅ Found X relevant chunks`

4. **Share Debug Info:**
   - Browser console errors
   - Backend console logs
   - Document ID (first 16 characters)

## 💡 Pro Tips

- **Always start Flask backend BEFORE uploading documents**
- **Check console logs** - they show exactly what's happening
- **Re-upload if needed** - sometimes documents don't store correctly
- **Use simpler queries** - complex queries might not match















