@echo off
REM start-all.bat — Launch all three Counsel services in development mode
REM Usage: double-click or run from terminal
REM Assumes: Python 3.12+, Node.js 22+, pnpm installed

title Counsel Platform — All Services

echo ========================================
echo  Starting Counsel Platform Services
echo ========================================
echo.

REM Start AI Service (Python FastAPI)
echo [1/3] Starting AI service (port 8000)...
start "Counsel AI" cmd /c "cd services\ai && python -m uvicorn src.main:app --host 127.0.0.1 --port 8000"
echo   ^> AI service starting... wait ~8s

REM Start Express API (port 3001)
echo [2/3] Starting Express API (port 3001)...
start "Counsel API" cmd /c "node scripts/start-api.mjs"
echo   ^> API service starting... wait ~5s

REM Start Next.js Frontend (port 3000)
echo [3/3] Starting Next.js Frontend (port 3000)...
start "Counsel Web" cmd /c "cd apps\web && npx next dev --port 3000"
echo   ^> Web frontend starting... wait ~15s

echo.
echo ========================================
echo  All services starting!
echo.
echo  AI:    http://localhost:8000/health
echo  API:   http://localhost:3001/api/health
echo  Web:   http://localhost:3000
echo ========================================
echo.
echo Close each window or press Ctrl+C here to stop.

pause
