# Bid Intelligence – Deployment Readiness Report

**Generated:** February 2026  
**Scope:** Database schema, localStorage vs database usage, API health, deployment readiness.

---

## 1. Database Schema Status

### 1.1 Core Tables (Used by Application)

| Table | Purpose | Status | Notes |
|-------|---------|--------|--------|
| **users** | Auth, roles (bid_admin, bid_manager, technical_manager), hierarchy (parent_id), must_change_password | ✅ OK | Columns: id, full_name, email, password, role, parent_id, must_change_password, created_at, updated_at. Init via `init_db()` + ALTER in main.py. |
| **projects** | RFP projects; owner = user_id; archived flag | ✅ OK | Columns: id, tender_id, project_name, client_name, user_id, created_at, archived. |
| **project_assignments** | Many-to-many: which users (TM/BM) are assigned to which project | ✅ OK | project_id, user_id; unique (project_id, user_id). |
| **project_documents** | Per-document analysis; stores full analysis + OEM selections in JSONB | ✅ OK | id, project_id, file_hash, file_name, update_type, extracted_text, **analysis_data** (jsonb), created_at. |
| **org_quota** | Org-wide project quota (base 10 + purchased) | ✅ OK | id, base_limit, purchased_quota, unarchive_quota_used, updated_at. Created by init_db (OrgQuota model); unarchive_quota_used added in main.py. |
| **quota_transactions** | Recharge / PayPal transaction history | ✅ OK | id, admin_user_id, amount_usd, projects_added, recharge_type, paypal_order_id, paypal_status, created_at. |
| **eligibility_checklist** | Per-project eligibility criteria and checked state | ✅ OK | project_id, document_id, user_id, criteria_text, is_checked, created_at, updated_at. |
| **file_cache** | Cached RFP processing (hash, version, departmental_summaries) | ✅ OK | UUID id, file_hash, processing_version, original_filename, extracted_text, departmental_summaries, metadata, tender_id, corrigendum_*. |
| **analysis_records** | Section-level analysis records (optional use) | ✅ OK | project_id, document_id, section, content, source_type, etc. |

### 1.2 Schema Initialization

- **init_db()** in `core/sqlalchemy_db.py` creates all tables from `models.sqlalchemy_models` (SQLAlchemy `Base.metadata.create_all`).
- **main.py** on startup:
  - Runs `init_db()`.
  - Runs ALTERs for: `projects.archived`, `org_quota.unarchive_quota_used`, `users.must_change_password`.

### 1.3 Migrations (Optional / Already Reflected)

- `schema_full.sql` – full reference schema (users, projects, project_assignments, project_documents, analysis_records, eligibility_checklist, file_cache).
- `migrations/add_org_quota_and_transactions.sql` – org_quota, quota_transactions (also created by SQLAlchemy models).
- `migrations/add_projects_archived.sql`, `add_user_microsoft_tokens.sql`, `add_perf_indexes.sql` – apply if not using init_db + main.py ALTERs.

**Verdict:** Schema is consistent and working. For a fresh deployment, ensure PostgreSQL is running and `init_db()` plus main.py ALTERs run (no manual SQL required if models are up to date).

---

## 2. localStorage vs Database – Audit

### 2.1 Intended Use (Keep in localStorage)

| Key | Purpose | Verdict |
|-----|---------|--------|
| **token** | JWT for API auth | ✅ Keep in localStorage (standard SPA pattern). |
| **user** | Current user payload (id, role, email, mustChangePassword) | ✅ Keep; synced from login/me. |

### 2.2 Backed by Database (API Primary)

| Data | Frontend localStorage Key(s) | Backend Storage | API |
|------|-----------------------------|------------------|-----|
| Project analysis (departmental summaries, product mapping, OEM list) | analysisData | project_documents.analysis_data (JSONB) | GET `/api/rfp/get-project-analysis/{project_name}` |
| OEM selections per product | Inside analysisData → productMapping.oemSelections | Same JSONB; updated in place | POST `/api/rfp/save-product-oem-selections` |
| Current document context | currentDocument, recentRfpAnalysis, selectedDocumentId | Derived from project + document_id | Loaded when fetching analysis by document_id / project_name |

**Flow today:**

- **Upload/analyze:** Backend writes analysis into `project_documents.analysis_data` and returns it; frontend also puts it in `analysisData` / `currentDocument` for quick access.
- **Product Mapping / Build Your Stack:** Frontend loads analysis via **get-project-analysis** (DB), with **localStorage as fallback** for offline or fast reload; OEM selections are saved via **save-product-oem-selections** (DB).

So **critical business data (analysis + OEM selections) is stored in the database**. localStorage is used as a **cache** and for **session context** (current document/project).

### 2.3 Optional / Convenience (Can Stay in localStorage)

| Key | Purpose | Verdict |
|-----|---------|--------|
| **buildYourStack_modelOverrides** | User-typed model overrides when OEM was manually entered | ✅ OK in localStorage (per-device convenience; could later move to DB per user/project if needed). |

### 2.4 Summary: “Proper Database Not LocalStorage”

- **Auth:** token/user in localStorage is correct; backend uses DB for users and sessions.
- **Analysis and OEM selections:** Already in PostgreSQL (`project_documents.analysis_data`). Frontend uses API first and localStorage as cache/fallback.
- **No change required** for deployment from a “use database not localStorage” perspective for core data; optional improvement is to **prefer API everywhere** and treat localStorage only as cache (already the pattern on Product Mapping and Build Your Stack).

---

## 3. API Overview and Status

