@echo off
setlocal enabledelayedexpansion

title JC's Workshop ZA - Quick Launcher

echo ====================================================================
echo         JC's Auto ^& Mechanical Engineering (Pty) Ltd
echo                       Quick Launcher
echo ====================================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please run install-windows.bat first.
    pause
    exit /b 1
)

:: Check if node_modules exists, if not install
if not exist "node_modules\" (
    echo [INFO] First time launch detected. Installing dependencies...
    call npm install
)

echo Starting Workshop application server...
echo Server running at: http://localhost:3000
echo.

:: Open browser after 2 seconds delay
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Start Vite dev server on port 3000
call npm run dev

pause
