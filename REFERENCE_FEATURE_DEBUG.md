# Reference Feature Debugging Guide

## Problem
When clicking "Reference" buttons, the modal shows "No source references found for this item."

## Root Cause
Documents are not being stored in Pinecone when uploaded, OR the Flask backend isn't running during upload.

## Solution Steps

### Step 1: Verify Flask Backend is Running
```bash
cd "C:\Users\ASUS\Downloads\Chatbot GRC 3\Build_chat"
py -3.10 app.py
```

**Look for:**
- `Using existing index: bid-intelligence-chatbot`
- `* Running on http://0.0.0.0:8080`

### Step 2: Re-upload Document with Flask Backend Running

1. **Start Flask backend FIRST** (keep it running)
2. **Start Node.js backend** (if not running)
3. **Upload your RFP document** through the frontend
4. **Check Node.js backend console** for:
   ```
   ✅ Document stored in Pinecone for chatbot: [filename]
   Document ID: [hash]
   Chunks stored: [number]
   ```
5. **Check Flask backend console** for:
   ```
   Storing RFP document in Pinecone...
   Successfully stored X chunks for document: [filename]
   ```

### Step 3: Test Reference Feature

1. Navigate to Bid Management page
2. Click any "Reference" button
3. **Check Node.js backend console** for:
   ```
   🔍 Searching for sources...
   📡 Calling Flask backend...
   📦 Flask response: { count: X, sourcesLength: X }
   ```
4. **Check Flask backend console** for:
   ```
   🔍 Getting sources for query: ...
   📄 Document ID: [hash]
   ✅ Found X relevant chunks from document namespace
   📚 Returning X sources
   ```

### Step 4: Verify Document is in Pinecone

Run the test script:
```bash
cd Backend
node test-document-storage.js <your-document-hash>
```

You can find the document hash in:
- Browser console: `localStorage.getItem('currentDocument')`
- Node.js backend console after upload

## Common Issues

### Issue 1: Flask Backend Not Running During Upload
**Symptom:** No "Document stored in Pinecone" message in Node.js console
**Fix:** Start Flask backend BEFORE uploading documents

### Issue 2: Document Not Found in Namespace
**Symptom:** Flask backend returns 0 sources
**Fix:** 
- Re-upload the document with Flask backend running
- Verify the documentId matches between storage and query

### Issue 3: Query Doesn't Match Content
**Symptom:** Flask backend finds chunks but they don't match the query
**Fix:** The improved endpoint now tries simplified queries automatically

## What I Fixed

1. **Improved `/get-sources` endpoint:**
   - Increased `k` from 5 to 10 for better coverage
   - Added fallback to simplified query if full query doesn't match
   - Better error handling and logging
   - Filters out empty snippets
   - Better page number extraction

2. **Better error logging:**
   - Shows detailed information when documents aren't found
   - Logs document ID and query for debugging
   - Shows helpful error messages

3. **Improved document storage logging:**
   - Shows when storage succeeds/fails
   - Displays chunk count
   - Warns if Flask backend isn't reachable

## Next Steps

1. **Restart Flask backend** with the updated code
2. **Re-upload your document** (with Flask backend running)
3. **Test reference buttons** and check console logs
4. **Share console output** if still not working
















