# Enable Dual AI Provider (OpenAI + Gemini)

## Current Status: ✅ Gemini Only (Working)

Your backend is currently using **Gemini only**. This is working fine!

## To Enable OpenAI + Gemini Fallback:

### Step 1: Setup .env file

Create/edit `Backend/.env` with BOTH keys:

```env
OPENAI_API_KEY=sk-your-actual-openai-key
GEMINI_API_KEY=your-actual-gemini-key
```

### Step 2: Update Controller

Open `Backend/controllers/rfpController.js`

**Change line 2 from:**
```javascript
const { generateDepartmentalSummaries } = require('../services/geminiService');
```

**To:**
```javascript
const { generateDepartmentalSummaries } = require('../services/aiService');
```

### Step 3: Restart Backend

```bash
cd Backend
npm start
```

## How It Will Work:

```
Document Upload
    ↓
Try OpenAI (gpt-4o-mini) first
    ↓
Success? → Use OpenAI results
    ↓
Failed/Quota exceeded? → Fallback to Gemini
    ↓
Success? → Use Gemini results
```

## Console Output:

**With OpenAI working:**
```
🤖 Attempting with OpenAI (gpt-4o-mini)...
✅ OpenAI generation successful
```

**When falling back to Gemini:**
```
🤖 Attempting with OpenAI (gpt-4o-mini)...
⚠️  OpenAI failed: Quota exceeded
💡 OpenAI quota exceeded. Falling back to Gemini...
🤖 Attempting with Gemini (gemini-2.0-flash-exp)...
✅ Gemini generation successful
```

## Don't Want OpenAI?

If you're happy with Gemini only, **no action needed!** 
Your current setup is working perfectly. ✅

