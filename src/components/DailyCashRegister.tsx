import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  Coffee,
  Wrench,
  Truck,
  Sparkles,
  Search,
  Filter,
  Printer,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { FinancialTransaction, FinancialCategory, WorkshopSettings } from '../types';
import { formatZAR } from '../utils/sarsTaxEngine';

interface DailyCashRegisterProps {
  finances: FinancialTransaction[];
  onSaveTransaction: (txn: FinancialTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  settings: WorkshopSettings;
}

export const DailyCashRegister: React.FC<DailyCashRegisterProps> = ({
  finances = [],
  onSaveTransaction,
  onDeleteTransaction,
  settings,
}) => {
  const safeFinances = Array.isArray(finances) ? finances : [];
  const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  
  // Quick-entry form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [category, setCategory] = useState<FinancialCategory>('Workshop Consumables & Tools');
  const [hasVat, setHasVat] = useState(true);
  const [reference, setReference] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [filterRange, setFilterRange] = useState<'TODAY' | 'WEEK' | 'ALL'>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Quick Preset Templates for workshop shop expenses
  const quickPresets = [
    { label: 'Workshop Milk & Tea', desc: 'Staff milk, tea & coffee', amount: '65', cat: 'Miscellaneous Expense' as FinancialCategory, type: 'EXPENSE' as const, vat: false },
    { label: 'Brake Cleaner / Rags', desc: 'Brake cleaner cans & workshop shop rags', amount: '140', cat: 'Workshop Consumables & Tools' as FinancialCategory, type: 'EXPENSE' as const, vat: true },
    { label: 'Nuts & Fasteners', desc: 'Hardware fasteners, bolts & washers', amount: '95', cat: 'Workshop Consumables & Tools' as FinancialCategory, type: 'EXPENSE' as const, vat: true },
    { label: 'Local Courier / Drop', desc: 'Local parts delivery dispatch cash', amount: '120', cat: 'Fuel & Vehicle Running Costs' as FinancialCategory, type: 'EXPENSE' as const, vat: false },
    { label: 'Emergency Gas / Fuel', desc: 'Emergency petrol/diesel for test run', amount: '200', cat: 'Fuel & Vehicle Running Costs' as FinancialCategory, type: 'EXPENSE' as const, vat: false },
    { label: 'Minor Cash Job / Diagnostic', desc: 'Quick cash diagnostic check & code clear', amount: '350', cat: 'Diagnostic & Testing' as FinancialCategory, type: 'INCOME' as const, vat: true },
  ];

  // Filter only cash transactions
  const cashTransactions = safeFinances.filter(f => f && f.paymentMethod === 'CASH');

  // Compute date range filters
  const filteredCashList = cashTransactions.filter(txn => {
    if (!txn) return false;
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = (txn.description || '').toLowerCase().includes(q);
      const matchRef = (txn.referenceNo || '').toLowerCase().includes(q);
      const matchCat = (txn.category || '').toLowerCase().includes(q);
      if (!matchDesc && !matchRef && !matchCat) return false;
    }

    if (filterRange === 'TODAY') {
      return txn.date === todayStr;
    } else if (filterRange === 'WEEK') {
      const txnDate = new Date(txn.date);
      const now = new Date();
      const diffDays = (now.getTime() - txnDate.getTime()) / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    return true;
  });

  // Calculate totals for today
  const todayCashEntries = cashTransactions.filter(txn => txn && txn.date === todayStr);
  const todayCashIn = todayCashEntries
    .filter(txn => txn.type === 'INCOME')
    .reduce((sum, txn) => sum + (txn.amountIncVat || 0), 0);
  const todayCashOut = todayCashEntries
    .filter(txn => txn.type === 'EXPENSE')
    .reduce((sum, txn) => sum + (txn.amountIncVat || 0), 0);
  const todayNetCashBalance = todayCashIn - todayCashOut;

  // Handle submitting a quick cash entry
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) {
      return;
    }

    const calculatedVat = hasVat ? Math.round((numAmount - numAmount / 1.15) * 100) / 100 : 0;
    const calculatedExVat = Math.round((numAmount - calculatedVat) * 100) / 100;
    const autoRef = reference.trim() || `PETTY-${selectedDate.replace(/-/g, '').slice(4)}-${Math.floor(100 + Math.random() * 900)}`;

    const newTxn: FinancialTransaction = {
      id: `TXN-CASH-${Date.now()}`,
      date: selectedDate,
      type: type,
      category: category,
      amountExVat: calculatedExVat,
      vatAmount: calculatedVat,
      amountIncVat: numAmount,
      isVatClaimable: type === 'EXPENSE' && hasVat,
      description: description.trim(),
      referenceNo: autoRef,
      paymentMethod: 'CASH',
      taxDeductible: true,
    };

    onSaveTransaction(newTxn);

    // Reset input fields
    setDescription('');
    setAmount('');
    setReference('');
    setSuccessMessage(`Recorded ${type === 'EXPENSE' ? 'cash expense' : 'cash income'} of ${formatZAR(numAmount)}`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const applyPreset = (preset: typeof quickPresets[0]) => {
    setDescription(preset.desc);
    setAmount(preset.amount);
    setCategory(preset.cat);
    setType(preset.type);
    setHasVat(preset.vat);
    setReference(`SLIP-${Date.now().toString().slice(-4)}`);
  };

  const handlePrintCashLog = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="daily-cash-register-panel">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-base">Daily Cash Register & Petty Cash</h3>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Instant Log
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quickly record shop floor expenses, consumables, local delivery slips, and cash receipts
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePrintCashLog}
            className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-xs"
            title="Print Daily Cash Register Summary"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Log</span>
          </button>
        </div>
      </div>

