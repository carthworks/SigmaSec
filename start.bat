@echo off
setlocal enabledelayedexpansion

title SigmaSec Security Platform - Launcher
color 0A

echo ===============================================================================
echo           SIGMASEC SECURITY PLATFORM LAUNCHER
echo ===============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%"

echo [1/4] Checking prerequisites...

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo Please install Docker Desktop and start it.
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker daemon is not running.
    echo Please start Docker Desktop and wait until it is ready.
    pause
    exit /b 1
)

echo   - Docker is running.

if not exist "%ROOT_DIR%backend\.env" (
    echo   - backend\.env not found. Creating from backend\.env.example...
    copy "%ROOT_DIR%backend\.env.example" "%ROOT_DIR%backend\.env" >nul
)

if not exist "%ROOT_DIR%frontend\platform-ui\.env.local" (
    if exist "%ROOT_DIR%frontend\platform-ui\.env.local.example" (
        echo   - frontend\.env.local not found. Creating from example...
        copy "%ROOT_DIR%frontend\platform-ui\.env.local.example" "%ROOT_DIR%frontend\platform-ui\.env.local" >nul
    )
)

echo.
echo [2/4] Starting backend services (Postgres, Redis, MinIO, Celery, API)...
cd /d "%ROOT_DIR%"
docker compose up -d

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker containers.
    pause
    exit /b 1
)

echo.
echo [3/4] Waiting 5 seconds for backend to stabilize...
timeout /t 5 /nobreak >nul

echo.
echo [4/4] Starting frontend development server (Next.js)...
start "SigmaSec Frontend Dev Server" cmd /k "cd /d "%~dp0frontend\platform-ui" && npm run dev"

echo.
echo ===============================================================================
echo   All services launched!
echo ===============================================================================
echo.
echo   - Frontend:  http://localhost:3000
echo   - Backend:   http://localhost:8000/docs
echo   - MinIO UI:  http://localhost:9001  (minioadmin / minioadmin)
echo.
echo   Demo Login:
echo   - Admin:   admin@sigmasec.com  / Admin@12345!
echo   - Analyst: analyst@sigmasec.com / Analyst@12345!
echo.
echo   To stop all services, run stop.bat
echo ===============================================================================
echo.

set /p OPEN_BROWSER="Do you want to open the Frontend UI in your browser now? (Y/N, default Y): "
if /i "%OPEN_BROWSER%"=="" set OPEN_BROWSER=Y
if /i "%OPEN_BROWSER%"=="Y" (
    start http://localhost:3000
)

echo.
echo To stop all services later, run stop.bat or execute: docker compose down
echo.
pause
