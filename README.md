# JC's Auto & Mechanical Engineering (Pty) Ltd - Workshop Management System

A comprehensive, South African automotive workshop management platform built with React, TypeScript, Tailwind CSS, Recharts, and jsPDF. Engineered specifically for SARS tax compliance (15% VAT, Section 29/30 cryptographic SHA-256 audit trails, EMP201 PAYE & UIF payroll, and SBC turnover tax regimes).

---

## 🏎 Core Modules & Capabilities

- **Quotes & Invoices Module**:
  - Live VAT calculation (Standard 15% VAT & Small Business Corporation options).
  - One-click print-ready A4 PDF invoice and quote generator.
  - "Send to Customer" email workflow with pre-filled `mailto:` templates, banking details, and portal instructions.
- **Client & Fleet Portal**:
  - Vehicle service history logbook and chronological master timeline.
  - Interactive **Recharts Vehicle Mileage Progression & Maintenance Frequency Visualizer** (odometer trajectory, interval delta, and milestone projections).
  - Dynamic service reminder engine with 15,000 km threshold alerts.
- **Job-by-Job Profitability & Analytics**:
  - Real-time gross profit margin tracking, labor vs. parts cost breakdown, and top-performing service rankings.
- **Inventory & Stock Management**:
  - Auto-reorder warnings, stock movement ledger, SKU and OEM number tracking.
- **SARS Tax & Payroll Module**:
  - Monthly EMP201 PAYE (2025/2026 tax tables with age rebates) and 1% UIF employee/employer deduction calculations.
  - Section 29 & 30 SARS 5-Year immutable cryptographic audit ledger with verification hashes.
- **Daily Cash Register & Petty Cash**:
  - Float management, cash in/out tracking, and end-of-day reconciliation.

---

## 💻 Installing on Your Local PC

For detailed instructions, see **[`INSTALL.md`](./INSTALL.md)**.

### Windows (1-Click Installer)
- Double-click **`install-windows.bat`** (or **`start-windows.bat`**).
- Access at: `http://localhost:3000`

### macOS / Linux
```bash
chmod +x ./install-mac-linux.sh ./start-mac-linux.sh
./install-mac-linux.sh
```

### Docker
```bash
docker compose up -d
```

---

## 📦 Tech Stack
- **Framework**: React 19 + TypeScript + Vite 6
- **Styling**: Tailwind CSS v4
- **Charts & Visualizations**: Recharts
- **PDF Generation**: jsPDF + jsPDF-AutoTable
- **Icons**: Lucide React
- **Animations**: Motion
