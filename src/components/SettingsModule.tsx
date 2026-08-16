import React, { useState } from 'react';
import {
  Settings,
  Building,
  ShieldCheck,
  CreditCard,
  Phone,
  Database,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  Monitor,
  Terminal,
  FileCode,
  Check,
  Copy,
  FolderDown,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WorkshopSettings } from '../types';
import { exportAllDataAsJSON, resetAllDataToDefault } from '../utils/storage';

interface SettingsModuleProps {
  settings: WorkshopSettings;
  onSaveSettings: (settings: WorkshopSettings) => void;
  onResetData: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  settings,
  onSaveSettings,
  onResetData,
}) => {
  const [formData, setFormData] = useState<WorkshopSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const handleDownloadFile = (filename: string, content: string, mimeType: string = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWindowsInstaller = () => {
    const script = `@echo off
setlocal enabledelayedexpansion

title JC's Workshop ZA - Automated PC Installer & Launcher

echo ====================================================================
echo         JC's Auto ^& Mechanical Engineering (Pty) Ltd
echo         Automated PC Installation ^& Setup Script
echo ====================================================================
echo.

:: 1. Check Node.js
echo [1/4] Checking for Node.js runtime on this PC...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not detected on your PC!
    echo Please install Node.js LTS from: https://nodejs.org/
    start https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [OK] Node.js is installed (%NODE_VERSION%)
echo.

:: 2. Check npm
echo [2/4] Checking for npm package manager...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found.
    pause
    exit /b 1
)
echo [OK] npm is available.
echo.

:: 3. Install dependencies
echo [3/4] Installing workshop application dependencies...
call npm install
if %errorlevel% neq 0 (
    call npm install --legacy-peer-deps
)
echo.
echo [OK] All dependencies installed successfully!
echo.

:: 4. Launch
echo [4/4] Starting JC's Workshop ZA local server...
echo Server running at: http://localhost:3000
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
call npm run dev
pause
`;
    handleDownloadFile('install-windows.bat', script);
  };

  const downloadWindowsQuickLauncher = () => {
    const script = `@echo off
title JC's Workshop ZA - Quick Launcher
echo Starting Workshop application server...
echo Server running at: http://localhost:3000
if not exist "node_modules\\" (
    call npm install
)
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
call npm run dev
pause
`;
    handleDownloadFile('start-windows.bat', script);
  };

  const downloadMacLinuxScript = () => {
    const script = `#!/usr/bin/env bash
set -e
echo "Starting JC's Workshop ZA local server..."
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi
npm install || npm install --legacy-peer-deps
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 2 && open "http://localhost:3000") &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    (sleep 2 && xdg-open "http://localhost:3000" 2>/dev/null || true) &
fi
npm run dev
`;
    handleDownloadFile('start-mac-linux.sh', script, 'application/x-sh');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);

    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.8 },
    });
  };

  const handleBackupExport = () => {
    const jsonStr = exportAllDataAsJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `JCs_Workshop_ZA_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleResetData = () => {
    if (window.confirm('Are you sure you want to wipe all records and start from clean zero? (All invoices, quotes, inventory, clients, payrolls, and transactions will be cleared). Workshop company configuration will be kept.')) {
      resetAllDataToDefault();
      onResetData();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Workshop Settings & SARS Compliance Configuration</span>
          </h1>
          <p className="text-slate-500 text-sm">
            Company registration, 15% VAT, banking details for invoice headers, and database backups
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center space-x-1.5 text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-xl border border-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved Successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Legal Entity & SARS Registration Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Legal Entity & SARS Registrations</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trading Name *</label>
              <input
                type="text"
                required
                value={formData.workshopName}
                onChange={e => setFormData({ ...formData, workshopName: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">CIPC Company Registration # *</label>
              <input
                type="text"
                required
                value={formData.companyRegNumber}
                onChange={e => setFormData({ ...formData, companyRegNumber: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">SARS VAT Registration Number (15%) *</label>
              <input
                type="text"
                required
                value={formData.vatNumber}
                onChange={e => setFormData({ ...formData, vatNumber: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">SARS Income Tax Reference *</label>
              <input
                type="text"
                required
                value={formData.taxNumber}
                onChange={e => setFormData({ ...formData, taxNumber: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">SARS PAYE / EMP201 Number *</label>
              <input
                type="text"
                required
                value={formData.sarsPayeNumber}
                onChange={e => setFormData({ ...formData, sarsPayeNumber: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department of Labour UIF Number *</label>
              <input
                type="text"
                required
                value={formData.uifNumber}
                onChange={e => setFormData({ ...formData, uifNumber: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
        </div>

        {/* 2. Banking Details for Invoices */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Workshop Banking Details (EFT On Invoices)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name *</label>
              <input
                type="text"
                required
                value={formData.bankName}
                onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Number *</label>
              <input
                type="text"
                required
                value={formData.accountNumber}
                onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Branch Code *</label>
              <input
                type="text"
                required
                value={formData.branchCode}
                onChange={e => setFormData({ ...formData, branchCode: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Type</label>
              <input
                type="text"
                value={formData.accountType}
                onChange={e => setFormData({ ...formData, accountType: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* 3. Workshop Rates & Location Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Building className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Workshop Labor Rates & Contact Info</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Labor Rate (ZAR/hr ex VAT)</label>
              <input
                type="number"
                step="25"
                value={formData.defaultLaborRateExVat}
                onChange={e => setFormData({ ...formData, defaultLaborRateExVat: Number(e.target.value) })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Workshop Contact Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Workshop Contact Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Workshop Physical Address</label>
            <input
              type="text"
              value={formData.physicalAddress}
              onChange={e => setFormData({ ...formData, physicalAddress: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-sm"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* Database Management & Backups */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Database className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Database Backup & Storage</h2>
        </div>

        <p className="text-xs text-slate-400">
          All workshop data is stored securely in your browser's persistent database storage. You can export JSON backups or reset demo data.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleBackupExport}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-4 py-2 rounded-xl text-xs border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Database JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={handleResetData}
            className="flex items-center space-x-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-bold px-4 py-2 rounded-xl text-xs border border-rose-800/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Wipe All Data & Start From Zero</span>
          </button>
        </div>
      </div>

      {/* 🚀 PC Installation & Offline Desktop Launcher Hub */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Direct PC Installation
              </span>
              <span className="text-xs text-slate-500 font-medium">Offline & On-Premises Ready</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center space-x-2">
              <Monitor className="w-5 h-5 text-amber-500" />
              <span>Install & Run Program Directly on Your PC</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Launch the entire workshop management suite natively on Windows, macOS, Linux, or Docker with 1-click automated installers.
            </p>
          </div>

          <div className="flex items-center space-x-1.5 self-start sm:self-auto bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>1-Click Launchers Ready</span>
          </div>
        </div>

        {/* 3 Step Installation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Windows Option */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-black text-xs">
                  W
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Windows (10 / 11)</h3>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Automated batch script checks for Node.js, installs dependencies, launches the server, and opens your browser.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={downloadWindowsInstaller}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download install-windows.bat</span>
              </button>
              <button
                type="button"
                onClick={downloadWindowsQuickLauncher}
                className="w-full bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold py-1.5 px-3 rounded-lg text-[11px] flex items-center justify-center space-x-1.5 transition-colors"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                <span>Download Quick start-windows.bat</span>
              </button>
            </div>
          </div>

          {/* macOS / Linux Option */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                  M/L
                </div>
                <h3 className="font-bold text-slate-900 text-sm">macOS & Linux</h3>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Shell script configures executable permissions, builds local packages, and boots <span className="font-mono text-slate-800">localhost:3000</span>.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={downloadMacLinuxScript}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download start-mac-linux.sh</span>
              </button>
              <div className="bg-slate-900 text-slate-300 font-mono text-[10px] p-2 rounded-lg flex items-center justify-between">
                <span>chmod +x start-mac-linux.sh</span>
                <button
                  type="button"
                  onClick={() => handleCopy('chmod +x start-mac-linux.sh && ./start-mac-linux.sh', 'sh')}
                  className="text-slate-400 hover:text-white p-1"
                >
                  {copiedCmd === 'sh' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Docker Container Option */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-black text-xs">
                  🐳
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Docker (Zero Setup)</h3>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Run natively via Docker Desktop with zero Node.js installation required on the host system.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="bg-slate-900 text-slate-300 font-mono text-[11px] p-2 rounded-lg flex items-center justify-between">
                <span>docker compose up -d</span>
                <button
                  type="button"
                  onClick={() => handleCopy('docker compose up -d', 'docker')}
                  className="text-slate-400 hover:text-white p-1"
                >
                  {copiedCmd === 'docker' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 text-center block">
                Access at: <strong className="text-slate-800 font-mono">http://localhost:3000</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Steps Guide */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
          <h4 className="font-bold text-amber-950 flex items-center space-x-1.5 text-xs">
            <Terminal className="w-4 h-4 text-amber-600" />
            <span>How to export the complete project from Google AI Studio to your PC:</span>
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11px] pl-1">
            <li>Click the <strong>Settings</strong> or <strong>Export / Download as ZIP</strong> button in the Google AI Studio top-right menu to download this entire repository to your computer.</li>
            <li>Extract the ZIP archive to a folder on your PC (e.g. <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">C:\JCs_Workshop_ZA</span>).</li>
            <li>Double-click <strong>install-windows.bat</strong> (Windows) or run <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">./install-mac-linux.sh</span> (Mac/Linux).</li>
            <li>The system will auto-configure everything and immediately open the full workshop dashboard in your browser!</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
