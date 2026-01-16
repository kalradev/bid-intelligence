# Chatbot Deep Research & Document Storage Guide

## Overview

The chatbot now supports:
1. **Automatic RFP Document Storage** - Uploaded RFP documents are automatically stored in Pinecone for querying
2. **Document-Specific Queries** - Ask questions about specific uploaded documents
3. **Deep Research Mode** - Toggle to get more detailed answers with Google search integration

## Features

### 1. Automatic Document Storage

When you upload an RFP document:
- The document is analyzed as usual
- After analysis, it's automatically stored in Pinecone vector database
- The document is indexed by its file hash (unique identifier)
- You can then ask questions about that specific document

### 2. Document-Specific Queries

The chatbot automatically detects if you have a recent RFP analysis and allows you to ask questions about it:
- Questions are answered based on the uploaded document
- If no document is available, it uses the general knowledge base

### 3. Deep Research Toggle

**Location**: Toggle switch in the chatbot UI (above the input field)

**When Enabled**:
- The chatbot performs Google search for additional information
- Combines knowledge base results with web search results
- Provides more comprehensive and up-to-date answers
- Shows web search results in the chat

**When Disabled**:
- Uses only the knowledge base (faster responses)
- Answers based on stored documents and general knowledge

## Setup Instructions

### 1. Install Dependencies

```bash
cd "C:\Users\ASUS\Downloads\Chatbot GRC 3\Build_chat"
pip install -r requirements.txt
```

### 2. Configure Google Search (Optional - for Deep Research)

To enable Google search in Deep Research mode, you need a SerpAPI key:

1. Sign up at https://serpapi.com/
2. Get your API key
3. Add to `.env` file:
   ```
   SERP_API_KEY=your_serp_api_key_here
   ```

**Note**: If SERP_API_KEY is not set, Deep Research will still work but without Google search results.

### 3. Start the Chatbot Server

```bash
cd "C:\Users\ASUS\Downloads\Chatbot GRC 3\Build_chat"
py -3.10 app.py
```

## How It Works

### Document Storage Flow

1. User uploads RFP document → Backend analyzes it
2. After analysis → Backend calls `/store-rfp` endpoint
3. Document is chunked and stored in Pinecone with namespace = fileHash
4. Document is ready for querying

### Query Flow

1. User asks a question in chatbot
2. If documentId is available → Query specific document namespace
3. If deepResearch is enabled → Perform Google search
4. Combine results and return comprehensive answer

## API Endpoints

### POST `/store-rfp`
Store an RFP document in Pinecone

**Request Body**:
```json
{
  "fileHash": "abc123...",
  "fileName": "example.pdf",
  "text": "Extracted text from document...",
  "metadata": {
    "uploadedAt": "2025-12-07T10:00:00Z",
    "analysisData": {...}
  }
}
```

### POST `/get`
Chat with the chatbot

**Request Body**:
```json
{
  "msg": "What are the key requirements?",
  "documentId": "abc123...",  // Optional
  "deepResearch": true  // Optional, default: false
}
```

**Response**:
```json
{
  "answer": "Based on the document...",
  "deepResearch": true,
  "googleResults": [
    {
      "title": "Result Title",
      "snippet": "Result snippet...",
      "link": "https://..."
    }
  ]
}
```

## Frontend Integration

### Storing Document ID

After RFP analysis, store the fileHash in localStorage:

```javascript
// After successful RFP analysis
localStorage.setItem('recentRfpAnalysis', JSON.stringify({
  fileHash: response.data.fileHash,
  fileName: response.data.fileName
}));
```

The chatbot widget automatically reads this and uses it for document-specific queries.

## Troubleshooting

### Document Not Storing

- Check that the Flask server is running
- Verify `/store-rfp` endpoint is accessible
- Check console logs for errors

### Deep Research Not Working

- Verify SERP_API_KEY is set in `.env`
- Check network connectivity
- If API key is missing, Deep Research will work but without Google results

### Document-Specific Queries Not Working

- Ensure document was stored successfully
- Check that fileHash is correct
- Verify namespace exists in Pinecone

## Notes

- Documents are stored with namespace = fileHash for easy retrieval
- Deep Research adds latency but provides more comprehensive answers
- Google search requires SerpAPI key (free tier available)
- All stored documents are queryable through the chatbot

