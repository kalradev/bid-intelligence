@echo off
echo ========================================
echo Starting Bid Intelligence.ai Backend
echo ========================================
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Please create it first by running: python -m venv venv
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if main.py exists
if not exist "main.py" (
    echo ERROR: main.py not found!
    echo Please make sure you're in the Backend_py directory.
    pause
    exit /b 1
)

echo.
echo Starting FastAPI server on port 3000...
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

REM Start the server
python main.py

pause