### 3.1 Auth (`/api/auth`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | /register | Public signup | ✅ |
| POST | /login | Login; returns token, user (incl. mustChangePassword) | ✅ |
| GET | /me | Current user info | ✅ |
| POST | /logout | Logout | ✅ |
| POST | /change-password | Change password (required when mustChangePassword) | ✅ |
| POST | /create-user | Bid Admin creates BM/TM | ✅ |
| GET | /my-team | BM’s TMs / Admin’s BMs | ✅ |
| GET | /team-quota | Team quota (used/limit) | ✅ |
| GET | /admin-dashboard | Full admin dashboard (BMs, TMs, quotas) | ✅ |
| DELETE | /delete-user/{user_id} | Bid Admin delete user | ✅ |

### 3.2 RFP / Projects (`/api/rfp`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | /analyze | Upload RFP; create/update project; store analysis in project_documents | ✅ |
| GET | /projects | List projects (role-filtered) | ✅ |
| GET | /projects/archived | List archived projects | ✅ |
| POST | /projects/{id}/archive | Archive project | ✅ |
| POST | /projects/{id}/unarchive | Unarchive project | ✅ |
| GET | /get-project-analysis/{project_name} | Get analysis from DB (by document_id or type) | ✅ |
| POST | /save-product-oem-selections | Save OEM selections into project_documents.analysis_data | ✅ |
| GET | /get-project-documents/{project_name} | List documents for project | ✅ |
| GET | /project-assignments/{project_name} | Get assigned users | ✅ |
| POST | /project-assignments/{project_name} | Set assigned users | ✅ |
| GET | /project-status/{project_name} | Project status | ✅ |
| GET | /team-member-assignments | Admin/BM: TM assignments | ✅ |
| GET | /assignable-users | Users that can be assigned | ✅ |
| GET | /document/{file_hash} | Get document file | ✅ |
| POST | /get-sources | Sources for reference | ✅ |
| GET | /eligibility-checklist/{project_name} | Get checklist | ✅ |
| POST | /eligibility-checklist/{project_name} | Save checklist | ✅ |
| PATCH | /eligibility-checklist/.../item | Update item | ✅ |
| POST | /enrich-oems | OEM enrichment | ✅ |
| GET | /health | Health check | ✅ |

### 3.3 Payment (`/api/payment`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | /recharge-total | Recharge totals | ✅ |
| GET | /config | Payment config (e.g. client id) | ✅ |
| POST | /add-quota | Add quota (admin) | ✅ |
| POST | /create-order | Create PayPal order | ✅ |
| POST | /capture-order | Capture PayPal order | ✅ |

### 3.4 Admin (`/api/admin`)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | /reset-quota-and-projects | Reset quota and projects (dev) | ✅ |

### 3.5 Reference API (Not Mounted)

- **api/reference_routes.py** defines POST `/exact-match` and POST `/exact-matches`. This router is **not** included in **main.py**, so these endpoints are **not exposed**. No frontend usage found. If you need them, add in main.py:  
  `from api.reference_routes import router as reference_router`  
  and  
  `app.include_router(reference_router, prefix="/api/reference", tags=["Reference"])`.

---

## 4. Deployment Readiness Summary

### 4.1 What’s Ready

- **Database:** Core schema (users, projects, project_documents, project_assignments, org_quota, quota_transactions, eligibility_checklist, file_cache, etc.) is defined and created via init_db + startup ALTERs.
- **Persistence:** Analysis and OEM selections are stored in PostgreSQL (`project_documents.analysis_data`); APIs read/write this.
- **Auth:** JWT + users table; role-based access; change-password flow.
- **APIs:** Auth, RFP, projects, assignments, payments, admin, and health are implemented and wired.
- **Frontend:** Uses API for analysis and OEM save; localStorage as cache/session only.

### 4.2 Recommended Before Production

1. **Environment**
   - Set `CORS_ORIGINS` to your frontend origin(s).
   - Set `FRONTEND_URL` (and optionally `LOGO_URL`) for emails and links.
   - Use strong `SECRET_KEY` (or equivalent) and secure DB credentials.
   - Configure PayPal env vars if using payments.

2. **Database**
   - Run app once against production DB so `init_db()` and main.py ALTERs run.
   - If you use migrations, ensure `org_quota` has one row (id=1) and any migration for `unarchive_quota_used` is applied.

3. **Optional**
   - Mount **reference_routes** in main.py if you need exact-match APIs.
   - Add rate limiting / request size limits for production.
   - Ensure `/health` is used by your orchestrator/load balancer.

### 4.3 Readiness Score (Qualitative)

| Area | Score | Comment |
|------|--------|--------|
| Database schema | **95%** | Core tables and init path solid; optional migrations for edge cases. |
| Data in DB vs localStorage | **90%** | Core data in DB; localStorage used correctly as cache/session. |
| API coverage | **95%** | All main flows covered; reference router not mounted. |
| Auth & security | **85%** | JWT + roles; ensure env and secrets are production-ready. |
| Deployment config | **80%** | CORS, FRONTEND_URL, DB, and optional PayPal need production values. |

**Overall: Ready for deployment** once environment and DB are configured and reference API is mounted only if needed.

---

## 5. Quick Checklist

- [ ] PostgreSQL running and `DATABASE_URL` (or POSTGRES_*) set in production.
- [ ] `init_db()` and startup ALTERs run (start app once).
- [ ] `CORS_ORIGINS` and `FRONTEND_URL` set for production.
- [ ] Secret keys and credentials not default/dev.
- [ ] (Optional) Mount reference_routes if exact-match is required.
- [ ] (Optional) Run `schema_full.sql` or migrations if not relying only on init_db.

---

*End of report.*
