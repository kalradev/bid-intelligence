# Chatbot Integration Guide

## Overview
The GRC (Governance, Risk, and Compliance) chatbot has been successfully integrated into the Bid Intelligence frontend. The chatbot uses LangChain, Pinecone vector store, and OpenAI GPT-4o to answer questions about GRC, Sanchlan Platform, and Compliance.

## Architecture

### Backend (Flask - Port 8080)
- **Location**: `C:\Users\ASUS\Downloads\Chatbot GRC 3\Build_chat\`
- **Framework**: Flask with CORS support
- **AI Model**: OpenAI GPT-4o
- **Vector Store**: Pinecone (index: "grc-chatbot")
- **API Endpoint**: `POST http://localhost:8080/get`

### Frontend (React - Port 5173/5174)
- **Location**: `C:\Users\ASUS\Desktop\Bid-Intelligence.Ai\Frontend\`
- **Component**: `src/pages/ChatbotPage.tsx`
- **Route**: `/chatbot`
- **Styling**: Matches Bid Intelligence UI design

## Setup Instructions

### 1. Install Flask CORS Dependency

Navigate to the chatbot directory and install the new dependency:

```bash
cd "C:\Users\ASUS\Downloads\Chatbot GRC 3\Build_chat"
py -3.10 -m pip install flask-cors==4.0.0
```

Or install all requirements (which now includes flask-cors):

```bash
py -3.10 -m pip install -r requirements.txt
```

### 2. Configure Environment Variables

Make sure your `.env` file in the chatbot directory contains:

```env
PINECONE_API_KEY=your_pinecone_api_key
OPENAI_API_KEY=your_openai_api_key
```

### 3. Start the Flask Chatbot Server

```bash
cd "C:\Users\ASUS\Downloads\Chatbot GRC 3\Build_chat"
py -3.10 app.py
```

The server will start on `http://localhost:8080`

### 4. Start the React Frontend

In a separate terminal:

```bash
cd "C:\Users\ASUS\Desktop\Bid-Intelligence.Ai\Frontend"
npm run dev
```

The frontend will start on `http://localhost:5173` (or 5174 if 5173 is busy)

### 5. Access the Chatbot

- Navigate to `http://localhost:5173/chatbot` in your browser
- Or click the "Chatbot" button in the navigation bar

## Features

### Chatbot Component Features:
- ✅ Modern UI matching Bid Intelligence design
- ✅ Real-time message display with timestamps
- ✅ Loading indicators while processing
- ✅ Error handling with user-friendly messages
- ✅ Auto-scroll to latest message
- ✅ Responsive design
- ✅ Bot and user message differentiation

### API Integration:
- ✅ CORS enabled for cross-origin requests
- ✅ JSON API support
- ✅ Backward compatible with form data
- ✅ Error handling and validation

## Navigation

The chatbot is accessible from:
1. **Main Navbar** (`/` route) - "Chatbot" button
2. **Insights Page** - "Chatbot" button in navbar
3. **Direct URL**: `/chatbot`

## Troubleshooting

### Chatbot not responding?
1. **Check Flask server is running**: Ensure `app.py` is running on port 8080
2. **Check API keys**: Verify `PINECONE_API_KEY` and `OPENAI_API_KEY` are set in `.env`
3. **Check CORS**: Make sure `flask-cors` is installed
4. **Check browser console**: Look for CORS or network errors

### Port conflicts?
- Flask default port: `8080` (change in `app.py` line 80)
- React default port: `5173` (change in `vite.config.ts`)

### Python version issues?
- The chatbot requires Python 3.10+ (currently using Python 3.10.11)
- Use `py -3.10` to explicitly use Python 3.10

## File Changes Summary

### Backend Changes:
1. **`app.py`**: 
   - Added `flask-cors` import and CORS configuration
   - Updated `/get` endpoint to support JSON requests
   - Enhanced error handling

2. **`requirements.txt`**: 
   - Added `flask-cors==4.0.0`

### Frontend Changes:
1. **`src/pages/ChatbotPage.tsx`**: New chatbot component
2. **`src/App.tsx`**: Added `/chatbot` route
3. **`src/components/Navbar.tsx`**: Added "Chatbot" button
4. **`src/pages/InsightsPage.tsx`**: Added "Chatbot" button to navbar

## Testing

1. Start both servers (Flask and React)
2. Navigate to `/chatbot` in your browser
3. Send a test message like "What is GRC?"
4. Verify the bot responds with relevant information
5. Test error handling by stopping the Flask server and sending a message

## Next Steps

- [ ] Add chat history persistence (localStorage)
- [ ] Add export chat functionality
- [ ] Add typing indicators
- [ ] Add message reactions/feedback
- [ ] Integrate with user authentication (if needed)

## Support

For issues or questions:
1. Check the browser console for errors
2. Check Flask server logs for backend errors
3. Verify all environment variables are set correctly
4. Ensure all dependencies are installed

