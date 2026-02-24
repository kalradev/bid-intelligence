# How to Start the Backend Server

## Quick Start (Windows)

1. **Double-click `start_backend.bat`** in the `Backend_py` folder

   OR

2. **Open PowerShell/Terminal in `Backend_py` folder** and run:
   ```bash
   start_backend.bat
   ```

## Manual Start

1. **Navigate to Backend_py directory:**
   ```bash
   cd Backend_py
   ```

2. **Activate virtual environment:**
   ```bash
   venv\Scripts\activate
   ```

3. **Start the server:**
   ```bash
   python main.py
   ```

   OR using uvicorn directly:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Verify Backend is Running

Once started, you should see:
```
✅ Routes registered:
   - /api/rfp
   - /api/reference
   - /api/auth (login, register, me, logout)
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Test the connection:**
- Open browser: http://localhost:8000/
- Health check: http://localhost:8000/health

## Troubleshooting

### Port 8000 Already in Use
If you see "Address already in use", either:
1. Stop the process using port 8000
2. Change the port in `Backend_py/.env` (PORT=8000) and set `VITE_API_PORT` in Frontend `.env` to match

### Database Connection Error
Make sure:
- PostgreSQL is running
- Database credentials in `.env` file are correct
- Database "Bid " exists (with space)

### Virtual Environment Not Found
Create it:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Default Configuration

- **Port:** 8000 (must match frontend; set PORT in .env to override)
- **Host:** 0.0.0.0 (accessible from all network interfaces)
- **Database:** PostgreSQL on localhost:5432
- **Database Name:** "Bid " (with space)

