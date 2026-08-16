import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  PieChart,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { FinancialTransaction, FinancialCategory, WorkshopSettings } from '../types';
import { formatZAR } from '../utils/sarsTaxEngine';

interface FinancesModuleProps {
  finances: FinancialTransaction[];
  settings: WorkshopSettings;
  onSaveTransaction: (transaction: FinancialTransaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const FinancesModule: React.FC<FinancesModuleProps> = ({
  finances = [],
  settings,
  onSaveTransaction,
  onDeleteTransaction,
}) => {
  const safeFinances = Array.isArray(finances) ? finances : [];
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [activeView, setActiveView] = useState<'pnl' | 'ledger'>('pnl');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [formType, setFormType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [formCategory, setFormCategory] = useState<FinancialCategory>('Workshop Consumables & Tools');
  const [formAmountExVat, setFormAmountExVat] = useState<number>(500);
  const [formIsVatClaimable, setFormIsVatClaimable] = useState<boolean>(true);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formRefNo, setFormRefNo] = useState<string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'EFT' | 'CARD' | 'CASH' | 'DEBIT_ORDER'>('CARD');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Financial Calculations for Selected Month
  const monthTransactions = safeFinances.filter(t => t?.date && t.date.startsWith(selectedMonth));

  const totalIncomeExVat = monthTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amountExVat, 0);

  const costOfGoodsSold = monthTransactions
    .filter(t => t.type === 'EXPENSE' && t.category === 'Supplier Parts Purchases')
    .reduce((sum, t) => sum + t.amountExVat, 0);

  const grossProfit = totalIncomeExVat - costOfGoodsSold;
  const grossMarginPercent = totalIncomeExVat > 0 ? Math.round((grossProfit / totalIncomeExVat) * 100) : 0;

  const operatingExpenses = monthTransactions
    .filter(t => t.type === 'EXPENSE' && t.category !== 'Supplier Parts Purchases')
    .reduce((sum, t) => sum + t.amountExVat, 0);

  const netOperatingProfit = grossProfit - operatingExpenses;
  const netMarginPercent = totalIncomeExVat > 0 ? Math.round((netOperatingProfit / totalIncomeExVat) * 100) : 0;

  // Breakdown by Categories
  const incomeByCategory = monthTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amountExVat;
      return acc;
    }, {} as Record<string, number>);

  const expenseByCategory = monthTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amountExVat;
      return acc;
    }, {} as Record<string, number>);

  // Filtered transactions for Ledger
  const filteredTransactions = monthTransactions.filter(t => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.referenceNo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const categoriesList: FinancialCategory[] = [
    'Workshop Labor',
    'Parts & Spares Sales',
    'Diagnostic & Testing',
    'Supplier Parts Purchases',
    'Salaries & Wages',
    'SARS PAYE / UIF / SDL',
    'SARS VAT Payments',
    'Rent & Property Rates',
    'Electricity & Utilities (Eskom/Municipal)',
    'Workshop Consumables & Tools',
    'Equipment Lease & Maintenance',
    'Fuel & Vehicle Running Costs',
    'Insurance (Workshop & Public Liability)',
    'Telephone & Internet',
    'Software & Subscriptions',
    'Banking & Card Machine Fees',
    'Accounting & Legal',
    'Marketing & Advertising',
    'Waste Disposal & Oil Recycling',
    'Miscellaneous Expense',
  ];

  const handleOpenAddModal = (type: 'INCOME' | 'EXPENSE') => {
    setFormType(type);
    setFormCategory(type === 'INCOME' ? 'Workshop Labor' : 'Workshop Consumables & Tools');
    setFormAmountExVat(type === 'INCOME' ? 1200 : 450);
    setFormIsVatClaimable(true);
    setFormDescription('');
    setFormRefNo(`EXP-${Date.now().toString().slice(-4)}`);
    setFormPaymentMethod('CARD');
    setFormDate(new Date().toISOString().split('T')[0]);
    setIsAddModalOpen(true);
  };

  const handleSaveTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription || formAmountExVat <= 0) return;

    const vatAmount = formIsVatClaimable ? Math.round(formAmountExVat * settings.vatRate * 100) / 100 : 0;
    const amountIncVat = formAmountExVat + vatAmount;

    const newTxn: FinancialTransaction = {
      id: `TXN-${Date.now().toString().slice(-4)}`,
      date: formDate,
      type: formType,
      category: formCategory,
      amountExVat: Number(formAmountExVat),
      vatAmount,
      amountIncVat,
      isVatClaimable: formIsVatClaimable,
      description: formDescription,
      referenceNo: formRefNo || `REF-${Date.now().toString().slice(-4)}`,
      paymentMethod: formPaymentMethod,
      taxDeductible: true,
    };

    onSaveTransaction(newTxn);
    setIsAddModalOpen(false);
  };

  const handleExportCSV = () => {
    const headers = 'Date,Type,Category,Description,Reference,Amount Ex VAT,VAT Amount,Amount Inc VAT,VAT Claimable\n';
    const rows = monthTransactions
      .map(
        t =>
          `"${t.date}","${t.type}","${t.category}","${t.description.replace(/"/g, '""')}","${t.referenceNo}",${t.amountExVat},${t.vatAmount},${t.amountIncVat},${t.isVatClaimable}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `JCW_Financial_Ledger_${selectedMonth}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Income & Expenses Financial Reporting</span>
          </h1>
          <p className="text-slate-500 text-sm">
            Monthly P&L statement, workshop gross margin, expense classification, and VAT input tracking
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Month selector */}
          <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="font-bold text-slate-800 bg-transparent focus:outline-none"
            >
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
              <option value="2026-06">June 2026</option>
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs border border-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleOpenAddModal('EXPENSE')}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold px-3 py-2 rounded-lg text-xs border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Expense</span>
          </button>

          <button
            onClick={() => handleOpenAddModal('INCOME')}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Income</span>
          </button>
        </div>
      </div>

      {/* Financial Health Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced Revenue */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Total Revenue (ex VAT)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{formatZAR(totalIncomeExVat)}</p>
          <span className="text-xs text-slate-500 mt-1 block">Labor & parts sales</span>
        </div>

        {/* Cost of Sales / Spares Purchases */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Cost of Sales (Spares)</span>
            <TrendingDown className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{formatZAR(costOfGoodsSold)}</p>
          <span className="text-xs text-slate-500 mt-1 block">Direct parts inventory costs</span>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Operating Expenses</span>
            <DollarSign className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">{formatZAR(operatingExpenses)}</p>
          <span className="text-xs text-slate-500 mt-1 block">Rent, utilities, tools, insurance</span>
        </div>

        {/* Net Operating Margin */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Net Operating Margin</span>
            <Percent className="w-4 h-4 text-indigo-600" />
          </div>
          <p className={`text-2xl font-black mt-2 ${netOperatingProfit >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
            {formatZAR(netOperatingProfit)}
          </p>
          <span className={`text-xs font-bold mt-1 block ${netOperatingProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netMarginPercent}% Net Profit Margin
          </span>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50 px-4">
          <button
            onClick={() => setActiveView('pnl')}
            className={`py-3 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
              activeView === 'pnl'
                ? 'border-emerald-600 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Monthly Profit & Loss (P&L) Statement</span>
          </button>
          <button
            onClick={() => setActiveView('ledger')}
            className={`py-3 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
              activeView === 'ledger'
                ? 'border-emerald-600 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Transaction Ledger ({monthTransactions.length})</span>
          </button>
        </div>

        {/* View 1: Profit & Loss Statement */}
        {activeView === 'pnl' && (
          <div className="p-6 space-y-6">
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider">{settings.workshopName}</h3>
                  <p className="text-xs text-slate-400">Statement of Comprehensive Income (P&L) • {selectedMonth}</p>
                </div>
                <span className="text-xs bg-slate-800 text-amber-400 font-mono font-bold px-3 py-1 rounded-lg border border-slate-700">
                  ZAR (ex VAT)
                </span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {/* 1. Revenue Section */}
                <div className="p-4 bg-slate-50/50">
                  <div className="flex justify-between items-center font-bold text-slate-900 uppercase text-[11px] mb-2">
                    <span>1. WORKSHOP REVENUE</span>
                    <span className="font-mono text-sm">{formatZAR(totalIncomeExVat)}</span>
                  </div>
                  <div className="space-y-1.5 pl-4 text-slate-600">
                    {Object.entries(incomeByCategory).map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between">
                        <span>{cat}</span>
                        <span className="font-mono">{formatZAR(Number(amount))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Cost of Sales */}
                <div className="p-4 bg-white">
                  <div className="flex justify-between items-center font-bold text-slate-900 uppercase text-[11px] mb-2">
                    <span>2. COST OF SALES (DIRECT PARTS & MATERIALS)</span>
                    <span className="font-mono text-sm text-amber-700">- {formatZAR(costOfGoodsSold)}</span>
                  </div>
                  <div className="pl-4 text-slate-600 flex justify-between">
                    <span>Supplier Parts & Spares Purchases</span>
                    <span className="font-mono">{formatZAR(costOfGoodsSold)}</span>
                  </div>
                </div>

                {/* Gross Profit Summary Row */}
                <div className="p-4 bg-emerald-50/60 flex justify-between items-center font-black text-sm text-emerald-950">
                  <span>GROSS WORKSHOP PROFIT</span>
                  <div className="text-right">
                    <span className="font-mono text-base">{formatZAR(grossProfit)}</span>
                    <span className="text-[11px] font-bold text-emerald-700 block">
                      {grossMarginPercent}% Gross Margin
                    </span>
                  </div>
                </div>

                {/* 3. Operating Expenses */}
                <div className="p-4 bg-white space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-900 uppercase text-[11px]">
                    <span>3. OPERATING EXPENSES (OVERHEADS)</span>
                    <span className="font-mono text-sm text-rose-600">- {formatZAR(operatingExpenses)}</span>
                  </div>
                  <div className="space-y-1.5 pl-4 text-slate-600">
                    {Object.entries(expenseByCategory)
                      .filter(([cat]) => cat !== 'Supplier Parts Purchases')
                      .map(([cat, amount]) => (
                        <div key={cat} className="flex justify-between">
                          <span>{cat}</span>
                          <span className="font-mono">{formatZAR(Number(amount))}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Net Operating Profit Row */}
                <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <span className="text-sm font-black uppercase tracking-wider text-amber-400">
                      NET OPERATING PROFIT (EBITDA)
                    </span>
                    <p className="text-xs text-slate-400">Before corporate/SBC income tax estimation</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono text-white">{formatZAR(netOperatingProfit)}</span>
                    <span className="text-xs font-bold text-emerald-400 block">{netMarginPercent}% Net Margin</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View 2: Transaction Ledger */}
        {activeView === 'ledger' && (
          <div className="p-4 space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search transaction description, ref..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex space-x-1.5">
                <button
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                    typeFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTypeFilter('INCOME')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                    typeFilter === 'INCOME' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800'
                  }`}
                >
                  Income
                </button>
                <button
                  onClick={() => setTypeFilter('EXPENSE')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                    typeFilter === 'EXPENSE' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800'
                  }`}
                >
                  Expenses
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Category & Description</th>
                    <th className="py-3 px-3">Reference</th>
                    <th className="py-3 px-3 text-center">VAT Status</th>
                    <th className="py-3 px-3 text-right">Amount (ex VAT)</th>
                    <th className="py-3 px-3 text-right">15% VAT</th>
                    <th className="py-3 px-3 text-right">Total (inc VAT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map(txn => (
                    <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-600">{txn.date}</td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900">{txn.description}</span>
                        <span className="text-[10px] text-slate-500 block">{txn.category}</span>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">{txn.referenceNo}</td>

                      <td className="py-3 px-3 text-center">
                        {txn.isVatClaimable ? (
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded">
                            Input Claimable
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded">
                            Standard
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        <span className={txn.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-800'}>
                          {txn.type === 'INCOME' ? '+' : '-'} {formatZAR(txn.amountExVat)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-500">{formatZAR(txn.vatAmount)}</td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatZAR(txn.amountIncVat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredTransactions.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <DollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-sm">No financial ledger entries recorded.</p>
                  <p className="text-xs text-slate-400 mt-1 mb-3">Record revenue or overhead expenses to track operating cash flow.</p>
                  <button
                    onClick={() => handleOpenAddModal('EXPENSE')}
                    className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record First Entry</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Record Financial Transaction */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {formType === 'INCOME' ? 'Record Workshop Income' : 'Record Workshop Expense'}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransactionSubmit} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={formPaymentMethod}
                    onChange={e => setFormPaymentMethod(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="EFT">Electronic Funds Transfer (EFT)</option>
                    <option value="CASH">Cash</option>
                    <option value="DEBIT_ORDER">Monthly Debit Order</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Memo *</label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  placeholder="e.g. Wurth Brake Cleaners and degreasers"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (ZAR ex VAT) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formAmountExVat}
                    onChange={e => setFormAmountExVat(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Ref / Invoice #</label>
                  <input
                    type="text"
                    value={formRefNo}
                    onChange={e => setFormRefNo(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    placeholder="GW-84920"
                  />
                </div>
              </div>

              {formType === 'EXPENSE' && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">SARS 15% VAT Claimable</span>
                    <p className="text-[11px] text-slate-500">Qualifies for SARS Input Tax Deduction</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsVatClaimable}
                    onChange={e => setFormIsVatClaimable(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-sm"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
