@echo off
REM Start script for Flask backend

echo.
echo =========================================
echo Starting Flask Backend Server
echo =========================================
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    echo Please run setup.bat first
    pause
    exit /b 1
)

echo [OK] Virtual environment activated
echo [OK] Starting Flask app on http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start Flask app
python app.py

pause
