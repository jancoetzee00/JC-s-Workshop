#!/usr/bin/env bash

# ==============================================================================
# JC's Auto & Mechanical Engineering (Pty) Ltd
# Automated Installation & Setup Script for macOS and Linux
# ==============================================================================

set -e

echo "===================================================================="
echo "        JC's Auto & Mechanical Engineering (Pty) Ltd"
echo "        Automated PC Installation & Setup Script (macOS / Linux)"
echo "===================================================================="
echo ""

# 1. Check for Node.js
echo "[1/4] Checking for Node.js runtime..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "[ERROR] Node.js is not detected on your system!"
    echo ""
    echo "Please install Node.js (Version 18 or higher):"
    echo "- On macOS (Homebrew): brew install node"
    echo "- On Ubuntu/Debian:    sudo apt update && sudo apt install -y nodejs npm"
    echo "- On Fedora:           sudo dnf install -y nodejs npm"
    echo "- Or download from:    https://nodejs.org/"
    echo ""
    exit 1
fi

NODE_VER=$(node -v)
echo "[OK] Node.js is installed ($NODE_VER)"
echo ""

# 2. Check for npm
echo "[2/4] Checking for npm package manager..."
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is not found. Please install npm."
    exit 1
fi
echo "[OK] npm is available ($(npm -v))"
echo ""

# 3. Install dependencies
echo "[3/4] Installing workshop application dependencies..."
npm install || npm install --legacy-peer-deps
echo ""
echo "[OK] Dependencies installed successfully!"
echo ""

# 4. Make start scripts executable
chmod +x ./start-mac-linux.sh 2>/dev/null || true

# 5. Start the server and launch browser
echo "[4/4] Starting JC's Workshop ZA local server..."
echo ""
echo "===================================================================="
echo "  Server is running at: http://localhost:3000"
echo "  Opening application in your default browser..."
echo "  (Press CTRL+C in this terminal window to stop the server)"
echo "===================================================================="
echo ""

# Open browser based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 2 && open "http://localhost:3000") &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    (sleep 2 && xdg-open "http://localhost:3000" 2>/dev/null || true) &
fi

# Run Vite dev server
npm run dev
