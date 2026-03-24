Sure — here is the **full README.md in one copy-paste block** (no explanation outside the block):

---

```markdown
# 📌 Bid-Intelligence.ai — RFP Analysis & Bid Management Platform

Bid-Intelligence.ai is an AI-powered platform that automates the extraction, analysis, and cost estimation of **RFP (Request for Proposal) documents**.  
Users upload bid documents, and the system processes them through AI providers (Ollama / Gemini) to generate summaries, departmental insights, and bid-management support.

---

## 📚 Main Documentation (Start Here)

- `QUICK_START.md` – install, configure AI keys, run backend + frontend, optional PostgreSQL.
- `DEPLOYMENT.md` – **Production deployment guide** - one-click deployment to GitHub and cloud platforms.
- `QUICK_START.md` – Quick deployment reference.
- `IMPLEMENTATION_SUMMARY.md` – technical overview of deterministic BOQ, OEM/model enrichment, and the processing pipeline.
- `SECURITY_MEASURES.md` – security hardening, data handling, and deployment considerations.

You can treat these as the **main docs**; other `.md` files are detailed/internal notes.

## 🚀 Quick Deployment

**One-Click GitHub Deployment:**
1. Push to GitHub → Automated build starts
2. Configure GitHub Secrets (API keys)
3. Download production ZIP from Actions

**Or build locally:**
```bash
# Windows
.\deploy.ps1

# Linux/Mac
./deploy.sh
```

See `DEPLOYMENT.md` for complete instructions.

---

## 🏛 System Architecture Overview

The platform is built with a **React Frontend**, **Express.js Backend**, and **external AI & cloud services**.

---

### 🔹 Frontend Layer

| Module | Purpose |
|--------|---------|
| React SPA | Main user interface |
| UploadPage | Upload RFP documents |
| AnalysisPage | View AI-generated insights |
| BidManagementPage | Track bid requirements & timelines |
| CostEstimationPage | Automated pricing & costing outputs |
| Other Feature Pages | Additional bid-related tools |
| UI Cards & Layout | Modular UI components |
| Navbar & Header | Global navigation |
| AnalysisContext | Central state management for RFP analysis |
| mockAnalysisData | Local testing for analysis UI |

Frontend Flow:
```

User → React SPA → Upload RFP → Fetch AI-generated results → Navigate between insights pages

```

---

### 🔹 Backend Layer

| Component | Purpose |
|----------|---------|
| Express API Server | Core backend |
| uploadMiddleware | Handles PDF / DOCX uploads |
| rfpRoutes | Routing for RFP operations |
| rfpController | Business logic for RFP processing |
| documentExtractor Service | Converts documents to raw text |
| ai_service | Sends extracted text to Ollama for AI analysis |
| errorHandler | Handles backend errors & failed requests |
| .env | Stores API keys and configuration |

Backend Processing Flow:
```

File Upload → Extract Text → Chunk & Process → Ollama Call → Save to DB/Storage → Return JSON Response

```

---

### 🔹 External Integrations

| Service | Purpose |
|--------|---------|
| Ollama | AI-powered summarization and insights (self-hosted) |
| Cloud Storage (S3 or similar) | Stores uploaded documents |
| Auth Provider / OAuth | Authentication (optional) |
| Database | Stores RFP records and AI results |
| File Storage | Persistent PDF/DOCX storage |

---

## 📁 Recommended Folder Structure

```

/frontend
└── src
├── pages
├── components
├── context
├── utils
└── api

/backend
├── controllers
├── routes
├── middleware
├── services
├── models
├── config
└── uploads

.env.example
README.md

````

---

## 🚀 Setup & Running

For complete, up‑to‑date setup instructions (backend, frontend, AI keys, optional PostgreSQL), see **`QUICK_START.md`**.

---

## 🔥 API Endpoints

| Method | Endpoint          | Description                                   |
| ------ | ----------------- | --------------------------------------------- |
| POST   | `/api/rfp/upload` | Upload & trigger RFP processing               |
| GET    | `/api/rfp/:id`    | Fetch AI-generated results for a specific RFP |
| GET    | `/api/health`     | System health check                           |

---

## 🧠 AI Processing Pipeline

1. Extract and clean text from uploaded document
2. Split text into semantic chunks
3. Summarize each chunk using Ollama
4. Merge chunk-summaries into a unified RFP analysis
5. Map analysis to departments / timeline / requirements
6. Store results in database
7. Return JSON to frontend for visualization

---

## 🧩 Tech Stack

| Layer      | Technologies              |
| ---------- | ------------------------- |
| Frontend   | React, Vite, Context API  |
| Backend    | Node.js, Express.js       |
| AI         | OpenAI API                |
| Storage    | AWS S3 or local           |
| Database   | PostgreSQL / MongoDB      |
| Deployment | GitHub Actions / Heroku / Railway / Render / AWS |
| CI/CD | GitHub Actions (automated) |

---

## 🛡 Error Handling & Resilience

* Centralized Express error handler
* File type validation and size limits
* Retry logic for transient Ollama / network errors (optional)
* Environment-based configuration
* Logging for debugging & monitoring

---

## 🗺 Roadmap / Future Enhancements

* Vector search for similar RFPs using embeddings
* Auto-bid response document generator
* Multi-language RFP support
* Google Drive / Dropbox document import
* Supplier / competitor comparison AI insights

---

## 👨‍💻 Contributors

| Name     | Role                   |
| -------- | ---------------------- |
| Dev Team | Full-stack development |

---

If you use or enhance this project, ⭐ starring the repository is appreciated!

```
