# PC Installation & Local Setup Guide
## JC's Auto & Mechanical Engineering (Pty) Ltd Workshop Management System

This guide outlines how to download, install, and run **JC's Workshop ZA** directly on your Windows PC, Mac, Linux, or via Docker for completely offline or on-premises workshop operation.

---

## 🚀 Quick Start (1-Click Automated Setup)

### Option A: Windows PC (Windows 10 / 11)

1. **Prerequisite**: Ensure **[Node.js (LTS Version 18+)](https://nodejs.org/)** is installed on your PC.
2. **Download & Extract**: Extract the downloaded application ZIP folder to your preferred folder (e.g., `C:\JCs_Workshop_ZA`).
3. **Run the Installer**:
   - Double-click **`install-windows.bat`**.
   - The script will automatically verify Node.js, install all dependencies, launch the server, and open **`http://localhost:3000`** in your default web browser.
4. **Daily Launching**:
   - On future days, simply double-click **`start-windows.bat`** (or create a desktop shortcut to it) to immediately boot the workshop system!

---

### Option B: Apple macOS & Linux

1. **Prerequisite**: Install Node.js (v18+) via [nodejs.org](https://nodejs.org/) or via terminal:
   - **macOS**: `brew install node`
   - **Ubuntu/Debian**: `sudo apt update && sudo apt install -y nodejs npm`
2. **Open Terminal** in the project directory:
   ```bash
   chmod +x ./install-mac-linux.sh ./start-mac-linux.sh
   ./install-mac-linux.sh
   ```
3. **Daily Launching**:
   ```bash
   ./start-mac-linux.sh
   ```

---

### Option C: Docker / Docker Desktop (Zero Node.js Required)

If you have **Docker Desktop** installed on your PC:
1. Open your terminal / command prompt in the extracted folder.
2. Run:
   ```bash
   docker compose up -d
   ```
3. Open your browser to: **`http://localhost:3000`**

---

## 🛠 Manual Command Line Installation

If you prefer using standard developer commands:

```bash
# 1. Install all dependencies
npm install

# 2. Start the local server
npm run dev

# 3. Access in browser
# Open: http://localhost:3000
```

To build for production static hosting:
```bash
npm run build
npm run preview
```

---

## 📁 Creating a Desktop Shortcut (Windows)

1. Right-click on **`start-windows.bat`** in the project folder.
2. Select **Send to** > **Desktop (create shortcut)**.
3. On your Desktop, right-click the new shortcut > **Properties**.
4. Rename it to **`JC's Workshop System`**.
5. You can now start the entire workshop management system with one click from your desktop!

---

## 💾 Data Storage, Persistence & Backups

- **Local Storage**: All workshop invoices, quotes, customer fleet records, inventory levels, payroll, and SARS tax audit logs are stored securely in your browser's persistent local storage.
- **Offline Capable**: The app does not require an active internet connection to generate quotes, print invoices, calculate PAYE/UIF, or manage inventory.
- **Backups & Restores**:
  - In the application, navigate to **Settings** > **Database Backups & Data Management**.
  - Click **Download JSON Backup** to save a complete timestamped snapshot of your workshop database.
  - You can restore this backup at any time on any computer.

---

## ❓ Troubleshooting & FAQs

| Issue | Resolution |
|---|---|
| **'node' is not recognized** | Install Node.js LTS from [nodejs.org](https://nodejs.org/) and make sure to tick "Add to PATH" during installation. Restart the installer. |
| **Port 3000 already in use** | Open `package.json` and change `--port=3000` to `--port=3001` (or another free port). |
| **Browser doesn't open automatically** | Manually open your web browser (Google Chrome, Microsoft Edge, Firefox) and navigate to `http://localhost:3000`. |
