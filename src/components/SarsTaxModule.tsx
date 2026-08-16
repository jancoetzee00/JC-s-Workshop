import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Download,
  Calendar,
  FileCheck,
  Percent,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  TrendingUp,
  Building,
  HelpCircle,
  ExternalLink,
  Printer,
  Copy,
  Check,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Layers,
  Table,
  ChevronRight,
  Info,
  Search,
  Lock,
  History,
} from 'lucide-react';
import {
  Invoice,
  FinancialTransaction,
  PayrollRecord,
  WorkshopSettings,
  AuditLogEntry,
} from '../types';
import {
  formatZAR,
  generateSarsVat201,
  generateSarsEmp201,
  calculateAnnualIncomeTax,
  calculateSbcIncomeTax,
  calculateStandardCompanyTax,
  getNextSarsDeadline,
  getUpcomingSarsDeadlines,
} from '../utils/sarsTaxEngine';
import { generateSarsTaxPackPDF, generateVat201DetailedPDF } from '../utils/pdfGenerator';
import { SarsAuditLogView } from './SarsAuditLogView';
import { loadAuditLogs, initializeHistoricalAuditTrailIfEmpty } from '../utils/auditLogger';

interface SarsTaxModuleProps {
  invoices: Invoice[];
  finances: FinancialTransaction[];
  payrolls: PayrollRecord[];
  auditLogs?: AuditLogEntry[];
  settings: WorkshopSettings;
}

