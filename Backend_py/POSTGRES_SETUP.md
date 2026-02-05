# PostgreSQL Setup Guide (pgAdmin)

This backend uses **PostgreSQL only** (no MongoDB).

---

## Easiest path (one command)

1. Put your Postgres password in `.env`:  
   `POSTGRES_PASSWORD=your_actual_password`
2. From `Backend_py` run:
   ```bash
   python setup_db_and_schema.py
   ```
   This creates the database only if it doesn’t exist (e.g. **Bid2**); if you already have Bid2 in pgAdmin, it will just apply the schema (tables) to that database.
3. Start the backend:
   ```bash
   python main.py
   ```

No pgAdmin needed unless you want to inspect the DB.

---

## Alternative: pgAdmin

**Schema:** The app uses `schema_from_user.sql`. If you prefer to run SQL yourself, use that file in pgAdmin.

### 1. Create Database in pgAdmin

1. Open **pgAdmin** and connect to your PostgreSQL server.
2. Right-click **Databases** → **Create** → **Database**
3. Set **Database** name: `Bid2` (or match `POSTGRES_DB` in your `.env`)
4. Click **Save**

## 2. Configure .env

Copy `.env.example` to `.env` and update:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_actual_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=Bid2
```

Or use a full connection string:
```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/Bid2
```

## 3. Run the Backend

Tables are created automatically on startup:

```bash
cd Backend_py
python main.py
```

You should see: `✅ SQLAlchemy database tables initialized`

## 4. Tables Created (Schema)

| Table | Purpose |
|-------|---------|
| `users` | Authentication (login/register) |
| `projects` | RFP/tender projects |
| `project_documents` | Uploaded documents + AI analysis (JSONB) |
| `analysis_records` | Granular clause storage for audit |
| `eligibility_checklist` | User checklist per project |
| `file_cache` | Cached extraction results |

## 5. Verify Schema

```bash
python verify_schema.py
```

Shows which tables exist and if any columns are missing.

## 6. Troubleshooting

**Password authentication failed**
- `POSTGRES_PASSWORD` in `.env` must match the password you use in pgAdmin
- In pgAdmin: right-click your server → Properties → check the connection settings
- Update `.env`: `POSTGRES_PASSWORD=your_actual_password`

**Port 3000 already in use**
- Add to `.env`: `PORT=3001` (or any free port)
- Or stop the other process using port 3000

**Connection refused**
- Ensure PostgreSQL is running (Windows: check Services for "postgresql")

**Database does not exist**
- Create it in pgAdmin (step 1), or run: `python setup_db.py`

**Tables not created by Python**
- Run: `python setup_db_and_schema.py`  
- Or in pgAdmin: right-click database **Bid2** → Query Tool → open `schema_from_user.sql` → Execute (F5)
