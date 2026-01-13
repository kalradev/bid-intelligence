# 🔄 How to Restart Backend

## Quick Commands

### Windows PowerShell:
```powershell
# Navigate to Backend directory
cd C:\Users\ASUS\Desktop\Bid-Intelligence.Ai\Backend

# If server is running, stop it first (Ctrl+C)
# Then start:
npm start
```

### Alternative (from project root):
```powershell
cd Backend
npm start
```

## What You Should See:

```
🚀 Server running on http://localhost:3000
📊 Environment: development
🔑 Gemini API Key: ✓ Configured
```

## If You See Errors:

### "Missing GEMINI_API_KEY"
- Check `Backend/.env` file exists
- Should contain: `GEMINI_API_KEY=your_key_here`

### "Port 3000 already in use"
- Another server is running
- Kill it: `npx kill-port 3000`
- Or change port in `.env`: `PORT=5000`

### "Module not found"
- Run: `npm install`
- Then: `npm start`

## ✅ After Restart:

1. Backend loads new OEM database (371 OEMs)
2. Enhanced Gemini prompts active
3. New `/api/rfp/enrich-oems` endpoint available
4. Ready to process files!

## Test It:

```bash
# In a new terminal, test the endpoint:
curl http://localhost:3000/api/rfp/health
```

Should return: `{"success":true,"message":"RFP Analysis API is running"}`

---

**That's it! Your backend is ready!**