export const SarsTaxModule: React.FC<SarsTaxModuleProps> = ({
  invoices = [],
  finances = [],
  payrolls = [],
  auditLogs,
  settings,
}) => {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeFinances = Array.isArray(finances) ? finances : [];
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];

  // Manage audit logs state
  const [internalAuditLogs, setInternalAuditLogs] = useState<AuditLogEntry[]>(() => {
    if (auditLogs && auditLogs.length > 0) return auditLogs;
    const loaded = loadAuditLogs();
    if (loaded.length > 0) return loaded;
    return initializeHistoricalAuditTrailIfEmpty(safeInvoices, safeFinances, safePayrolls);
  });

  useEffect(() => {
    if (auditLogs && auditLogs.length > 0) {
      setInternalAuditLogs(auditLogs);
    } else {
      const current = loadAuditLogs();
      if (current.length > 0) {
        setInternalAuditLogs(current);
      }
    }
  }, [auditLogs, safeInvoices, safeFinances, safePayrolls]);

  // VAT201 Month / Period State
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [periodMode, setPeriodMode] = useState<'single_month' | 'bi_monthly'>('single_month');
  const [biMonthlyPeriod, setBiMonthlyPeriod] = useState<string>('2026-07 to 2026-08');
  
  // Navigation & Drilldown State
  const [activeTaxTab, setActiveTaxTab] = useState<'vat201' | 'itr14' | 'calendar' | 'audit_trail'>('vat201');
  const [vatDrilldownTab, setVatDrilldownTab] = useState<'summary' | 'invoices' | 'expenses'>('summary');
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');
  const [copiedRef, setCopiedRef] = useState(false);

  // Compute live next SARS filing deadline based on today's date
  const nextDeadline = getNextSarsDeadline();
  const allDeadlines = getUpcomingSarsDeadlines() || [];

  // Current effective VAT period string
  const activeVatPeriodKey = periodMode === 'single_month' ? selectedMonth : biMonthlyPeriod;

  // Compute VAT201 Return for Selected Period
  const vatReturn = generateSarsVat201(activeVatPeriodKey, safeInvoices, safeFinances);

  // Period months array for filtering drilldown items
  const activeMonths = activeVatPeriodKey.includes(' to ')
    ? activeVatPeriodKey.split(' to ').map(m => m.trim())
    : [activeVatPeriodKey.trim()];

  // Itemized Invoices in this VAT Period
  const periodInvoices = safeInvoices.filter(inv =>
    inv && inv.date && activeMonths.some(m => inv.date.startsWith(m))
  );

  // Itemized Input Tax Expenses in this VAT Period
  const periodExpenses = safeFinances.filter(exp =>
    exp && exp.date && activeMonths.some(m => exp.date.startsWith(m)) && exp.type === 'EXPENSE' && exp.isVatClaimable
  );

  // Filtered lists for drilldown tables
  const filteredPeriodInvoices = periodInvoices.filter(inv => {
    if (!drilldownSearch) return true;
    const query = drilldownSearch.toLowerCase();
    return (
      (inv.invoiceNumber || '').toLowerCase().includes(query) ||
      (inv.customerName || '').toLowerCase().includes(query) ||
      (inv.vehicleReg || '').toLowerCase().includes(query) ||
      (inv.vehicleMakeModel || '').toLowerCase().includes(query)
    );
  });

  const filteredPeriodExpenses = periodExpenses.filter(exp => {
    if (!drilldownSearch) return true;
    const query = drilldownSearch.toLowerCase();
    return (
      (exp.category || '').toLowerCase().includes(query) ||
      (exp.description || '').toLowerCase().includes(query) ||
      (exp.referenceNo || '').toLowerCase().includes(query) ||
      (exp.paymentMethod || '').toLowerCase().includes(query)
    );
  });

  // Payroll EMP201 summary
  const empMonthPeriod = selectedMonth || '2026-08';
  const empSummary = generateSarsEmp201(empMonthPeriod, safePayrolls);
  const incomeTaxSummary = calculateAnnualIncomeTax(safeInvoices, safeFinances);

  // Annual Financials for ITR14 SBC Calculator (Year to Date / Projected)
  const [annualRevenue, setAnnualRevenue] = useState<number>(1450000);
  const [annualExpenses, setAnnualExpenses] = useState<number>(920000);

  const taxableIncome = Math.max(0, annualRevenue - annualExpenses);
  const sbcTax = calculateSbcIncomeTax(taxableIncome);
  const standardTax = calculateStandardCompanyTax(taxableIncome);
  const sbcSavings = Math.max(0, standardTax - sbcTax);

  // Download Comprehensive PDF SARS Tax Pack
  const handleDownloadTaxPack = () => {
    const doc = generateSarsTaxPackPDF(vatReturn, empSummary, incomeTaxSummary, settings);
    doc.save(`SARS_TaxPack_${vatReturn.periodMonth.replace(/\s+/g, '_')}.pdf`);
  };

  // Download Dedicated VAT201 Report PDF
  const handleDownloadVat201PDF = () => {
    const doc = generateVat201DetailedPDF(vatReturn, periodInvoices, periodExpenses, settings);
    doc.save(`SARS_VAT201_Report_${vatReturn.periodMonth.replace(/\s+/g, '_')}.pdf`);
  };

  // Export VAT201 Summary & Ledger to CSV
  const handleExportCSV = () => {
    const isPayable = vatReturn.netVatPayableOrRefund >= 0;
    let csvContent = 'data:text/csv;charset=utf-8,';

    // Header Details
    csvContent += `SARS VAT201 DECLARATION REPORT\r\n`;
    csvContent += `Vendor,${settings.workshopName}\r\n`;
    csvContent += `VAT Number,${settings.vatNumber}\r\n`;
    csvContent += `Period,${vatReturn.periodMonth}\r\n`;
    csvContent += `eFiling Due Date,${vatReturn.dueDate}\r\n\r\n`;

    // Part A: Output Tax
    csvContent += `PART A: OUTPUT TAX (TAX ON SALES & SUPPLIES)\r\n`;
    csvContent += `SARS Field,Description,Tax Base Excl VAT,VAT Rate,VAT Amount\r\n`;
    csvContent += `Field 1 & 4,Standard Rated Supplies (15% Tax Invoices),${vatReturn.standardRatedSuppliesExVat.toFixed(2)},15%,${vatReturn.outputTaxOnSales.toFixed(2)}\r\n`;
    csvContent += `Total Output,TOTAL OUTPUT TAX DECLARED,${vatReturn.standardRatedSuppliesExVat.toFixed(2)},-,${vatReturn.totalOutputTax.toFixed(2)}\r\n\r\n`;

    // Part B: Input Tax
    csvContent += `PART B: INPUT TAX (TAX ON PURCHASES & EXPENSES)\r\n`;
    csvContent += `SARS Field,Description,Tax Base Excl VAT,VAT Rate,VAT Amount\r\n`;
    csvContent += `Field 14 & 15,Other Goods & Services (Parts & Overheads),${vatReturn.otherGoodsServicesExVat.toFixed(2)},15%,${vatReturn.otherGoodsServicesInputTax.toFixed(2)}\r\n`;
    csvContent += `Field 14A & 15A,Capital Goods & Equipment,${vatReturn.capitalGoodsExVat.toFixed(2)},15%,${vatReturn.capitalGoodsInputTax.toFixed(2)}\r\n`;
    csvContent += `Field 19,TOTAL INPUT TAX DEDUCTIBLE,${(vatReturn.otherGoodsServicesExVat + vatReturn.capitalGoodsExVat).toFixed(2)},-,${vatReturn.totalInputTax.toFixed(2)}\r\n\r\n`;

    // Part C: Net Amount
    csvContent += `PART C: NET VAT CALCULATION\r\n`;
    csvContent += `SARS Field,Description,Amount\r\n`;
    csvContent += `Field 20,${isPayable ? 'NET VAT AMOUNT PAYABLE TO SARS' : 'NET VAT REFUND CLAIMABLE FROM SARS'},${Math.abs(vatReturn.netVatPayableOrRefund).toFixed(2)}\r\n\r\n`;

    // Invoices Schedule
    csvContent += `OUTPUT TAX INVOICES SCHEDULE\r\n`;
    csvContent += `Invoice No,Date,Customer Name,Subtotal Ex VAT,VAT Output 15%,Total Inc VAT,Status\r\n`;
    periodInvoices.forEach(inv => {
      csvContent += `"${inv.invoiceNumber}","${inv.date}","${inv.customerName}",${(inv.subtotalExVat || 0).toFixed(2)},${(inv.vatAmount || 0).toFixed(2)},${(inv.totalIncVat || 0).toFixed(2)},"${inv.status}"\r\n`;
    });
    csvContent += `\r\n`;

    // Expenses Schedule
    csvContent += `INPUT TAX EXPENSES SCHEDULE\r\n`;
    csvContent += `Date,Category,Description,Reference,Payment Method,Amount Ex VAT,VAT Input 15%\r\n`;
    periodExpenses.forEach(exp => {
      csvContent += `"${exp.date}","${exp.category}","${exp.description || ''}","${exp.referenceNo || ''}","${exp.paymentMethod}",${(exp.amountExVat || 0).toFixed(2)},${(exp.vatAmount || 0).toFixed(2)}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SARS_VAT201_${vatReturn.periodMonth.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy SARS eFiling Payment Reference
  const handleCopyPaymentRef = () => {
    const sarsCleanVat = (settings.vatNumber || '4980287162').replace(/\D/g, '');
    const ym = selectedMonth.replace('-', '').substring(2); // e.g. 2608
    const sarsPaymentRef = `${sarsCleanVat}V${ym}`;
    navigator.clipboard.writeText(sarsPaymentRef);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2500);
  };

  // Trigger Print
  const handlePrint = () => {
    window.print();
  };

  // Month preset helpers
  const monthPresets = [
    { label: 'August 2026', value: '2026-08' },
    { label: 'July 2026', value: '2026-07' },
    { label: 'June 2026', value: '2026-06' },
    { label: 'May 2026', value: '2026-05' },
    { label: 'April 2026', value: '2026-04' },
    { label: 'March 2026', value: '2026-03' },
  ];

  const biMonthlyPresets = [
    { label: 'Jul 2026 - Aug 2026 (Cat B Current)', value: '2026-07 to 2026-08' },
    { label: 'May 2026 - Jun 2026 (Cat B Filed)', value: '2026-05 to 2026-06' },
    { label: 'Mar 2026 - Apr 2026 (Cat B Filed)', value: '2026-03 to 2026-04' },
    { label: 'Jan 2026 - Feb 2026 (Cat B Filed)', value: '2026-01 to 2026-02' },
  ];

  const isNetPayable = vatReturn.netVatPayableOrRefund >= 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>SARS Tax Compliance & eFiling Center</span>
            <span className="text-xs bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
              SARS 2025/2026
            </span>
          </h1>
          <p className="text-slate-500 text-sm">
            Automated VAT201 return declarations, EMP201 payroll summaries, and Small Business Corporation (SBC) tax estimator
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="download-sars-tax-pack-btn"
            onClick={handleDownloadTaxPack}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export SARS Tax Pack PDF</span>
          </button>
        </div>
      </div>

      {/* Upcoming Filing Deadline Notification Banner */}
      <div
        id="sars-deadline-notification-banner"
        className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${
          nextDeadline.urgency === 'CRITICAL'
            ? 'bg-rose-50 border-rose-300 text-rose-950'
            : nextDeadline.urgency === 'WARNING'
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                nextDeadline.urgency === 'CRITICAL'
                  ? 'bg-rose-600 text-white'
                  : nextDeadline.urgency === 'WARNING'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-700 text-white'
              }`}
            >
              {nextDeadline.urgency === 'CRITICAL' ? (
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              ) : (
                <Calendar className="w-6 h-6" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-base tracking-tight">
                  Next SARS Filing Deadline: {nextDeadline.shortLabel}
                </span>

                {/* Main Notification Badge */}
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full inline-flex items-center space-x-1 ${
                    nextDeadline.urgency === 'CRITICAL'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : nextDeadline.urgency === 'WARNING'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-ping"></span>
                  <span>
                    {nextDeadline.daysRemaining === 0
                      ? 'Due Today!'
                      : nextDeadline.daysRemaining === 1
                      ? 'Due Tomorrow'
                      : `${nextDeadline.daysRemaining} Days Left`}
                  </span>
                </span>

                <span className="text-xs font-mono font-semibold opacity-80">
                  • Due {nextDeadline.formattedDueDate}
                </span>
              </div>

              <p className="text-xs opacity-90 max-w-3xl leading-relaxed">
                <span className="font-semibold">{nextDeadline.periodDescription}:</span> {nextDeadline.notes}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0 self-end lg:self-center">
            {nextDeadline.type === 'VAT201' ? (
              <button
                type="button"
                onClick={() => setActiveTaxTab('vat201')}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Review VAT201 Return</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTaxTab('calendar')}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs"
              >
                <FileCheck className="w-4 h-4" />
                <span>View Filing Schedule</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTaxTab('calendar')}
              className="bg-white/80 hover:bg-white text-slate-800 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-xl transition-colors shadow-2xs"
            >
              All Deadlines
            </button>
          </div>
        </div>

        {/* Mini Upcoming Schedule Strip */}
        <div className="mt-4 pt-3 border-t border-black/10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {allDeadlines.slice(0, 3).map((dl, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg flex items-center justify-between border ${
                idx === 0
                  ? 'bg-white/90 border-black/15 shadow-2xs font-semibold'
                  : 'bg-white/60 border-black/10 text-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    dl.urgency === 'CRITICAL'
                      ? 'bg-rose-500'
                      : dl.urgency === 'WARNING'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                ></span>
                <span className="font-bold truncate">{dl.shortLabel}</span>
                <span className="text-[11px] text-slate-500 truncate">({dl.formattedDueDate})</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-1 ${
                  dl.daysRemaining <= 3
                    ? 'bg-rose-100 text-rose-800'
                    : dl.daysRemaining <= 7
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {dl.daysRemaining === 0 ? 'Today' : `${dl.daysRemaining}d`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Workshop SARS Registration Profile Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-400 text-[11px] block">SARS Registered Entity</span>
          <p className="font-bold text-slate-900 text-sm mt-0.5">{settings.workshopName}</p>
          <p className="text-slate-500 text-[11px] font-mono">Reg: {settings.companyRegNumber || settings.registrationNumber}</p>
        </div>

        <div>
          <span className="text-slate-400 text-[11px] block">SARS 15% VAT Number</span>
          <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{settings.vatNumber}</p>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">
            Active Category B (Bi-Monthly)
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[11px] block">SARS Income Tax Ref</span>
          <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{settings.taxNumber}</p>
          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">
            Small Business Corp (SBC)
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[11px] block">SARS PAYE / UIF / SDL Ref</span>
          <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{settings.sarsPayeNumber}</p>
          <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-semibold">
            EMP201 Monthly Active
          </span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 overflow-x-auto">
          <button
            id="tab-sars-vat201"
            onClick={() => setActiveTaxTab('vat201')}
            className={`py-3.5 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 shrink-0 ${
              activeTaxTab === 'vat201'
                ? 'border-emerald-600 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>VAT201 Report Generator</span>
          </button>

          <button
            id="tab-sars-itr14"
            onClick={() => setActiveTaxTab('itr14')}
            className={`py-3.5 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 shrink-0 ${
              activeTaxTab === 'itr14'
                ? 'border-emerald-600 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building className="w-4 h-4 text-blue-600" />
            <span>Yearly SBC Income Tax Estimator</span>
          </button>

          <button
            id="tab-sars-calendar"
            onClick={() => setActiveTaxTab('calendar')}
            className={`py-3.5 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 shrink-0 ${
              activeTaxTab === 'calendar'
                ? 'border-emerald-600 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4 text-purple-600" />
            <span>SARS Filing Deadlines & Timetable</span>
          </button>

          <button
            type="button"
            id="tab-sars-audit-trail"
            onClick={() => setActiveTaxTab('audit_trail')}
            className={`py-3.5 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 shrink-0 ${
              activeTaxTab === 'audit_trail'
                ? 'border-emerald-600 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-amber-600" />
            <span>SARS Compliance Audit Trail</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center space-x-1">
              <Lock className="w-2.5 h-2.5" />
              <span>{internalAuditLogs.length} Blocks</span>
            </span>
          </button>
        </div>

        {/* Tab 1: SARS VAT201 Report Generator */}
        {activeTaxTab === 'vat201' && (
          <div className="p-6 space-y-6">
            {/* VAT201 Period Controls Header */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-slate-900 text-base">VAT201 Month & Period Selection</span>
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      SARS 15% VAT Standard Rate
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Select a calendar month or standard Category B bi-monthly cycle to generate statutory Output Tax and Input Tax calculations.
                  </p>
                </div>

                {/* Mode Selector Toggle */}
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs self-start lg:self-center">
                  <button
                    type="button"
                    onClick={() => setPeriodMode('single_month')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      periodMode === 'single_month'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monthly Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodMode('bi_monthly')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      periodMode === 'bi_monthly'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bi-Monthly (Cat B)
                  </button>
                </div>
              </div>

              {/* Month Picker & Quick Preset Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200/80 items-center">
                <div className="md:col-span-4 flex items-center space-x-2">
                  <label htmlFor="vat-month-selector" className="text-xs font-bold text-slate-700 shrink-0">
                    Target Month:
                  </label>
                  {periodMode === 'single_month' ? (
                    <input
                      id="vat-month-selector"
                      type="month"
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                    />
                  ) : (
                    <select
                      id="vat-bimonthly-selector"
                      value={biMonthlyPeriod}
                      onChange={e => setBiMonthlyPeriod(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                    >
                      {biMonthlyPresets.map(preset => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Quick Presets */}
                <div className="md:col-span-8 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1">Quick Select:</span>
                  {periodMode === 'single_month' ? (
                    monthPresets.map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setSelectedMonth(preset.value)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                          selectedMonth === preset.value
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))
                  ) : (
                    biMonthlyPresets.map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setBiMonthlyPeriod(preset.value)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                          biMonthlyPeriod === preset.value
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label.split(' (')[0]}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Top 4 KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Standard Rated Supplies (Field 1) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Standard Supplies (Field 1)
                  </span>
                  <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                    15%
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-slate-900">
                  {formatZAR(vatReturn.standardRatedSuppliesExVat)}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <span>Invoiced Revenue (ex VAT)</span>
                  <span className="font-bold text-slate-700">{periodInvoices.length} Invoices</span>
                </div>
              </div>

              {/* Card 2: Total Output Tax (Field 4) */}
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                    Output Tax (Field 4)
                  </span>
                  <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-800">
                  {formatZAR(vatReturn.outputTaxOnSales)}
                </div>
                <div className="flex items-center justify-between text-xs text-emerald-700 pt-1 border-t border-emerald-200/60">
                  <span>Collected from Customers</span>
                  <span className="font-bold">15% on Supplies</span>
                </div>
              </div>

              {/* Card 3: Total Input Tax Deductible (Field 19) */}
              <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                    Input Tax Claimed (Field 19)
                  </span>
                  <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-2xs">
                    <ArrowDownRight className="w-4 h-4" />
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-rose-800">
                  - {formatZAR(vatReturn.totalInputTax)}
                </div>
                <div className="flex items-center justify-between text-xs text-rose-700 pt-1 border-t border-rose-200/60">
                  <span>Parts & Operating Overheads</span>
                  <span className="font-bold text-rose-900">{periodExpenses.length} Receipts</span>
                </div>
              </div>

              {/* Card 4: Net VAT Payable / Refundable (Field 20) */}
              <div
                className={`p-4 rounded-2xl border shadow-sm space-y-2 ${
                  isNetPayable
                    ? 'bg-slate-900 border-slate-800 text-white'
                    : 'bg-blue-900 border-blue-800 text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-400">
                    {isNetPayable ? 'Net VAT Payable (Field 20)' : 'Net VAT Refund (Field 20)'}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isNetPayable ? 'bg-amber-400 text-slate-950' : 'bg-blue-400 text-blue-950'
                    }`}
                  >
                    {isNetPayable ? 'PAY TO SARS' : 'REFUND DUE'}
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {formatZAR(Math.abs(vatReturn.netVatPayableOrRefund))}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300 pt-1 border-t border-slate-700">
                  <span>Due by {vatReturn.dueDate}</span>
                  <span className="font-mono text-[11px] text-amber-300">SARS eFiling</span>
                </div>
              </div>
            </div>

            {/* Action Bar for Report Export, Printing & eFiling */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">SARS Reference:</span>
                <code className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200">
                  {(settings.vatNumber || '4980287162').replace(/\D/g, '')}V{selectedMonth.replace('-', '').substring(2)}
                </code>
                <button
                  type="button"
                  onClick={handleCopyPaymentRef}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center space-x-1"
                  title="Copy SARS Payment Reference"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRef ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadVat201PDF}
                  className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download VAT201 PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-2xs"
                >
                  <Table className="w-3.5 h-3.5 text-slate-600" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Official SARS VAT201 Statutory Summary Table */}
            <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm bg-white">
              <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-black text-sm uppercase tracking-wider text-amber-400">
                      OFFICIAL SARS VAT201 VALUE-ADDED TAX RETURN
                    </h4>
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">
                      Form VAT201 (v2025/26)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Vendor: <span className="font-bold text-white">{settings.workshopName}</span> | VAT Ref: <span className="font-mono font-bold text-white">{settings.vatNumber}</span> | Tax Period: <span className="font-mono text-amber-300">{activeVatPeriodKey}</span>
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[11px] text-slate-400 block">SARS eFiling Status</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center sm:justify-end space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ready for Submission</span>
                  </span>
                </div>
              </div>

              {/* Clean Summary Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px]">
                      <th className="py-3 px-4 w-28">SARS Field</th>
                      <th className="py-3 px-4">Tax Classification & Category Description</th>
                      <th className="py-3 px-4 text-right">Tax Base (excl. VAT)</th>
                      <th className="py-3 px-4 text-center w-20">VAT Rate</th>
                      <th className="py-3 px-4 text-right">Calculated VAT (ZAR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Part A: Output Tax Header */}
                    <tr className="bg-slate-50 font-black text-slate-900">
                      <td colSpan={5} className="py-2.5 px-4 text-xs tracking-wider uppercase bg-slate-100/90 text-slate-900 flex justify-between items-center">
                        <span>PART A: OUTPUT TAX (TAX ON SALES & TAXABLE SUPPLIES)</span>
                        <span className="font-mono text-emerald-800">{formatZAR(vatReturn.outputTaxOnSales)}</span>
                      </td>
                    </tr>

                    {/* Field 1 & 4 */}
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 bg-slate-50/40">
                        Field 1 & 4
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">Standard Rated Supplies (15%)</div>
                        <div className="text-[11px] text-slate-500">
                          Workshop mechanical labor, diagnostics, parts sales, and invoiced services ({periodInvoices.length} invoices)
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatZAR(vatReturn.standardRatedSuppliesExVat)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-600">
                        15%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatZAR(vatReturn.outputTaxOnSales)}
                      </td>
                    </tr>

                    {/* Field 1A (Zero Rated Supplies) */}
                    <tr className="hover:bg-slate-50/80 transition-colors text-slate-500">
                      <td className="py-2.5 px-4 font-mono font-bold bg-slate-50/40">
                        Field 1A
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-700">Zero Rated Supplies (0%)</div>
                        <div className="text-[11px] text-slate-400">Qualifying exports or basic zero-rated items</div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">R 0.00</td>
                      <td className="py-2.5 px-4 text-center font-bold">0%</td>
                      <td className="py-2.5 px-4 text-right font-mono">R 0.00</td>
                    </tr>

                    {/* Total Output Tax Subtotal */}
                    <tr className="bg-emerald-50/40 font-bold border-t border-b border-emerald-100">
                      <td className="py-2.5 px-4 font-mono text-emerald-950">Field 4 Total</td>
                      <td className="py-2.5 px-4 text-emerald-950 uppercase text-[11px]">
                        TOTAL OUTPUT TAX DECLARED (PART A)
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-950">
                        {formatZAR(vatReturn.standardRatedSuppliesExVat)}
                      </td>
                      <td className="py-2.5 px-4 text-center text-emerald-900">-</td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-800 text-sm font-black">
                        {formatZAR(vatReturn.totalOutputTax)}
                      </td>
                    </tr>

                    {/* Part B: Input Tax Header */}
                    <tr className="bg-slate-50 font-black text-slate-900">
                      <td colSpan={5} className="py-2.5 px-4 text-xs tracking-wider uppercase bg-slate-100/90 text-slate-900 flex justify-between items-center">
                        <span>PART B: INPUT TAX (TAX ON PURCHASES & EXPENSES DEDUCTIBLE)</span>
                        <span className="font-mono text-rose-800">- {formatZAR(vatReturn.totalInputTax)}</span>
                      </td>
                    </tr>

                    {/* Field 14 & 15: Other Goods and Services */}
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 bg-slate-50/40">
                        Field 14 & 15
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">Other Goods and Services (Parts Purchases & Overheads)</div>
                        <div className="text-[11px] text-slate-500">
                          Supplier spares, consumables, tools, workshop rent, electricity, telecoms, security, and municipal rates
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatZAR(vatReturn.otherGoodsServicesExVat)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-600">
                        15%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                        - {formatZAR(vatReturn.otherGoodsServicesInputTax)}
                      </td>
                    </tr>

                    {/* Field 14A & 15A: Capital Goods */}
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 bg-slate-50/40">
                        Field 14A & 15A
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">Capital Goods & Workshop Equipment</div>
                        <div className="text-[11px] text-slate-500">
                          Vehicle lifts, diagnostic machines, compressors, and major workshop machinery (&gt; R10,000)
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatZAR(vatReturn.capitalGoodsExVat)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-600">
                        15%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                        - {formatZAR(vatReturn.capitalGoodsInputTax)}
                      </td>
                    </tr>

                    {/* Total Input Tax Subtotal */}
                    <tr className="bg-rose-50/40 font-bold border-t border-b border-rose-100">
                      <td className="py-2.5 px-4 font-mono text-rose-950">Field 19 Total</td>
                      <td className="py-2.5 px-4 text-rose-950 uppercase text-[11px]">
                        TOTAL INPUT TAX DEDUCTIBLE (PART B)
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-950">
                        {formatZAR(vatReturn.otherGoodsServicesExVat + vatReturn.capitalGoodsExVat)}
                      </td>
                      <td className="py-2.5 px-4 text-center text-rose-900">-</td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-800 text-sm font-black">
                        - {formatZAR(vatReturn.totalInputTax)}
                      </td>
                    </tr>

                    {/* Part C: Net Amount Payable */}
                    <tr className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white font-bold">
                      <td className="py-4 px-4 font-mono text-amber-400 text-sm font-black">
                        Field 20
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm font-black uppercase tracking-wider text-amber-400">
                          {isNetPayable ? 'NET VAT AMOUNT PAYABLE TO SARS (FIELD 20)' : 'NET VAT REFUND CLAIMABLE FROM SARS (FIELD 20)'}
                        </div>
                        <div className="text-xs text-slate-300 font-normal mt-0.5">
                          Output Tax ({formatZAR(vatReturn.outputTaxOnSales)}) minus Input Tax ({formatZAR(vatReturn.totalInputTax)})
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-300">
                        -
                      </td>
                      <td className="py-4 px-4 text-center text-slate-300">
                        -
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-2xl font-black font-mono text-emerald-400 block">
                          {formatZAR(Math.abs(vatReturn.netVatPayableOrRefund))}
                        </span>
                        <span className="text-[10px] text-slate-300 font-normal">
                          {isNetPayable ? `Due via eFiling by ${vatReturn.dueDate}` : 'Refund due from SARS'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Itemized Audit Ledger & Drilldown Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>Itemized Period Audit Trail & Ledger</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Verify all source tax invoices and expense receipts contributing to this VAT201 return.
                  </p>
                </div>

                {/* Subtabs Toggle */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setVatDrilldownTab('invoices')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        vatDrilldownTab === 'invoices'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Output Invoices ({periodInvoices.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVatDrilldownTab('expenses')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        vatDrilldownTab === 'expenses'
                          ? 'bg-rose-700 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Input Expenses ({periodExpenses.length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Search Bar for transactions */}
              <div className="relative max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice, customer, vehicle, or expense category..."
                  value={drilldownSearch}
                  onChange={e => setDrilldownSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Drilldown Table: Output Invoices */}
              {vatDrilldownTab === 'invoices' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Invoice #</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Customer Name</th>
                          <th className="py-2.5 px-3">Vehicle</th>
                          <th className="py-2.5 px-3 text-right">Subtotal (ex VAT)</th>
                          <th className="py-2.5 px-3 text-right">15% VAT Output</th>
                          <th className="py-2.5 px-3 text-right">Total (inc VAT)</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredPeriodInvoices.length > 0 ? (
                          filteredPeriodInvoices.map((inv, idx) => (
                            <tr key={inv.id || idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {inv.date}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {inv.customerName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {inv.vehicleMakeModel || inv.vehicleReg || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                                {formatZAR(inv.subtotalExVat || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                {formatZAR(inv.vatAmount || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {formatZAR(inv.totalIncVat || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    inv.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : inv.status === 'PARTIALLY_PAID'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-400">
                              No tax invoices found matching the selected period and query.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Drilldown Table: Input Expenses */}
              {vatDrilldownTab === 'expenses' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Description / Payee</th>
                          <th className="py-2.5 px-3">Reference #</th>
                          <th className="py-2.5 px-3">Payment</th>
                          <th className="py-2.5 px-3 text-right">Amount (ex VAT)</th>
                          <th className="py-2.5 px-3 text-right">15% VAT Input Claimed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredPeriodExpenses.length > 0 ? (
                          filteredPeriodExpenses.map((exp, idx) => (
                            <tr key={exp.id || idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {exp.date}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {exp.category}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {exp.description || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">
                                {exp.referenceNo || '-'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                  {exp.paymentMethod}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                                {formatZAR(exp.amountExVat || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                                - {formatZAR(exp.vatAmount || 0)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-400">
                              No deductible VAT expenses found matching the selected period and query.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: SBC Annual Income Tax Calculator */}
        {activeTaxTab === 'itr14' && (
          <div className="p-6 space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs">
              <h3 className="font-bold text-amber-950 text-sm flex items-center space-x-1.5">
                <Building className="w-4 h-4 text-amber-700" />
                <span>Small Business Corporation (SBC) Tax Relief (SARS Section 12E)</span>
              </h3>
              <p className="text-amber-800 mt-1">
                JC's Workshop ZA qualifies as an SBC for the 2025/2026 tax year. SBCs pay graduated progressive tax rates starting at 0% instead of the flat 27% standard corporate rate.
              </p>
            </div>

            {/* Interactive Estimator Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Annual Workshop Financial Inputs
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Projected Annual Turnover / Revenue (ex VAT)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    value={annualRevenue}
                    onChange={e => setAnnualRevenue(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deductible Operating Expenses, Parts & Salaries
                  </label>
                  <input
                    type="number"
                    step="10000"
                    value={annualExpenses}
                    onChange={e => setAnnualExpenses(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-700">Taxable Net Profit:</span>
                  <span className="text-base font-black font-mono text-slate-900">
                    {formatZAR(taxableIncome)}
                  </span>
                </div>
              </div>

              {/* Tax Output Comparison */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 text-xs shadow-sm">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  SARS 2025/2026 Tax Liability Comparison
                </h4>

                <div className="space-y-3">
                  {/* SBC Progressive Tax */}
                  <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-emerald-950 text-sm block">SBC Progressive Tax Liability</span>
                        <span className="text-[11px] text-emerald-700">Qualifying Workshop Rate</span>
                      </div>
                      <span className="text-xl font-black font-mono text-emerald-800">
                        {formatZAR(sbcTax)}
                      </span>
                    </div>
                  </div>

                  {/* Standard Company Tax (27%) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-800 block">Standard Company Tax (27%)</span>
                      <span className="text-[10px] text-slate-400">Non-qualifying standard rate</span>
                    </div>
                    <span className="font-mono font-bold text-slate-700">{formatZAR(standardTax)}</span>
                  </div>

                  {/* Net Tax Savings */}
                  <div className="bg-amber-100/60 border border-amber-300 rounded-xl p-3.5 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-amber-950 block">SBC Tax Benefit / Savings</span>
                      <span className="text-[10px] text-amber-800">Annual cashflow kept in workshop</span>
                    </div>
                    <span className="font-black font-mono text-base text-amber-900">
                      +{formatZAR(sbcSavings)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SBC Tax Brackets Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-slate-100 p-3 font-bold text-slate-800 uppercase text-[11px]">
                SARS Small Business Corporations (SBC) Tax Brackets (2025/2026 Year of Assessment)
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Taxable Income Bracket (ZAR)</th>
                    <th className="p-2.5">SBC Statutory Rate of Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="p-2.5 font-mono">R0 – R95,750</td>
                    <td className="p-2.5 font-bold text-emerald-700">0% of taxable income (Tax-free threshold)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono">R95,751 – R365,000</td>
                    <td className="p-2.5 font-bold">7% of taxable income above R95,750</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono">R365,001 – R550,000</td>
                    <td className="p-2.5 font-bold">R18,848 + 21% of taxable income above R365,000</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono">R550,001 and above</td>
                    <td className="p-2.5 font-bold">R57,698 + 27% of taxable income above R550,000</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: SARS Calendar & Deadlines */}
        {activeTaxTab === 'calendar' && (
          <div className="p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">SARS Statutory Compliance Timetable</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Monthly EMP201 Return</span>
                  <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Monthly by 7th
                  </span>
                </div>
                <p className="text-slate-600">
                  Declare & remit PAYE withheld from staff salaries, employee/employer UIF (2%), and SDL (1%).
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 text-[11px] font-mono text-slate-700">
                  Next Due: 07 September 2026
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Bi-Monthly VAT201</span>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Bi-Monthly (Last Day)
                  </span>
                </div>
                <p className="text-slate-600">
                  Declare Output Tax on workshop sales and claim Input Tax on supplier spares & overheads.
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 text-[11px] font-mono text-slate-700">
                  Next Due: 31 August 2026
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Provisional Tax (IRP6)</span>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Aug & Feb
                  </span>
                </div>
                <p className="text-slate-600">
                  1st Provisional Return (August) & 2nd Provisional Return (February) based on estimated taxable turnover.
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 text-[11px] font-mono text-slate-700">
                  1st Period Due: 31 August 2026
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: SARS Section 29/30 Immutable Audit Trail */}
        {activeTaxTab === 'audit_trail' && (
          <div className="p-6">
            <SarsAuditLogView
              auditLogs={internalAuditLogs}
              settings={settings}
              invoices={safeInvoices}
              finances={safeFinances}
              onRefreshLogs={() => {
                const refreshed = loadAuditLogs();
                setInternalAuditLogs(refreshed);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

