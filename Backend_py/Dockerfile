# Bid Intelligence Backend (FastAPI)
FROM python:3.11-slim

WORKDIR /app

# Install system deps for PDF/text processing (optional; remove if not needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for better layer caching
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads dir (backend writes here at runtime)
RUN mkdir -p uploads data

# Backend listens on this port (override with PORT in .env)
EXPOSE 8000

# Run with 0.0.0.0 so container accepts external connections
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
