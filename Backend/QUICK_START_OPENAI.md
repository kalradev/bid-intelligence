# ⚡ Quick Start - Enable OpenAI (2 Minutes)

## Step 1: Update .env File (30 seconds)

Open `Backend/.env` and change line 1:

**FROM:**
```env
# OPENAI_API_KEY=yyy
```

**TO:**
```env
OPENAI_API_KEY=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
```

Remove the `#` and replace `yyy` with your key.

---

## Step 2: Restart Backend (30 seconds)

```bash
cd Backend
npm start
```

---

## ✅ That's It!

**Code changes already done:**
- ✅ Controller updated to use `aiService`
- ✅ Processing version upgraded to 18
- ✅ Cache will clear automatically

**What you'll get:**
```
🤖 Attempting with OpenAI (gpt-4o-mini)...
✅ OpenAI generation successful
```

---

## 📖 Need More Details?

Read the full guide: `SETUP_OPENAI_INSTRUCTIONS.md`

