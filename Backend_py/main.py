from pathlib import Path
import sys

# Ensure Backend_py is on path so "data" and other packages resolve correctly when run from any cwd
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

# Load .env from Backend_py so password/port are correct
_env_file = _backend_dir / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)

from fastapi import FastAPI, Request, HTTPException, Path as FPath, APIRouter, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import logging
import time
import asyncio
import os

from core.config import settings
from core.sqlalchemy_db import init_db
from api.rfp_routes import router as rfp_router
from api.auth_routes import router as auth_router
from api.payment_routes import router as payment_router
from api.admin_routes import router as admin_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Bid Intelligence.ai API",
    description="Python Backend for RFP Analysis",
    version="1.0.0"
)

# CORS Middleware - use CORS_ORIGINS from env for deployment
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if not _cors_origins:
    _cors_origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"Method: {request.method} Path: {request.url.path} Status: {response.status_code} Duration: {duration:.2f}s")
    return response

# Exception Handler for HTTPException (FastAPI's built-in)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions and format them for frontend"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "detail": exc.detail,
            "message": exc.detail,
            "error": exc.detail
        }
    )

# Exception Handler for general exceptions
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Handle cancellation errors gracefully (user stopped the request)
    if isinstance(exc, asyncio.CancelledError):
        logger.info(f"Request cancelled: {request.method} {request.url.path}")
        return JSONResponse(
            status_code=499,  # Client Closed Request
            content={"success": False, "error": "Request cancelled", "message": "Analysis was cancelled"}
        )
    
    logger.error(f"Global Exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc), "message": "An unexpected error occurred"}
    )

# Initialize PostgreSQL tables on startup (creates if not exist)
try:
    init_db()
except Exception as e:
    logger.warning(f"⚠️ Could not init DB tables (ensure PostgreSQL is running): {e}")

# Ensure projects.archived column exists (Bid Admin archive feature)
try:
    from core.sqlalchemy_db import engine
    from sqlalchemy import text
    org_quota_base = getattr(settings, "ORG_QUOTA_BASE", 10)
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE org_quota ADD COLUMN IF NOT EXISTS unarchive_quota_used INTEGER DEFAULT 0 NOT NULL"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE"))
        # Sync org quota base limit from config (.env ORG_QUOTA_BASE) so env changes take effect after restart
        conn.execute(text("UPDATE org_quota SET base_limit = :base WHERE id = 1"), {"base": org_quota_base})
        conn.commit()
    logger.info("✅ projects.archived column ready; org quota base_limit synced to %s", org_quota_base)
except Exception as e:
    logger.warning(f"⚠️ Could not add projects.archived column: {e}")

# Register Routes
app.include_router(rfp_router, prefix="/api/rfp", tags=["RFP"])
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(payment_router, prefix="/api/payment", tags=["Payment"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])

# Serve static files from frontend build (if exists)
# Check both Backend_py parent directory and current directory
FRONTEND_BUILD_PATH = os.path.join(settings.BASE_DIR, "..", "frontend-build")
FRONTEND_BUILD_PATH_ALT = os.path.join(settings.BASE_DIR, "frontend-build")

if os.path.exists(FRONTEND_BUILD_PATH):
    FRONTEND_DIR = FRONTEND_BUILD_PATH
elif os.path.exists(FRONTEND_BUILD_PATH_ALT):
    FRONTEND_DIR = FRONTEND_BUILD_PATH_ALT
else:
    FRONTEND_DIR = None

if FRONTEND_DIR:
    # Mount static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")
    
    # Serve static files from root of frontend-build (path excludes "api/" so API routes are never matched here)
    @app.get("/{path:path}")
    async def serve_frontend(path: str = FPath(..., pattern=r"^(?!api/).*"), request: Request = None):
        if path == "health":
            raise HTTPException(status_code=404, detail="Not found")
        file_path = os.path.join(FRONTEND_DIR, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # For React Router - serve index.html for all routes
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        
        raise HTTPException(status_code=404, detail="Not found")

logger.info("✅ Routes registered:")
logger.info("   - /api/rfp (includes GET /api/rfp/team-member-assignments)")
logger.info("   - /api/auth (login, register, me, logout)")
if os.path.exists(FRONTEND_BUILD_PATH):
    logger.info("   - Frontend static files: enabled")

@app.get("/")
async def root():
    return {
        "message": "Bid Intelligence.ai - RFP Analysis API (Python)",
        "version": "1.0.0",
        "endpoints": {
            "analyze": "POST /api/rfp/analyze",
            "health": "GET /api/rfp/health"
        }
    }

@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    try:
        # Test PostgreSQL connection
        from core.sqlalchemy_db import test_connection
        if test_connection():
            db_status = "connected (PostgreSQL)"
        else:
            db_status = "disconnected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ok",
        "service": "Bid Intelligence.ai API",
        "database": db_status,
        "database_type": "PostgreSQL",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)
