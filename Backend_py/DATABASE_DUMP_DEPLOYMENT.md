# Database dump and deployment

## 1. Deployment on a fresh server (schema only)

Use **`database_deployment.sql`** to create all tables and seed data (e.g. default `org_quota` row) on a new database. No user/project data.

**From command line (set `POSTGRES_PASSWORD` or use `.pgpass`):**
```bash
cd Backend_py
psql -h localhost -p 5432 -U postgres -d Bid2 -f database_deployment.sql
```

**Or create the database first, then run:**
```bash
createdb -U postgres Bid2
psql -U postgres -d Bid2 -f Backend_py/database_deployment.sql
```

**Using Docker (Postgres in container):**
```bash
docker exec -i bid-intelligence-db psql -U postgres -d Bid2 < Backend_py/database_deployment.sql
```

After this, start the app; it will use the new DB. Create the first Bid Admin user via `create_bid_admin.sql` (update the password hash) or via your app’s signup if enabled.

---

## 2. Create a dump file (backup or migrate existing data)

Use these scripts to dump your **current** database (schema + data) into a `.sql` file you can keep for backup or restore on another server.

**PowerShell (Windows):**
```powershell
cd Backend_py\scripts
.\create_dump.ps1
# Optional: schema only
.\create_dump.ps1 -SchemaOnly
# Custom DB/out dir
.\create_dump.ps1 -DbName Bid2 -OutDir ..\dumps
```

**Bash (Linux/macOS/Git Bash):**
```bash
cd Backend_py/scripts
chmod +x create_dump.sh
./create_dump.sh
# Schema only
./create_dump.sh schema-only
```

Dumps are written to **`Backend_py/dumps/`** (or the path you pass). The script reads `Backend_py/.env` for `POSTGRES_*` if present.

**Restore a dump on another server:**
```bash
psql -U postgres -d Bid2 -f dumps/bid_intelligence_dump_20260212_143022.sql
```

(Or create an empty DB first: `createdb -U postgres Bid2` then run the above.)

---

## 3. Summary

| File / script | Purpose |
|---------------|--------|
| **database_deployment.sql** | Run on a **new** DB to create schema + default seed (deployment). |
| **scripts/create_dump.ps1** | Create a **full dump** of current DB (backup/migrate) on Windows. |
| **scripts/create_dump.sh** | Same as above on Linux/macOS. |
| **create_bid_admin.sql** | Optional: insert first Bid Admin user (set password hash first). |
