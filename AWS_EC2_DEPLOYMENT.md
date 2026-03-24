# Bid Intelligence — AWS EC2 Deployment Reference

This document lists **ports**, **API routes**, **frontend routes**, **environment variables**, and **related configuration** used when deploying the Bid Intelligence application on **AWS EC2**.

---

## 1. Ports

| Service | Port | Notes |
|--------|------|--------|
| **Backend (FastAPI)** | `8001` (default in repo) or `8000` | Set via `PORT` in `Backend_py/.env`. App listens on `0.0.0.0:PORT`. |
| **Frontend (Vite dev)** | `5173` | Only for local dev. On EC2 you serve the built static files (see below). |
| **PostgreSQL** | `5432` | Set via `POSTGRES_PORT` in `.env`. Can be on same EC2 or RDS. |
| **Nginx (recommended on EC2)** | `80` / `443` | Reverse proxy: 80/443 → backend (e.g. 8001) and/or static frontend. |

**Important:** The frontend is configured to call the backend at **port 8001** by default (`Frontend/src/config.ts`, `Frontend/vite.config.ts`). If you run the backend on a different port, set `VITE_API_PORT` (and/or `VITE_API_BASE_URL`) when building the frontend, and ensure your proxy/security groups allow that port.

---

## 2. Backend API Routes (FastAPI)

Base URL: `http://<EC2-host-or-domain>:<PORT>` (e.g. `http://your-ec2-ip:8001`).

### Root & Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info and version |
| GET | `/health` | Health check (includes DB status) |

### Auth — prefix `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user (requires Bearer token) |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/create-user` | Create user (Bid Admin) |
| GET | `/api/auth/my-team` | My team (Bid Manager) |
| GET | `/api/auth/team-quota` | Team quota |
| GET | `/api/auth/admin-dashboard` | Bid Admin dashboard |
| DELETE | `/api/auth/delete-user/{user_id}` | Delete user (Bid Admin) |

### RFP — prefix `/api/rfp`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/rfp/analyze` | Upload & analyze RFP documents |
| POST | `/api/rfp/enrich-oems` | Enrich OEMs |
| GET | `/api/rfp/projects` | List projects |
| GET | `/api/rfp/projects/archived` | List archived projects |
| POST | `/api/rfp/projects/{project_id}/archive` | Archive project |
| POST | `/api/rfp/projects/{project_id}/unarchive` | Unarchive project |
| GET | `/api/rfp/team-member-assignments` | Team member assignments |
| GET | `/api/rfp/assignable-users` | Assignable users |
| GET | `/api/rfp/project-assignments/{project_name}` | Project assignments |
| POST | `/api/rfp/project-assignments/{project_name}` | Save project assignments |
| GET | `/api/rfp/project-status/{project_name}` | Project status |
| GET | `/api/rfp/get-project-analysis/{project_name}` | Project analysis |
| POST | `/api/rfp/save-product-oem-selections` | Save product/OEM selections |
| GET | `/api/rfp/get-project-documents/{project_name}` | Project documents |
| GET | `/api/rfp/document/{file_hash}` | Document by hash |
| POST | `/api/rfp/get-sources` | Get sources |
| GET | `/api/rfp/eligibility-checklist/{project_name}` | Eligibility checklist |
| POST | `/api/rfp/eligibility-checklist/{project_name}` | Create/update checklist |
| PATCH | `/api/rfp/eligibility-checklist/{project_name}/item` | Update checklist item |
| GET | `/api/rfp/health` | RFP service health |

### Payment — prefix `/api/payment`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payment/recharge-total` | Recharge total (Bid Admin) |
| GET | `/api/payment/config` | PayPal config (Bid Admin) |
| POST | `/api/payment/add-quota` | Add quota (Bid Admin) |
| POST | `/api/payment/create-order` | Create PayPal order |
| POST | `/api/payment/capture-order` | Capture PayPal order |

### Admin — prefix `/api/admin`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/reset-quota-and-projects` | Reset quota and projects (Bid Admin) |

---

## 3. Frontend Routes (React Router)

These are client-side routes. On EC2, either serve the **built** frontend from the backend (see `main.py`: `frontend-build`) or serve the build with **Nginx** and point API requests to the backend.

| Path | Page / Purpose |
|------|-----------------|
| `/` | Login |
| `/login` | Login |
| `/change-password` | Change password (required for some users) |
| `/home` | Landing (role-based dashboard) |
| `/upload` | Upload & analyze RFP |
| `/insights` | Insights / analysis view |
| `/smart-rfp` | Smart RFP |
| `/cost-estimation` | Cost estimation |
| `/product-mapping` | Product mapping |
| `/global-intelligence` | Global intelligence |
| `/technical` | Technical |
| `/bid-management` | Bid management |
| `/team` | Team (Bid Admin / Bid Manager) |
| `/project-results/:projectName` | Project results |
| `/team-projects/:bidManagerId` | Team projects |
| `/account` | Account |
| `/team-quota` | Team quota |
| `/document-viewer` | Document viewer |
| `/commercial` | Commercial |
| `/finance` | Finance |
| `/legal` | Legal |
| `/scm` | SCM |

---

## 4. Environment Variables (Backend — `Backend_py/.env`)

Used for deployment; keep secrets out of version control.

