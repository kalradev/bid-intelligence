# 🔍 Why API Key Errors Happen

## Common Reasons:

### 1️⃣ **Line Still Commented Out**

❌ **Wrong:**
```env
# OPENAI_API_KEY=sk-svcacct-...
```

✅ **Correct:**
```env
OPENAI_API_KEY=sk-svcacct-...
```

---

### 2️⃣ **Extra Spaces Around `=`**

❌ **Wrong:**
```env
OPENAI_API_KEY = sk-svcacct-...
```
```env
OPENAI_API_KEY= sk-svcacct-...
```

✅ **Correct:**
```env
OPENAI_API_KEY=sk-svcacct-...
```

No spaces before or after `=`

---

### 3️⃣ **Quotes Around the Key**

❌ **Wrong:**
```env
OPENAI_API_KEY="sk-svcacct-..."
```
```env
OPENAI_API_KEY='sk-svcacct-...'
```

✅ **Correct:**
```env
OPENAI_API_KEY=sk-svcacct-...
```

No quotes needed!

---

### 4️⃣ **File Not Saved**

Make sure you:
1. Edit the file
2. **Press Ctrl+S** (or Cmd+S on Mac)
3. See the file icon change (no white dot)
4. Restart the server

---

### 5️⃣ **Wrong File Location**

The `.env` file MUST be at:
```
Backend/.env  ✅
```

NOT at:
```
.env  ❌ (project root)
Backend/config/.env  ❌
```

---

### 6️⃣ **Invisible Characters**

Sometimes copy-paste adds invisible characters.

**Fix:** Delete the entire line and retype it manually.

---

## 🔧 Quick Verification

Run this command to check your `.env` file:

```bash
cd Backend
node verify-env.js
```

This will show you:
- ✅ Which keys are loaded
- ❌ Which keys are missing
- 📏 Length of each key
- 🤖 Which AI provider will be used

---

## 🎯 Expected Output

When your `.env` is correct, you'll see:

```bash
[dotenv@17.2.3] injecting env (5) from .env

🔑 API Key Status:
   OpenAI: ✅ Configured
   Gemini: ✅ Configured

📋 Environment Variables Loaded:
   OPENAI_API_KEY: Present (length: 164)
   GEMINI_API_KEY: Present (length: 39)
   PORT: 3000
   NODE_ENV: development
   MAX_FILE_SIZE_MB: 50
```

Notice: **5 variables loaded** (not 4)

---

## 🆘 Still Having Issues?

### Try This Clean Setup:

1. **Delete existing .env:**
   ```bash
   cd Backend
   del .env
   ```

2. **Create fresh .env:**
   ```bash
   echo OPENAI_API_KEY=sk-svcacct-YOUR_KEY > .env
   echo GEMINI_API_KEY=YOUR_GEMINI_KEY >> .env
   echo PORT=3000 >> .env
   echo NODE_ENV=development >> .env
   echo MAX_FILE_SIZE_MB=50 >> .env
   ```

3. **Verify:**
   ```bash
   node verify-env.js
   ```

4. **Restart server:**
   ```bash
   npm run dev
   ```

---

## 💡 Pro Tip

If OpenAI keeps failing, the system will **automatically use Gemini**. 

You can use **Gemini-only mode** by simply not adding the OpenAI key. The system is designed to work with either:
- ✅ OpenAI only
- ✅ Gemini only
- ✅ Both (OpenAI → Gemini fallback)

---

## ✅ Example of Perfect .env File

```env
OPENAI_API_KEY=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
GEMINI_API_KEY=AIzaSyBpJ5G_ZxZtgIxsCvH3wXqohXK_8b
PORT=3000
NODE_ENV=development
MAX_FILE_SIZE_MB=50
```

**Key points:**
- ✅ No `#` at start
- ✅ No spaces around `=`
- ✅ No quotes
- ✅ Keys start from beginning of line
- ✅ Each variable on its own line

---

Need more help? Run `node verify-env.js` for detailed diagnostics!

