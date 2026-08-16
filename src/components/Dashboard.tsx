import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  FileText,
  DollarSign,
  Package,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  Eye,
  CreditCard,
  BarChart3,
  Award,
  Sparkles,
} from 'lucide-react';
import {
  InventoryItem,
  Invoice,
  Quotation,
  PayrollRecord,
  FinancialTransaction,
  WorkshopSettings,
  NavigationTab,
  Employee,
  Customer,
} from '../types';
import { formatZAR, generateSarsVat201, generateSarsEmp201, getNextSarsDeadline } from '../utils/sarsTaxEngine';
import { DailyCashRegister } from './DailyCashRegister';
import { DashboardCharts } from './DashboardCharts';
import { ProfitabilityDashboard } from './ProfitabilityDashboard';

interface DashboardProps {
  inventory: InventoryItem[];
  invoices: Invoice[];
  quotes: Quotation[];
  employees?: Employee[];
  payrolls?: PayrollRecord[];
  finances?: FinancialTransaction[];
  customers?: Customer[];
  settings: WorkshopSettings;
  onNavigate: (view: NavigationTab) => void;
  onOpenInvoiceModal: (invoice?: Invoice) => void;
  onOpenQuoteModal: (quote?: Quotation) => void;
  onOpenStockModal: (item?: InventoryItem) => void;
  onSaveFinancialTransaction: (txn: FinancialTransaction) => void;
  onDeleteFinancialTransaction: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  inventory = [],
  invoices = [],
  quotes = [],
  employees = [],
  payrolls = [],
  finances = [],
  customers = [],
  settings,
  onNavigate,
  onOpenInvoiceModal,
  onOpenQuoteModal,
  onOpenStockModal,
  onSaveFinancialTransaction,
  onDeleteFinancialTransaction,
}) => {
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
  const safeFinances = Array.isArray(finances) ? finances : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];

  const [dashboardTab, setDashboardTab] = useState<'overview' | 'profitability'>('overview');

  const currentMonthYear = new Date().toISOString().slice(0, 7); // e.g. "2026-08"
  const nextSarsDeadline = getNextSarsDeadline();

  // 1. Inventory calculations
  const lowStockItems = safeInventory.filter(item => item && item.stockOnHand <= item.minStockLevel);
  const totalStockUnits = safeInventory.reduce((sum, i) => sum + (i?.stockOnHand || 0), 0);

  // 2. Invoice & Revenue calculations
  const currentMonthInvoices = safeInvoices.filter(inv => inv?.date && inv.date.startsWith(currentMonthYear));
  const totalInvoicedThisMonth = currentMonthInvoices.reduce((sum, inv) => sum + (inv?.totalIncVat || 0), 0);
  const totalOutstandingDebtors = safeInvoices
    .filter(inv => inv && inv.status !== 'PAID')
    .reduce((sum, inv) => sum + (inv?.balanceDue || 0), 0);

  // 3. Payroll calculations
  const emp201Summary = generateSarsEmp201(currentMonthYear, safePayrolls);
  const totalPayrollGross = safePayrolls
    .filter(p => p && p.monthYear === currentMonthYear)
    .reduce((sum, p) => sum + (p?.grossIncome || 0), 0);

  // 4. SARS VAT201 calculations
  const vat201Summary = generateSarsVat201(currentMonthYear, safeInvoices, safeFinances);

  const workshopCity = (settings?.physicalAddress || '').includes(',')
    ? settings.physicalAddress.split(',')[1]?.trim() || 'Western Cape'
    : 'Western Cape';

  return (
    <div className="space-y-6 pb-12">
      {/* Workshop Identification Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Workshop Console • {workshopCity}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {settings?.workshopName || "JC's Workshop ZA"}
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            CIPC Reg: <span className="font-mono text-slate-300">{settings?.companyRegNumber || settings?.registrationNumber || '2021/876543/07'}</span> | VAT: <span className="font-mono text-emerald-400 font-semibold">{settings?.vatNumber || '4890123456'}</span> | Default Labor: <span className="font-bold text-slate-200">{formatZAR(settings?.defaultLaborRateExVat || 650)}/hr</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="dash-create-invoice-btn"
            onClick={() => onOpenInvoiceModal()}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
          <button
            id="dash-create-quote-btn"
            onClick={() => onOpenQuoteModal()}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3.5 py-2 rounded-lg text-sm border border-slate-700 transition-colors"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>New Quote</span>
          </button>
          <button
            id="dash-sars-center-btn"
            onClick={() => onNavigate('sars_tax')}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-3 py-2 rounded-lg text-sm border border-slate-700 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>SARS Suite</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs: Operational Overview vs Job Profitability & Services Breakdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            type="button"
            id="dash-tab-overview"
            onClick={() => setDashboardTab('overview')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              dashboardTab === 'overview'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Operational Console & Cashflow</span>
          </button>

          <button
            type="button"
            id="dash-tab-profitability"
            onClick={() => setDashboardTab('profitability')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              dashboardTab === 'profitability'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
            <span>Job Profitability & Top Services</span>
            <span
              className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                dashboardTab === 'profitability'
                  ? 'bg-emerald-800 text-emerald-200'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              ROI Engine
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 pr-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>
            {safeInvoices.length} jobs invoiced • {safeInventory.length} inventory parts
          </span>
        </div>
      </div>

      {/* Render Conditional Content */}
      {dashboardTab === 'profitability' ? (
        <ProfitabilityDashboard
          invoices={safeInvoices}
          inventory={safeInventory}
          employees={safeEmployees}
          payrolls={safePayrolls}
          customers={safeCustomers}
          settings={settings}
          onOpenInvoice={onOpenInvoiceModal}
          onNavigate={onNavigate}
        />
      ) : (
        <>
          {/* Primary KPI Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Monthly Income */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Monthly Invoiced</p>
          <h3 className="text-2xl font-bold text-slate-900">
            {formatZAR(totalInvoicedThisMonth)}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-2">
            {currentMonthInvoices.length} {currentMonthInvoices.length === 1 ? 'invoice' : 'invoices'} this month
          </p>
        </div>

        {/* Metric 2: Active Inventory */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Active Inventory</p>
          <h3 className="text-2xl font-bold text-slate-900">{totalStockUnits} Units</h3>
          <p className="text-xs font-medium mt-2">
            {safeInventory.length === 0 ? (
              <span className="text-slate-400">0 catalog parts registered</span>
            ) : lowStockItems.length > 0 ? (
              <span className="text-rose-600">{lowStockItems.length} items low on stock</span>
            ) : (
              <span className="text-emerald-600">Stock levels healthy</span>
            )}
          </p>
        </div>

        {/* Metric 3: Payroll Outlay */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Payroll Outlay</p>
          <h3 className="text-2xl font-bold text-slate-900">
            {formatZAR(totalPayrollGross)}
          </h3>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            PAYE Withheld: <span className="font-semibold text-slate-700">{formatZAR(emp201Summary.totalPayeWithheld)}</span>
          </p>
        </div>

        {/* Metric 4: Outstanding Debtors */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Outstanding Debtors</p>
          <h3 className="text-2xl font-bold text-slate-900">{formatZAR(totalOutstandingDebtors)}</h3>
          <p className="text-xs text-slate-500 mt-2">
            {safeInvoices.filter(i => i && i.status !== 'PAID').length} unpaid invoices
          </p>
        </div>
      </div>

      {/* 6-Month Monthly Revenue vs. Expense Trends Chart (Recharts) */}
      <DashboardCharts
        invoices={safeInvoices}
        finances={safeFinances}
        payrolls={safePayrolls}
        settings={settings}
      />

      {/* Daily Cash Register & Petty Cash Quick-Entry Section */}
      <DailyCashRegister
        finances={safeFinances}
        onSaveTransaction={onSaveFinancialTransaction}
        onDeleteTransaction={onDeleteFinancialTransaction}
        settings={settings}
      />

      {/* 12-Column Grid Layout: Critical Stock Alerts + Upcoming VAT & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Critical Stock Alerts Table */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-bold text-slate-800 text-sm">Critical Stock Alerts & Spares</h4>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1"
              >
                <span>Manage Inventory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {safeInventory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold">
                    <tr>
                      <th className="p-4 border-b border-slate-100">Item Name</th>
                      <th className="p-4 border-b border-slate-100">Current Stock</th>
                      <th className="p-4 border-b border-slate-100">Min Threshold</th>
                      <th className="p-4 border-b border-slate-100">Category</th>
                      <th className="p-4 border-b border-slate-100">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                    {safeInventory.slice(0, 5).map(item => {
                      const isLow = item.stockOnHand <= item.minStockLevel;
                      const isOut = item.stockOnHand === 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium text-slate-900">
                            <div>{item.name}</div>
                            <span className="text-[11px] font-mono text-slate-400">{item.sku}</span>
                          </td>
                          <td className="p-4 font-bold text-slate-900">{item.stockOnHand}</td>
                          <td className="p-4 text-slate-500">{item.minStockLevel}</td>
                          <td className="p-4 text-xs text-slate-600">{item.category}</td>
                          <td className="p-4">
                            {isOut ? (
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[11px] font-bold uppercase">
                                Critical
                              </span>
                            ) : isLow ? (
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[11px] font-bold uppercase">
                                Low
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-bold uppercase">
                                Healthy
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm">No inventory parts cataloged yet.</p>
                <p className="text-xs text-slate-400 mt-1 mb-3">Add spares and lubricants to track stock levels and auto-fill invoices.</p>
                <button
                  onClick={() => onNavigate('inventory')}
                  className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Part</span>
                </button>
              </div>
            )}
          </div>

          {/* Recent Tax Invoices List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm">Recent Workshop Invoices</h4>
              <button
                onClick={() => onNavigate('quotes_invoices')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                View All
              </button>
            </div>

            {safeInvoices.length > 0 ? (
              <div className="space-y-3">
                {safeInvoices.slice(0, 3).map(inv => (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium mt-1">
                        {inv.customerName} • <span className="text-slate-500">{inv.vehicleMakeModel} ({inv.vehicleReg})</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">{formatZAR(inv.totalIncVat)}</p>
                      <p className="text-[11px] text-slate-400">Due: {inv.dueDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm">No workshop invoices created yet.</p>
                <p className="text-xs text-slate-400 mt-1 mb-3">Create tax invoices with 15% VAT calculation and customer records.</p>
                <button
                  onClick={() => onOpenInvoiceModal()}
                  className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Invoice</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right 4 Cols: Upcoming VAT Filing & Client Portal Activity */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upcoming VAT Filing Dark Card */}
          <div className="bg-slate-900 rounded-xl p-5 text-white shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold flex items-center text-sm">
                <ShieldCheck className="w-4 h-4 mr-2 text-emerald-400" />
                <span>SARS Tax Compliance</span>
              </h4>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  nextSarsDeadline.urgency === 'CRITICAL'
                    ? 'bg-rose-500 text-white animate-pulse'
                    : nextSarsDeadline.urgency === 'WARNING'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {nextSarsDeadline.badgeText}
              </span>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Next Upcoming Filing:</span>
                <span className="font-bold text-amber-400">{nextSarsDeadline.shortLabel}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Statutory Due Date:</span>
                <span className="font-mono text-slate-300">{nextSarsDeadline.formattedDueDate}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end text-xs">
                <span className="text-slate-400">Current Tax Period:</span>
                <span className="font-semibold text-slate-200">{currentMonthYear}</span>
              </div>

              <div className="flex justify-between items-end">
                <span className="text-slate-400 text-xs">Estimated VAT Position:</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {formatZAR(vat201Summary.netVatPayableOrRefund)}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800">
                <span>Output (15%): {formatZAR(vat201Summary.outputTaxOnSales)}</span>
                <span>Input Tax: {formatZAR(vat201Summary.totalInputTax)}</span>
              </div>

              <button
                id="dash-prepare-sars-btn"
                onClick={() => onNavigate('sars_tax')}
                className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Open SARS Compliance Center</span>
              </button>
            </div>
          </div>

          {/* Client Portal Activity */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h4 className="font-bold text-slate-800 text-sm mb-3">Client Portal Activity</h4>
            {safeQuotes.length > 0 || safeInvoices.length > 0 ? (
              <div className="space-y-3">
                {safeInvoices.slice(0, 2).map(inv => (
                  <div key={inv.id} className="flex items-start space-x-3 text-xs">
                    <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{inv.customerName}</p>
                      <p className="text-[11px] text-slate-500">Invoice #{inv.invoiceNumber} ({inv.status})</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{inv.date}</p>
                    </div>
                  </div>
                ))}
                {safeQuotes.slice(0, 1).map(qt => (
                  <div key={qt.id} className="flex items-start space-x-3 text-xs">
                    <div className="bg-blue-100 text-blue-700 p-1.5 rounded shrink-0">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{qt.customerName}</p>
                      <p className="text-[11px] text-slate-500">Quotation #{qt.quoteNumber} ({qt.status})</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{qt.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-slate-400 text-xs">
                <Users className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                <p>No client activity recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Register clients and issue quotes to track status.</p>
              </div>
            )}

            <button
              onClick={() => onNavigate('client_portal')}
              className="w-full mt-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-semibold transition-colors"
            >
              Open Client Directory
            </button>
          </div>

          {/* Job Profitability & Services ROI Quick-Link Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-5 text-white shadow-sm space-y-3 border border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                  Job Profitability & Parts Margin
                </h4>
                <p className="text-[11px] text-slate-400">
                  Live inventory cost deductions & technician wage analytics
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Analyze gross margins per service line, inspect itemized parts acquisition vs technician hours, and identify high-yield workshop jobs.
            </p>

            <button
              type="button"
              id="dash-open-profitability-view-btn"
              onClick={() => setDashboardTab('profitability')}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Launch Profitability Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </>
  )}
</div>
  );
};
