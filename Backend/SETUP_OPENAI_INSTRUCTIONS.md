# 🚀 Setup OpenAI API Key - Step by Step Guide

## Current Status
Your `.env` file has placeholders ready. We just need to:
1. ✅ Uncomment the OPENAI_API_KEY line
2. ✅ Replace `yyy` with your actual OpenAI key
3. ✅ Enable dual AI mode in the code

---

## 📝 Step 1: Update .env File

Open `Backend/.env` file and make these changes:

### **Current (What you have now):**
```env
# OPENAI_API_KEY=yyy
# PORT=3000
# NODE_ENV=development
# MAX_FILE_SIZE_MB=50
GEMINI_API_KEY=xxx
PORT=3000
NODE_ENV=development
MAX_FILE_SIZE_MB=50
```

### **Change to (What it should be):**
```env
OPENAI_API_KEY=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
GEMINI_API_KEY=xxx
PORT=3000
NODE_ENV=development
MAX_FILE_SIZE_MB=50
```

**What changed:**
- ✅ Removed `#` from line 1 (uncommented)
- ✅ Replaced `yyy` with your actual OpenAI key
- ✅ Removed duplicate commented lines (2, 3, 4)

---

## 📝 Step 2: Enable Dual AI Mode

Open `Backend/controllers/rfpController.js`

### **Find line 2 (Current):**
```javascript
const { generateDepartmentalSummaries } = require('../services/geminiService');
```

### **Change to:**
```javascript
const { generateDepartmentalSummaries } = require('../services/aiService');
```

**What this does:**
- Uses the dual AI service that tries OpenAI first
- Falls back to Gemini if OpenAI quota is exceeded

---

## 📝 Step 3: Upgrade Processing Version

Open `Backend/config/version.js`

### **Find:**
```javascript
const PROCESSING_VERSION = 17;
```

### **Change to:**
```javascript
const PROCESSING_VERSION = 18;
```

**What this does:**
- Clears the cache automatically
- Forces fresh analysis with OpenAI

---

## 📝 Step 4: Restart Backend

Stop your backend (Ctrl+C in terminal) and restart:

```bash
cd Backend
npm start
```

---

## ✅ Step 5: Test It

Upload your SEBI document and check the console. You should see:

### **Success with OpenAI:**
```
Generating departmental summaries...
🤖 Attempting with OpenAI (gpt-4o-mini)...
✅ OpenAI generation successful
Model used: gpt-4o-mini
Provider: openai
```

### **If OpenAI quota exceeded:**
```
Generating departmental summaries...
🤖 Attempting with OpenAI (gpt-4o-mini)...
⚠️  OpenAI failed: Quota exceeded
💡 OpenAI quota exceeded. Falling back to Gemini...
🤖 Attempting with Gemini (gemini-2.0-flash-exp)...
✅ Gemini generation successful
```

---

## 📊 What You'll Get with OpenAI

### **OpenAI Advantages:**
- ✅ More consistent JSON formatting
- ✅ Better understanding of complex requirements
- ✅ More accurate OEM extraction
- ✅ Cleaner structured outputs
- ✅ Better strategy and success factor suggestions

### **Gemini (Fallback):**
- ✅ Free tier (no cost)
- ✅ Fast processing
- ✅ Good for simple documents
- ✅ Automatic fallback if OpenAI fails

---

## 💰 Cost Estimate

**OpenAI (gpt-4o-mini) Pricing:**
- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens

**For a typical SEBI document (200k tokens):**
- Input cost: ~$0.03 per document
- Output cost: ~$0.02 per document
- **Total: ~$0.05 per document**

Very affordable! 🎉

---

## 🔧 Quick Summary of Changes

### **File 1: `Backend/.env`**
```diff
- # OPENAI_API_KEY=yyy
+ OPENAI_API_KEY=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
```

### **File 2: `Backend/controllers/rfpController.js` (Line 2)**
```diff
- const { generateDepartmentalSummaries } = require('../services/geminiService');
+ const { generateDepartmentalSummaries } = require('../services/aiService');
```

### **File 3: `Backend/config/version.js`**
```diff
- const PROCESSING_VERSION = 17;
+ const PROCESSING_VERSION = 18;
```

---

## ⚠️ Important Notes

1. **API Key Security:**
   - ✅ `.env` file is NOT committed to GitHub
   - ✅ Keep your API key private
   - ⚠️ Never share API keys in screenshots or messages

2. **Quota Management:**
   - OpenAI has usage limits based on your account tier
   - System automatically falls back to Gemini if quota exceeded
   - Check usage at: https://platform.openai.com/usage

3. **Rate Limits:**
   - Free tier: 3 requests per minute
   - Paid tier: Higher limits
   - System includes retry logic with exponential backoff

---

## 🎯 Done!

After following these 5 steps:
1. ✅ Updated `.env` with OpenAI key
2. ✅ Enabled dual AI mode
3. ✅ Upgraded processing version
4. ✅ Restarted backend
5. ✅ Tested with document upload

Your system will now use **OpenAI as primary** with **Gemini as fallback**! 🚀

---

## 🆘 Troubleshooting

### Issue: "OpenAI API key not found"
**Solution:** 
- Check that line 1 of `.env` has `OPENAI_API_KEY=` (no `#` at start)
- Save the `.env` file
- Restart backend

### Issue: "401 Unauthorized"
**Solution:**
- Your OpenAI key might be invalid
- Regenerate key at: https://platform.openai.com/api-keys
- Update `.env` with new key

### Issue: "429 Quota exceeded"
**Solution:**
- This is normal - system automatically uses Gemini
- Or add credits to your OpenAI account

### Issue: Backend still using Gemini
**Solution:**
- Check that `rfpController.js` line 2 uses `aiService` not `geminiService`
- Restart backend after making changes

---

## 📚 Additional Resources

- OpenAI API Docs: https://platform.openai.com/docs
- Check Usage: https://platform.openai.com/usage
- Pricing: https://openai.com/api/pricing/
- Get API Key: https://platform.openai.com/api-keys

---

**Questions?** Just ask! 🙋‍♂️

