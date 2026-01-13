# AI Provider Setup Guide

## 🤖 Dual AI Provider System

Your application now uses **two AI providers** with automatic fallback:

```
OpenAI (Primary) ──[Quota Exceeded]──> Gemini (Fallback)
```

### Priority Order:
1. **OpenAI** (gpt-4o-mini) - Tries first
2. **Gemini** (gemini-2.0-flash-exp) - Auto-fallback if OpenAI fails

---

## 🔑 Setup API Keys

### Step 1: OpenAI API Key (Primary)

1. Go to: https://platform.openai.com/api-keys
2. Sign in with your OpenAI account
3. Click **"Create new secret key"**
4. Copy your key (starts with `sk-proj-...`)

### Step 2: Gemini API Key (Fallback)

1. Go to: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy your key (starts with `AIzaSy...`)

### Step 3: Add Keys to .env File

Open `Backend/.env` file and add both keys:

```env
# OpenAI API Key (Primary)
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_OPENAI_KEY_HERE

# Gemini API Key (Fallback)
GEMINI_API_KEY=AIzaSyYOUR_ACTUAL_GEMINI_KEY_HERE
```

⚠️ **IMPORTANT**: 
- Replace the placeholder values with your **actual keys**
- Never commit the `.env` file to GitHub
- Keep your keys secure and private

---

## ✅ Verify Setup

After adding both keys, restart the backend:

```bash
cd Backend
npm start
```

Upload a document and check the console logs. You should see:

```
🤖 Attempting with OpenAI (gpt-4o-mini)...
✅ OpenAI generation successful
```

If OpenAI quota is exceeded, you'll see:

```
🤖 Attempting with OpenAI (gpt-4o-mini)...
⚠️  OpenAI failed: Quota exceeded
💡 OpenAI quota exceeded. Falling back to Gemini...
🤖 Attempting with Gemini (gemini-2.0-flash-exp)...
✅ Gemini generation successful
```

---

## 💰 Cost Comparison

| Provider | Model | Cost (Input) | Cost (Output) | Speed |
|----------|-------|--------------|---------------|-------|
| **OpenAI** | gpt-4o-mini | $0.150 / 1M tokens | $0.600 / 1M tokens | Fast |
| **Gemini** | 2.0-flash-exp | Free (rate limited) | Free | Fast |

**Recommendation**: Use Gemini for development/testing (free), OpenAI for production (paid).

---

## 🔧 Troubleshooting

### Issue: "OpenAI API key not found"
- Check that `OPENAI_API_KEY` is in your `.env` file
- Restart the backend after adding the key

### Issue: "Gemini API key not found"
- Check that `GEMINI_API_KEY` is in your `.env` file
- Restart the backend after adding the key

### Issue: "Both AI providers failed"
- Verify both API keys are valid
- Check your internet connection
- Check API quota/rate limits on provider dashboards

---

## 📊 Processing Version

Current version: **16**

This version includes:
- ✅ Dual AI provider system
- ✅ Automatic OpenAI → Gemini fallback
- ✅ Balanced department summaries with bidding intelligence
- ✅ Comprehensive product extraction (up to 150 products)

Cache is automatically invalidated when version changes.