### Required for Core
| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend server port | `8001` or `80` (if behind Nginx) |
| `POSTGRES_HOST` | PostgreSQL host | `localhost` or RDS endpoint |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_USER` | PostgreSQL user | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | (your password) |
| `POSTGRES_DB` | Database name | `Bid` or `Bid2` |
| `JWT_SECRET` | JWT signing secret | Long random string (e.g. `openssl rand -hex 32`) |
| `OLLAMA_BASE_URL` | Ollama API base URL (e.g. `http://host:11434`) | (for AI analysis) |
| `OLLAMA_MODEL` | Model name on Ollama host | e.g. `llama3.2` |

### Optional but Recommended
| Variable | Description | Example |
|----------|-------------|---------|
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `https://yourdomain.com` or `*` (dev only) |
| `GEMINI_API_KEY` | Gemini API key | If using Gemini |
| `NODE_ENV` | Environment | `production` |
| `MAX_FILE_SIZE_MB` | Max upload size (MB) | `50` |

### Email (Welcome / Credentials)
| Variable | Description | Example |
|----------|-------------|---------|
| `FRONTEND_URL` | Public URL of frontend | `https://yourdomain.com` |
| `EMAIL_LOGO_URL` or `LOGO_URL` | Logo URL for emails | `https://yourdomain.com/assets/email-logo.png` |
| `MICROSOFT_CLIENT_ID` | Azure app (Mail.Send) | (optional) |
| `MICROSOFT_CLIENT_SECRET` | Azure app secret | (optional) |
| `MICROSOFT_TENANT_ID` | Azure tenant | (optional) |
| `MICROSOFT_MAILBOX` | Sender mailbox | (optional) |

### Payments (Bid Admin)
| Variable | Description | Example |
|----------|-------------|---------|
| `PAYPAL_MODE` | `sandbox` or `live` | `live` in production |
| `PAYPAL_CLIENT_ID` | PayPal client ID | (optional) |
| `PAYPAL_CLIENT_SECRET` | PayPal client secret | (optional) |

### Quota
| Variable | Description | Example |
|----------|-------------|---------|
| `ORG_QUOTA_BASE` | Base project quota | `25` |

### Optional
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full PostgreSQL URL (overrides individual POSTGRES_* if set) |
| `MONGODB_STRING` | MongoDB connection (if used) |
| `CHATBOT_API_URL` | External chatbot API URL |
| `PROCESSING_VERSION` | Internal versioning |

---

## 5. Frontend Build / API URL (for EC2)

- **Build:** From repo root, run `cd Frontend && npm ci && npm run build`. Output: `Frontend/dist` (or as in your Vite config).
- **Backend URL:** The app uses `API_BASE_URL` from `Frontend/src/config.ts`, which reads:
  - `VITE_API_PORT` (default **8001** in repo)
  - `VITE_API_HOST` (optional)
  - `VITE_API_BASE_URL` (optional full URL)
- For **production**, either:
  - Build with env: `VITE_API_BASE_URL=https://api.yourdomain.com` (or same host as frontend, e.g. `https://yourdomain.com` if API is proxied there), or
  - Build with `VITE_API_HOST` and `VITE_API_PORT` so the browser calls the correct backend.
- **Vite proxy** (`vite.config.ts`) is for **dev only**; production uses the above env at build time.

---

## 6. Static Files & Single-Server Option

- **Backend** can serve the frontend build: place the built output in `frontend-build/` next to `Backend_py/` (or path set in `main.py`). Then:
  - `GET /` and non-API paths serve the SPA (index.html or static assets).
  - `GET /assets/*` serves frontend assets.
  - API routes stay under `/api/`.
- **Health:** `GET /health` and `GET /` are safe for load balancer health checks.

---

## 7. AWS EC2 Checklist (Summary)

1. **Security groups:** Allow inbound for backend port (e.g. 8001), 80/443 if using Nginx, and 5432 only from backend (or same VPC) if PostgreSQL is on EC2.
2. **.env on EC2:** Create `Backend_py/.env` with the variables above; do not commit it.
3. **PostgreSQL:** Install and run locally, or use RDS; run migrations/setup (e.g. schema, `create_bid_admin.py`).
4. **Run backend:** e.g. `cd Backend_py && python main.py` or `uvicorn main:app --host 0.0.0.0 --port 8001`.
5. **Frontend:** Build with correct `VITE_API_BASE_URL` (or host/port), then either serve from backend's `frontend-build` or via Nginx.
6. **CORS:** Set `CORS_ORIGINS` to your frontend origin(s) in production.
7. **HTTPS:** Put Nginx (or ALB) in front; terminate SSL and proxy to backend (and optionally serve frontend).

---

## 8. Docker

A **Dockerfile** is provided at the project root for a single image (frontend build + backend).

**Build (from project root):**
```bash
docker build -t bid-intelligence:latest .
```

**Build with production API URL (if frontend must call a specific domain):**
```bash
docker build --build-arg VITE_API_BASE_URL=https://yourdomain.com -t bid-intelligence:latest .
```

**Run (pass env vars or mount `.env`):**
```bash
docker run -p 8001:8001 \
  -e POSTGRES_HOST=host.docker.internal \
  -e POSTGRES_PASSWORD=yourpassword \
  -e JWT_SECRET=your-secret \
  -e OLLAMA_BASE_URL=http://your-ollama-host:11434 \
  -e OLLAMA_MODEL=llama3.2 \
  bid-intelligence:latest
```

Or mount `Backend_py/.env` (do not commit it):
```bash
docker run -p 8001:8001 -v $(pwd)/Backend_py/.env:/app/Backend_py/.env:ro bid-intelligence:latest
```

PostgreSQL must be reachable from the container (e.g. host network, or `POSTGRES_HOST` set to Docker host or RDS).
