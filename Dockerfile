# ============================================
# Bid Intelligence — Multi-stage Dockerfile
# Builds Frontend (React/Vite) + Backend (FastAPI), single image
# ============================================

# ---------- Stage 1: Build Frontend ----------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/Frontend

# Install dependencies
COPY Frontend/package.json Frontend/package-lock.json* ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# Copy frontend source and build
COPY Frontend/ .
# Optional: set API URL at build time (e.g. for production domain)
ARG VITE_API_BASE_URL=
ARG VITE_API_PORT=8001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_PORT=$VITE_API_PORT
RUN npm run build

# ---------- Stage 2: Backend + serve frontend ----------
FROM python:3.12-slim

WORKDIR /app

# Install system deps if needed (e.g. for PDF/image libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Backend Python dependencies
COPY Backend_py/requirements.txt ./Backend_py/
RUN pip install --no-cache-dir -r Backend_py/requirements.txt

# Copy backend code
COPY Backend_py/ ./Backend_py/

# Copy frontend build from stage 1 (backend expects ../frontend-build from Backend_py)
COPY --from=frontend-builder /app/Frontend/dist ./frontend-build

# Create dirs for uploads and data
RUN mkdir -p Backend_py/uploads Backend_py/data Backend_py/static

# Env defaults (override with -e or .env mount)
ENV PORT=8001
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

WORKDIR /app/Backend_py
CMD ["python", "main.py"]