      {/* Daily Cash Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 sm:p-5 bg-slate-50/50 border-b border-slate-200 text-xs">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">Today's Cash In</span>
            <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">
              +{formatZAR(todayCashIn)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">Today's Petty Cash Out</span>
            <span className="text-base font-bold text-rose-600 font-mono mt-0.5 block">
              -{formatZAR(todayCashOut)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">Net Register Balance (Today)</span>
            <span className={`text-base font-bold font-mono mt-0.5 block ${todayNetCashBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {todayNetCashBalance >= 0 ? '+' : ''}{formatZAR(todayNetCashBalance)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
            {todayCashEntries.length} txn
          </div>
        </div>
      </div>

      {/* Quick-Entry Form Box */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fast Cash Entry</span>
          </span>

          {/* Type Toggle (Expense vs Income) */}
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100 text-xs">
            <button
              type="button"
              onClick={() => setType('EXPENSE')}
              className={`px-3 py-1 font-bold rounded-md transition-colors ${
                type === 'EXPENSE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cash Expense (Out)
            </button>
            <button
              type="button"
              onClick={() => setType('INCOME')}
              className={`px-3 py-1 font-bold rounded-md transition-colors ${
                type === 'INCOME'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cash Sale / In
            </button>
          </div>
        </div>

        {/* Fast Preset Buttons */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Presets:</span>
          {quickPresets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(preset)}
              className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition-colors font-medium flex items-center space-x-1"
            >
              <span>{preset.label}</span>
              <span className="font-mono text-slate-400 font-normal">R{preset.amount}</span>
            </button>
          ))}
        </div>

        {/* Actual Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Description (span 5) */}
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Description / Item Name *
              </label>
              <input
                id="cash-reg-desc-input"
                type="text"
                required
                placeholder="e.g. Brake cleaner cans, Workshop milk & coffee, Shop rags..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            {/* Amount (span 3) */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Amount (ZAR) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R</span>
                <input
                  id="cash-reg-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full text-xs pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Category (span 4) */}
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Ledger Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as FinancialCategory)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition-all"
              >
                <option value="Workshop Consumables & Tools">Workshop Consumables & Tools</option>
                <option value="Miscellaneous Expense">Miscellaneous Expense</option>
                <option value="Fuel & Vehicle Running Costs">Fuel & Vehicle Running Costs</option>
                <option value="Supplier Parts Purchases">Supplier Parts Purchases</option>
                <option value="Diagnostic & Testing">Diagnostic & Testing</option>
                <option value="Workshop Labor">Workshop Labor (Cash)</option>
                <option value="Waste Disposal & Oil Recycling">Waste Disposal & Oil Recycling</option>
                <option value="Electricity & Utilities (Eskom/Municipal)">Electricity & Utilities</option>
              </select>
            </div>
          </div>

          {/* Secondary row: Date, Slip Reference, VAT toggle, Submit button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 text-[11px]">Slip / Ref:</span>
                <input
                  type="text"
                  placeholder="Slip #"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1 w-28 focus:outline-none"
                />
              </div>

              <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={hasVat}
                  onChange={e => setHasVat(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span className="text-[11px] font-medium">15% VAT Receipt Claim</span>
              </label>
            </div>

            <button
              id="cash-reg-save-btn"
              type="submit"
              className={`flex items-center space-x-1.5 font-bold px-4 py-2 rounded-lg text-xs transition-all shadow-xs active:scale-95 ${
                type === 'EXPENSE'
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record {type === 'EXPENSE' ? 'Petty Expense' : 'Cash Receipt'}</span>
            </button>
          </div>
        </form>

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}
      </div>

      {/* Quick-Entry List / Ledger */}
      <div className="p-4 sm:p-5">
        {/* Table Controls (Filter Tabs + Search) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center space-x-1.5 text-xs font-semibold">
            <span className="text-slate-400 mr-1 text-[11px] uppercase">View:</span>
            <button
              type="button"
              onClick={() => setFilterRange('TODAY')}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                filterRange === 'TODAY'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Today ({todayCashEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterRange('WEEK')}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                filterRange === 'WEEK'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setFilterRange('ALL')}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                filterRange === 'ALL'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Cash ({cashTransactions.length})
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search cash slips..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Quick-Entry Table */}
        {filteredCashList.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date / Slip</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-center">VAT</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-700 divide-y divide-slate-100">
                {filteredCashList.map(txn => {
                  const isExpense = txn.type === 'EXPENSE';
                  return (
                    <tr key={txn.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-medium whitespace-nowrap">
                        <div className="text-slate-900 font-semibold">{txn.date}</div>
                        <span className="text-[10px] font-mono text-slate-400">{txn.referenceNo || 'CASH-SLIP'}</span>
                      </td>

                      <td className="p-3 font-medium text-slate-900">
                        <div>{txn.description}</div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200">
                          {txn.category}
                        </span>
                      </td>

                      <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isExpense ? 'text-rose-600' : 'text-emerald-700'}>
                          {isExpense ? '-' : '+'}{formatZAR(txn.amountIncVat)}
                        </span>
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        {txn.vatAmount > 0 ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded" title={`VAT: ${formatZAR(txn.vatAmount)}`}>
                            15% VAT ({formatZAR(txn.vatAmount)})
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">No VAT</span>
                        )}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete cash entry "${txn.description}" (${formatZAR(txn.amountIncVat)})?`)) {
                              onDeleteTransaction(txn.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-xs text-slate-600">No cash register entries found for this selection.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Use the fast cash entry form or presets above to record small daily workshop expenses or petty cash receipts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
