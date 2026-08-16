@echo off
setlocal enabledelayedexpansion

title JC's Workshop ZA - Automated PC Installer & Launcher

echo ====================================================================
echo         JC's Auto ^& Mechanical Engineering (Pty) Ltd
echo         Automated PC Installation ^& Setup Script
echo ====================================================================
echo.

:: 1. Check if Node.js is installed
echo [1/4] Checking for Node.js runtime on this PC...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not detected on your PC!
    echo.
    echo Please install Node.js (Version 18 or higher):
    echo 1. Open your browser and visit: https://nodejs.org/
    echo 2. Download and install the recommended "LTS" version.
    echo 3. During installation, ensure the option "Add to PATH" is checked.
    echo 4. Restart this installer script after installing Node.js.
    echo.
    echo Opening Node.js download page in your browser...
    start https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [OK] Node.js is installed (%NODE_VERSION%)
echo.

:: 2. Check if npm is installed
echo [2/4] Checking for npm package manager...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in your PATH. Please reinstall Node.js LTS.
    pause
    exit /b 1
)
echo [OK] npm is available.
echo.

:: 3. Install required dependencies
echo [3/4] Installing workshop application dependencies...
echo (This may take 1-2 minutes on the first installation)
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm install encountered an issue. Trying with --legacy-peer-deps...
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo [FATAL] Failed to install npm dependencies. Please check your internet connection.
        pause
        exit /b 1
    )
)
echo.
echo [OK] All dependencies installed successfully!
echo.

:: 4. Launch the application
echo [4/4] Starting JC's Workshop ZA local server...
echo.
echo ====================================================================
echo   Server is running at: http://localhost:3000
echo   Opening application in your default browser...
echo   (Press CTRL+C in this command window to stop the server)
echo ====================================================================
echo.

:: Open browser after 2 seconds delay in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Start the Vite development server
call npm run dev

pause
