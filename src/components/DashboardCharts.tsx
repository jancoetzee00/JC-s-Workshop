import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Invoice, FinancialTransaction, PayrollRecord, WorkshopSettings } from '../types';
import { formatZAR } from '../utils/sarsTaxEngine';

interface DashboardChartsProps {
  invoices: Invoice[];
  finances: FinancialTransaction[];
  payrolls: PayrollRecord[];
  settings: WorkshopSettings;
}

interface MonthlyDataPoint {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "Mar 2026"
  shortLabel: string; // "Mar"
  revenue: number;
  expenses: number;
  netProfit: number;
  invoicesCount: number;
  expensesCount: number;
  marginPercent: number;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  invoices = [],
  finances = [],
  payrolls = [],
  settings,
}) => {
  const [chartType, setChartType] = useState<'BAR' | 'AREA'>('BAR');

  // Generate the last 6 months list (from 5 months ago to current month)
  const sixMonthsData: MonthlyDataPoint[] = useMemo(() => {
    const data: MonthlyDataPoint[] = [];
    const now = new Date();
    const safeInvoices = Array.isArray(invoices) ? invoices : [];
    const safeFinances = Array.isArray(finances) ? finances : [];
    const safePayrolls = Array.isArray(payrolls) ? payrolls : [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNumber = (d.getMonth() + 1).toString().padStart(2, '0');
      const monthKey = `${year}-${monthNumber}`;
      
      const monthLabel = d.toLocaleString('en-ZA', { month: 'short', year: '2-digit' });
      const shortLabel = d.toLocaleString('en-ZA', { month: 'short' });

      // 1. Calculate Revenue:
      // Invoices issued in this month
      const monthInvoices = safeInvoices.filter(inv => inv?.date && inv.date.startsWith(monthKey));
      const invoiceRevenue = monthInvoices.reduce((sum, inv) => sum + (inv.totalIncVat || 0), 0);

      // Direct income transactions in finances
      const monthIncomeTxns = safeFinances.filter(
        f => f?.date && f.date.startsWith(monthKey) && f.type === 'INCOME'
      );
      const directIncome = monthIncomeTxns.reduce((sum, f) => sum + (f.amountIncVat || 0), 0);

      const totalRevenue = Math.round((invoiceRevenue + directIncome) * 100) / 100;

      // 2. Calculate Expenses:
      // Direct expense transactions in finances
      const monthExpenseTxns = safeFinances.filter(
        f => f?.date && f.date.startsWith(monthKey) && f.type === 'EXPENSE'
      );
      const directExpenses = monthExpenseTxns.reduce((sum, f) => sum + (f.amountIncVat || 0), 0);

      // Add payroll outlay if not already in finances
      const monthPayrolls = safePayrolls.filter(p => p?.monthYear === monthKey);
      const payrollOutlay = monthPayrolls.reduce((sum, p) => sum + (p.grossIncome || 0), 0);

      // Avoid double counting if payroll is logged as an expense in finances
      const hasPayrollInFinances = monthExpenseTxns.some(
        f => f?.category === 'Salaries & Wages' || (f?.description && f.description.toLowerCase().includes('payroll'))
      );
      const totalExpenses = Math.round(
        (directExpenses + (hasPayrollInFinances ? 0 : payrollOutlay)) * 100
      ) / 100;

      const netProfit = Math.round((totalRevenue - totalExpenses) * 100) / 100;
      const marginPercent = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

      data.push({
        monthKey,
        monthLabel,
        shortLabel,
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        invoicesCount: monthInvoices.length,
        expensesCount: monthExpenseTxns.length,
        marginPercent,
      });
    }

    return data;
  }, [invoices, finances, payrolls]);

  // Aggregate totals over the 6 months
  const total6MonthRevenue = sixMonthsData.reduce((sum, d) => sum + d.revenue, 0);
  const total6MonthExpenses = sixMonthsData.reduce((sum, d) => sum + d.expenses, 0);
  const total6MonthNetProfit = total6MonthRevenue - total6MonthExpenses;
  const overallMargin = total6MonthRevenue > 0
    ? Math.round((total6MonthNetProfit / total6MonthRevenue) * 100)
    : 0;

  // Custom Formatter for Y-Axis values (e.g. R50k)
  const formatYAxis = (val: number) => {
    if (Math.abs(val) >= 1000000) {
      return `R${(val / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1000) {
      return `R${(val / 1000).toFixed(0)}k`;
    }
    return `R${val}`;
  };

  // Custom Chart Tooltip Component
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0]?.payload as MonthlyDataPoint;
      if (!data) return null;

      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2">
            <span className="font-bold text-slate-200">{data.monthLabel}</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                data.netProfit >= 0
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              {data.marginPercent}% Margin
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Total Revenue:</span>
              </span>
              <span className="font-mono font-bold text-emerald-400">
                {formatZAR(data.revenue)}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                <span>Expenses & Costs:</span>
              </span>
              <span className="font-mono font-bold text-rose-400">
                {formatZAR(data.expenses)}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1.5 border-t border-slate-800 text-white font-bold">
              <span>Net Profit / (Loss):</span>
              <span
                className={`font-mono ${
                  data.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-400'
                }`}
              >
                {data.netProfit >= 0 ? '+' : ''}
                {formatZAR(data.netProfit)}
              </span>
            </div>

            <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
              <span>{data.invoicesCount} Invoices</span>
              <span>{data.expensesCount} Expense Txns</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const hasAnyData = total6MonthRevenue > 0 || total6MonthExpenses > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="dashboard-financial-trends-panel">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-800 text-white flex items-center justify-center shadow-xs">
            <TrendingUp className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-base">Monthly Revenue vs. Expense Trends</h3>
              <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Last 6 Months
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live financial comparative analysis of workshop earnings, operating overheads, and net margins
            </p>
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center space-x-2 self-start md:self-auto">
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-white text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setChartType('BAR')}
              className={`flex items-center space-x-1.5 px-3 py-1 font-semibold rounded-md transition-colors ${
                chartType === 'BAR'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Comparative Bars</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('AREA')}
              className={`flex items-center space-x-1.5 px-3 py-1 font-semibold rounded-md transition-colors ${
                chartType === 'AREA'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Trend Flow Area</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6-Month High Level Stats Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-50/50 border-b border-slate-200 text-xs">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">6-Month Revenue</span>
          <span className="text-lg font-bold text-emerald-700 font-mono mt-0.5 block">
            {formatZAR(total6MonthRevenue)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Invoices + Direct Income</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">6-Month Expenses</span>
          <span className="text-lg font-bold text-rose-600 font-mono mt-0.5 block">
            {formatZAR(total6MonthExpenses)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Parts + Overheads + Payroll</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">6-Month Net Profit</span>
          <span className={`text-lg font-bold font-mono mt-0.5 block ${total6MonthNetProfit >= 0 ? 'text-emerald-800' : 'text-rose-600'}`}>
            {total6MonthNetProfit >= 0 ? '+' : ''}{formatZAR(total6MonthNetProfit)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Operating Bottom Line</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">Average Net Margin</span>
          <span className={`text-lg font-bold font-mono mt-0.5 block ${overallMargin >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {overallMargin}%
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Profitability Ratio</span>
        </div>
      </div>

      {/* Main Recharts Graph Stage */}
      <div className="p-4 sm:p-6 bg-white">
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'BAR' ? (
              <ComposedChart
                data={sixMonthsData}
                margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#f87171" stopOpacity={0.65} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                  width={65}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                />

                <Bar
                  dataKey="revenue"
                  name="Monthly Revenue (ZAR)"
                  fill="url(#revenueBarGrad)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                />
                <Bar
                  dataKey="expenses"
                  name="Monthly Expenses (ZAR)"
                  fill="url(#expenseBarGrad)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                />
                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="Net Profit (ZAR)"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0284c7', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            ) : (
              <ComposedChart
                data={sixMonthsData}
                margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="areaRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="areaExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                  width={65}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                />

                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Monthly Revenue (ZAR)"
                  stroke="#059669"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#areaRevenueGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Monthly Expenses (ZAR)"
                  stroke="#e11d48"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#areaExpenseGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="Net Profit (ZAR)"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 4, fill: '#0284c7', strokeWidth: 2, stroke: '#ffffff' }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        {!hasAnyData && (
          <div className="mt-3 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-slate-500 text-xs">
            <span className="font-semibold text-slate-700">Clean Zero Base:</span> No invoices or expenses recorded in this period yet. As you generate tax invoices, process payroll, or record petty cash slips, this chart updates automatically in real-time.
          </div>
        )}
      </div>
    </div>
  );
};
