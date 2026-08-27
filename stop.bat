@echo off
setlocal enabledelayedexpansion

title SigmaSec Security Platform - Stop Services
color 0C

echo ===============================================================================
echo           SIGMASEC SECURITY PLATFORM - SHUTDOWN
echo ===============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%"

echo [1/2] Stopping frontend dev server...
taskkill /f /fi "WINDOWTITLE eq SigmaSec Frontend Dev Server*" >nul 2>&1
taskkill /f /im node.exe >nul 2>&1

echo.
echo [2/2] Stopping Docker containers...
cd /d "%ROOT_DIR%"
docker compose down

echo.
echo ============================================================
echo           ALL SERVICES HAVE BEEN STOPPED
echo ============================================================
echo.
pause
