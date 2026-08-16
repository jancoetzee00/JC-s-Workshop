#!/usr/bin/env bash

# ==============================================================================
# JC's Auto & Mechanical Engineering (Pty) Ltd
# Quick Daily Launcher for macOS and Linux
# ==============================================================================

set -e

echo "===================================================================="
echo "        JC's Auto & Mechanical Engineering (Pty) Ltd"
echo "                       Quick Launcher"
echo "===================================================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed! Please run ./install-mac-linux.sh first."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[INFO] node_modules not found. Installing dependencies first..."
    npm install
fi

echo "Starting Workshop application server..."
echo "Server running at: http://localhost:3000"
echo ""

# Open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 2 && open "http://localhost:3000") &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    (sleep 2 && xdg-open "http://localhost:3000" 2>/dev/null || true) &
fi

npm run dev
