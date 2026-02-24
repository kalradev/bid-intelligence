# Deploy via PuTTY (SSH) — branch `updatesdeev`

Use these steps on your Linux server after connecting with PuTTY (SSH).

## Before you build: get latest code and assets

Always pull the branch so the frontend has all assets (e.g. `bid-intelligence-logo.svg`):

```bash
cd ~/bid-intelligence
git fetch origin updatesdeev
git checkout updatesdeev
git pull origin updatesdeev
```

## Frontend: install and build (no ERESOLVE errors)

From the repo root:

```bash
cd ~/bid-intelligence/Frontend
```

**Option A — use lockfile (recommended if `package-lock.json` is committed):**

```bash
npm ci
```

**Option B — clean install (no lockfile or after adding new deps):**

```bash
rm -rf node_modules package-lock.json
npm install
```

If you still see peer dependency errors, use the deploy script:

```bash
npm run install:deploy
```

Then build:

```bash
npm run build
```

## Copy frontend build for backend

```bash
cd ~/bid-intelligence
cp -r Frontend/dist frontend-build
```

## Run backend

```bash
cd ~/bid-intelligence/Backend_py
source venv/bin/activate
python main.py
```

Or use the systemd service from the full deployment guide.

---

**Summary:** Pull `updatesdeev` first (so `Frontend/src/assets/bid-intelligence-logo.svg` exists), then `npm install` (or `npm run install:deploy` if needed), then `npm run build`.
