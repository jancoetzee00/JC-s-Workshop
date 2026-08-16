import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart as PieIcon,
  Percent,
  Layers,
  Wrench,
  Package,
  Users,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Download,
  FileSpreadsheet,
  Eye,
  Info,
  Sliders,
  Calendar,
  ArrowUpDown,
  Award,
  Trophy,
  Zap,
  SlidersHorizontal,
  X,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  Invoice,
  InventoryItem,
  Employee,
  PayrollRecord,
  WorkshopSettings,
  LineItem,
  Customer,
} from '../types';
import { formatZAR } from '../utils/sarsTaxEngine';

export interface ProfitabilityDashboardProps {
  invoices: Invoice[];
  inventory: InventoryItem[];
  employees?: Employee[];
  payrolls?: PayrollRecord[];
  customers?: Customer[];
  settings: WorkshopSettings;
  onOpenInvoice?: (invoice: Invoice) => void;
  onNavigate?: (tab: any) => void;
}

export interface JobProfitDetail {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  vehicleReg: string;
  vehicleMakeModel: string;
  jobDescription: string;
  serviceCategory: string;
  totalRevenueExVat: number;
  totalRevenueIncVat: number;
  partsRevenue: number;
  partsCost: number;
  partsProfit: number;
  partsMarginPercent: number;
  laborRevenue: number;
  laborHours: number;
  laborCost: number;
  laborProfit: number;
  laborMarginPercent: number;
  outsourcedRevenue: number;
  outsourcedCost: number;
  diagnosticRevenue: number;
  diagnosticCost: number;
  totalCost: number;
  netProfit: number;
  marginPercent: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE';
  itemsBreakdown: {
    id: string;
    description: string;
    type: 'PART' | 'LABOR' | 'DIAGNOSTIC' | 'OUTSOURCED';
    quantity: number;
    unitPrice: number;
    totalExVat: number;
    unitCost: number;
    totalCost: number;
    profit: number;
    marginPercent: number;
    isInventoryLinked: boolean;
    partSku?: string;
  }[];
}

export interface ServiceCategoryStat {
  category: string;
  jobsCount: number;
  totalRevenue: number;
  totalPartsCost: number;
  totalLaborCost: number;
  totalOutsourcedCost: number;
  totalCost: number;
  totalProfit: number;
  averageMarginPercent: number;
  averageTicketRevenue: number;
  averageProfitPerJob: number;
  totalLaborHours: number;
  iconType: string;
}

export const ProfitabilityDashboard: React.FC<ProfitabilityDashboardProps> = ({
  invoices = [],
  inventory = [],
  employees = [],
  payrolls = [],
  customers = [],
  settings,
  onOpenInvoice,
  onNavigate,
}) => {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];

  // 1. Calculate default technician labor cost per hour from active employee roster / payrolls
  const defaultCalculatedHourlyCost = useMemo(() => {
    const activeTechs = safeEmployees.filter(
      (e) =>
        e.isActive &&
        (e.position.includes('Technician') ||
          e.position.includes('Mechanic') ||
          e.position.includes('Specialist') ||
          e.position.includes('Electrician') ||
          e.position.includes('Apprentice'))
    );

    if (activeTechs.length > 0) {
      const totalHourlyCostSum = activeTechs.reduce((sum, tech) => {
        const monthlyHours = (tech.standardHoursPerWeek || 40) * 4.333;
        // Basic salary + 1% UIF + 1% SDL = 1.02 multiplier
        const employerCost = (tech.basicSalary || 20000) * 1.02;
        const hourly = employerCost / (monthlyHours || 173.3);
        return sum + hourly;
      }, 0);
      return Math.round(totalHourlyCostSum / activeTechs.length);
    }

    // Fallback based on payroll records
    if (safePayrolls.length > 0) {
      const avgGross =
        safePayrolls.reduce((sum, p) => sum + (p.grossIncome || 0), 0) / safePayrolls.length;
      return Math.round((avgGross * 1.02) / 173.3);
    }

    // Default South African workshop benchmark mechanic cost rate (billed at R550-R650/hr)
    return 185;
  }, [safeEmployees, safePayrolls]);

  // Interactive labor cost rate tuning (defaults to auto-calculated)
  const [laborCostPerHour, setLaborCostPerHour] = useState<number>(defaultCalculatedHourlyCost);
  const [isTuningLaborRate, setIsTuningLaborRate] = useState(false);

  // Timeframe filter state
  const [timeframe, setTimeframe] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_90_DAYS' | 'THIS_YEAR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [marginFilter, setMarginFilter] = useState<'ALL' | 'HIGH' | 'HEALTHY' | 'LOW'>('ALL');
  const [activeTab, setActiveTab] = useState<'SERVICES' | 'JOBS' | 'ANALYTICS'>('SERVICES');
  const [sortJobsBy, setSortJobsBy] = useState<'PROFIT_DESC' | 'MARGIN_DESC' | 'REVENUE_DESC' | 'DATE_DESC'>('PROFIT_DESC');

  // Modal for Job Detail Breakdown
  const [selectedJobModal, setSelectedJobModal] = useState<JobProfitDetail | null>(null);

  // Helper to categorize job description
  const detectServiceCategory = (jobDesc: string, items: LineItem[]): string => {
    const descLower = (jobDesc || '').toLowerCase();
    const itemNamesLower = items.map((i) => (i.description || '').toLowerCase()).join(' ');
    const combined = `${descLower} ${itemNamesLower}`;

    if (
      combined.includes('minor service') ||
      combined.includes('lube service') ||
      combined.includes('oil service') ||
      combined.includes('15 000km') ||
      combined.includes('10 000km') ||
      combined.includes('15000') ||
      combined.includes('5000')
    ) {
      return 'Minor Lube Service';
    }
    if (
      combined.includes('major service') ||
      combined.includes('full service') ||
      combined.includes('60 000km') ||
      combined.includes('90 000km') ||
      combined.includes('120 000km') ||
      combined.includes('60000') ||
      combined.includes('120000')
    ) {
      return 'Major Maintenance Service';
    }
    if (
      combined.includes('brake') ||
      combined.includes('pad') ||
      combined.includes('disc') ||
      combined.includes('caliper') ||
      combined.includes('rotor')
    ) {
      return 'Brakes & Friction';
    }
    if (
      combined.includes('clutch') ||
      combined.includes('flywheel') ||
      combined.includes('gearbox') ||
      combined.includes('transmission')
    ) {
      return 'Clutch & Transmission';
    }
    if (
      combined.includes('shock') ||
      combined.includes('strut') ||
      combined.includes('suspension') ||
      combined.includes('control arm') ||
      combined.includes('ball joint') ||
      combined.includes('wheel bearing') ||
      combined.includes('alignment')
    ) {
      return 'Suspension & Steering';
    }
    if (
      combined.includes('timing') ||
      combined.includes('water pump') ||
      combined.includes('radiator') ||
      combined.includes('cooling') ||
      combined.includes('thermostat') ||
      combined.includes('fan belt') ||
      combined.includes('cam belt')
    ) {
      return 'Engine Timing & Cooling';
    }
    if (
      combined.includes('diagnostic') ||
      combined.includes('electrical') ||
      combined.includes('battery') ||
      combined.includes('alternator') ||
      combined.includes('starter') ||
      combined.includes('wiring') ||
      combined.includes('scan')
    ) {
      return 'Diagnostics & Auto Electrical';
    }
    if (
      combined.includes('exhaust') ||
      combined.includes('turbo') ||
      combined.includes('intercooler') ||
      combined.includes('dpf')
    ) {
      return 'Exhaust & Induction';
    }

    return 'General Repairs & Mechanical';
  };

  // 2. Compute Job-by-Job Profit Details for every invoice
  const allJobProfitDetails: JobProfitDetail[] = useMemo(() => {
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7); // e.g. "2026-08"

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${(lastMonthDate.getMonth() + 1).toString().padStart(2, '0')}`;

    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const currentYear = now.getFullYear().toString();

    return safeInvoices.map((inv) => {
      const items = Array.isArray(inv.items) ? inv.items : [];
      let partsRevenue = 0;
      let partsCost = 0;
      let laborRevenue = 0;
      let laborHours = 0;
      let laborCost = 0;
      let outsourcedRevenue = 0;
      let outsourcedCost = 0;
      let diagnosticRevenue = 0;
      let diagnosticCost = 0;

      const itemsBreakdown = items.map((line) => {
        const lineTotalExVat = line.totalExVat || line.quantity * line.unitPrice || 0;
        let unitCost = 0;
        let lineTotalCost = 0;
        let isInventoryLinked = false;
        let partSku: string | undefined = undefined;

        if (line.type === 'PART') {
          partsRevenue += lineTotalExVat;

          // Lookup in inventory data
          let matchedPart: InventoryItem | undefined;
          if (line.partId) {
            matchedPart = safeInventory.find((p) => p.id === line.partId);
          }
          if (!matchedPart && line.sku) {
            matchedPart = safeInventory.find((p) => p.sku === line.sku);
          }
          if (!matchedPart && line.description) {
            const descLower = line.description.toLowerCase();
            matchedPart = safeInventory.find(
              (p) => p.name.toLowerCase() === descLower || descLower.includes(p.name.toLowerCase())
            );
          }

          if (matchedPart && typeof matchedPart.costPrice === 'number' && matchedPart.costPrice > 0) {
            unitCost = matchedPart.costPrice;
            lineTotalCost = matchedPart.costPrice * line.quantity;
            isInventoryLinked = true;
            partSku = matchedPart.sku;
          } else {
            // Fallback uncatalogued cost estimate (typical 35% markup over trade cost -> cost = 65%)
            unitCost = Math.round(line.unitPrice * 0.65 * 100) / 100;
            lineTotalCost = Math.round(lineTotalExVat * 0.65 * 100) / 100;
            isInventoryLinked = false;
          }
          partsCost += lineTotalCost;
        } else if (line.type === 'LABOR') {
          laborRevenue += lineTotalExVat;
          const hours = Number(line.quantity) || 1;
          laborHours += hours;
          unitCost = laborCostPerHour;
          lineTotalCost = hours * laborCostPerHour;
          laborCost += lineTotalCost;
        } else if (line.type === 'DIAGNOSTIC') {
          diagnosticRevenue += lineTotalExVat;
          const hours = Number(line.quantity) || 0.5;
          unitCost = laborCostPerHour;
          lineTotalCost = hours * laborCostPerHour;
          diagnosticCost += lineTotalCost;
        } else if (line.type === 'OUTSOURCED') {
          outsourcedRevenue += lineTotalExVat;
          // Outsourced engineering usually costs 75% of billed price
          unitCost = Math.round(line.unitPrice * 0.75 * 100) / 100;
          lineTotalCost = Math.round(lineTotalExVat * 0.75 * 100) / 100;
          outsourcedCost += lineTotalCost;
        }

        const lineProfit = lineTotalExVat - lineTotalCost;
        const lineMarginPercent = lineTotalExVat > 0 ? Math.round((lineProfit / lineTotalExVat) * 100) : 0;

        return {
          id: line.id || Math.random().toString(),
          description: line.description || 'Line Item',
          type: line.type || 'PART',
          quantity: line.quantity || 1,
          unitPrice: line.unitPrice || 0,
          totalExVat: lineTotalExVat,
          unitCost,
          totalCost: lineTotalCost,
          profit: lineProfit,
          marginPercent: lineMarginPercent,
          isInventoryLinked,
          partSku,
        };
      });

      const totalRevenueExVat = inv.subtotalExVat || items.reduce((s, i) => s + (i.totalExVat || 0), 0);
      const totalRevenueIncVat = inv.totalIncVat || Math.round(totalRevenueExVat * 1.15 * 100) / 100;
      const totalCost = partsCost + laborCost + outsourcedCost + diagnosticCost;
      const netProfit = totalRevenueExVat - totalCost;
      const marginPercent = totalRevenueExVat > 0 ? Math.round((netProfit / totalRevenueExVat) * 100) : 0;

      const partsProfit = partsRevenue - partsCost;
      const partsMarginPercent = partsRevenue > 0 ? Math.round((partsProfit / partsRevenue) * 100) : 0;

      const totalLaborCombinedRevenue = laborRevenue + diagnosticRevenue;
      const totalLaborCombinedCost = laborCost + diagnosticCost;
      const laborProfit = totalLaborCombinedRevenue - totalLaborCombinedCost;
      const laborMarginPercent =
        totalLaborCombinedRevenue > 0
          ? Math.round((laborProfit / totalLaborCombinedRevenue) * 100)
          : 0;

      const category = detectServiceCategory(inv.jobDescription || '', items);

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date || '',
        customerId: inv.customerId || '',
        customerName: inv.customerName || 'Walk-in Customer',
        vehicleReg: inv.vehicleReg || 'N/A',
        vehicleMakeModel: inv.vehicleMakeModel || 'Unknown Vehicle',
        jobDescription: inv.jobDescription || 'Workshop Repair Service',
        serviceCategory: category,
        totalRevenueExVat,
        totalRevenueIncVat,
        partsRevenue,
        partsCost,
        partsProfit,
        partsMarginPercent,
        laborRevenue: totalLaborCombinedRevenue,
        laborHours,
        laborCost: totalLaborCombinedCost,
        laborProfit,
        laborMarginPercent,
        outsourcedRevenue,
        outsourcedCost,
        diagnosticRevenue,
        diagnosticCost,
        totalCost,
        netProfit,
        marginPercent,
        status: inv.status || 'UNPAID',
        itemsBreakdown,
      };
    });
  }, [safeInvoices, safeInventory, laborCostPerHour]);

  // 3. Apply timeframe and search filtering to jobs
  const filteredJobs = useMemo(() => {
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${(lastMonthDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const currentYear = now.getFullYear().toString();

    return allJobProfitDetails
      .filter((job) => {
        // Timeframe filter
        if (timeframe === 'THIS_MONTH' && !job.date.startsWith(currentMonthKey)) return false;
        if (timeframe === 'LAST_MONTH' && !job.date.startsWith(lastMonthKey)) return false;
        if (timeframe === 'LAST_90_DAYS') {
          const jobDate = new Date(job.date);
          if (isNaN(jobDate.getTime()) || jobDate < ninetyDaysAgo) return false;
        }
        if (timeframe === 'THIS_YEAR' && !job.date.startsWith(currentYear)) return false;

        // Category filter
        if (selectedCategoryFilter !== 'ALL' && job.serviceCategory !== selectedCategoryFilter) {
          return false;
        }

        // Margin filter
        if (marginFilter === 'HIGH' && job.marginPercent < 50) return false;
        if (marginFilter === 'HEALTHY' && (job.marginPercent < 30 || job.marginPercent >= 50)) return false;
        if (marginFilter === 'LOW' && job.marginPercent >= 30) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchInv = job.invoiceNumber.toLowerCase().includes(q);
          const matchCust = job.customerName.toLowerCase().includes(q);
          const matchVeh = job.vehicleReg.toLowerCase().includes(q) || job.vehicleMakeModel.toLowerCase().includes(q);
          const matchJob = job.jobDescription.toLowerCase().includes(q);
          const matchCat = job.serviceCategory.toLowerCase().includes(q);
          if (!matchInv && !matchCust && !matchVeh && !matchJob && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortJobsBy === 'PROFIT_DESC') return b.netProfit - a.netProfit;
        if (sortJobsBy === 'MARGIN_DESC') return b.marginPercent - a.marginPercent;
        if (sortJobsBy === 'REVENUE_DESC') return b.totalRevenueExVat - a.totalRevenueExVat;
        return b.date.localeCompare(a.date);
      });
  }, [allJobProfitDetails, timeframe, selectedCategoryFilter, marginFilter, searchQuery, sortJobsBy]);

  // 4. Aggregate Top-Performing Services Breakdown
  const serviceCategoryStats: ServiceCategoryStat[] = useMemo(() => {
    const categoryMap = new Map<string, {
      jobsCount: number;
      totalRevenue: number;
      totalPartsCost: number;
      totalLaborCost: number;
      totalOutsourcedCost: number;
      totalCost: number;
      totalProfit: number;
      totalLaborHours: number;
    }>();

    // Group filtered jobs by category
    filteredJobs.forEach((job) => {
      const cat = job.serviceCategory || 'General Repairs';
      const existing = categoryMap.get(cat) || {
        jobsCount: 0,
        totalRevenue: 0,
        totalPartsCost: 0,
        totalLaborCost: 0,
        totalOutsourcedCost: 0,
        totalCost: 0,
        totalProfit: 0,
        totalLaborHours: 0,
      };

      existing.jobsCount += 1;
      existing.totalRevenue += job.totalRevenueExVat;
      existing.totalPartsCost += job.partsCost;
      existing.totalLaborCost += job.laborCost;
      existing.totalOutsourcedCost += job.outsourcedCost;
      existing.totalCost += job.totalCost;
      existing.totalProfit += job.netProfit;
      existing.totalLaborHours += job.laborHours;

      categoryMap.set(cat, existing);
    });

    const result: ServiceCategoryStat[] = [];
    categoryMap.forEach((val, key) => {
      const averageMarginPercent = val.totalRevenue > 0 ? Math.round((val.totalProfit / val.totalRevenue) * 100) : 0;
      const averageTicketRevenue = val.jobsCount > 0 ? Math.round(val.totalRevenue / val.jobsCount) : 0;
      const averageProfitPerJob = val.jobsCount > 0 ? Math.round(val.totalProfit / val.jobsCount) : 0;

      result.push({
        category: key,
        jobsCount: val.jobsCount,
        totalRevenue: val.totalRevenue,
        totalPartsCost: val.totalPartsCost,
        totalLaborCost: val.totalLaborCost,
        totalOutsourcedCost: val.totalOutsourcedCost,
        totalCost: val.totalCost,
        totalProfit: val.totalProfit,
        averageMarginPercent,
        averageTicketRevenue,
        averageProfitPerJob,
        totalLaborHours: val.totalLaborHours,
        iconType: key,
      });
    });

    // Sort by Total Profit descending
    return result.sort((a, b) => b.totalProfit - a.totalProfit);
  }, [filteredJobs]);

  // 5. Executive KPI Summaries
  const kpiSummary = useMemo(() => {
    const totalRevenue = filteredJobs.reduce((s, j) => s + j.totalRevenueExVat, 0);
    const totalCost = filteredJobs.reduce((s, j) => s + j.totalCost, 0);
    const totalPartsCost = filteredJobs.reduce((s, j) => s + j.partsCost, 0);
    const totalPartsRevenue = filteredJobs.reduce((s, j) => s + j.partsRevenue, 0);
    const totalLaborCost = filteredJobs.reduce((s, j) => s + j.laborCost, 0);
    const totalLaborRevenue = filteredJobs.reduce((s, j) => s + j.laborRevenue, 0);
    const totalNetProfit = totalRevenue - totalCost;
    const overallMarginPercent = totalRevenue > 0 ? Math.round((totalNetProfit / totalRevenue) * 100) : 0;

    const partsMarginPercent = totalPartsRevenue > 0 ? Math.round(((totalPartsRevenue - totalPartsCost) / totalPartsRevenue) * 100) : 0;
    const laborMarginPercent = totalLaborRevenue > 0 ? Math.round(((totalLaborRevenue - totalLaborCost) / totalLaborRevenue) * 100) : 0;

    const totalJobsCount = filteredJobs.length;
    const avgProfitPerJob = totalJobsCount > 0 ? Math.round(totalNetProfit / totalJobsCount) : 0;
    const avgTicketSize = totalJobsCount > 0 ? Math.round(totalRevenue / totalJobsCount) : 0;

    const topProfitService = serviceCategoryStats.length > 0 ? serviceCategoryStats[0] : null;
    const highestMarginService = [...serviceCategoryStats].sort((a, b) => b.averageMarginPercent - a.averageMarginPercent)[0] || null;

    return {
      totalRevenue,
      totalCost,
      totalPartsCost,
      totalPartsRevenue,
      totalLaborCost,
      totalLaborRevenue,
      totalNetProfit,
      overallMarginPercent,
      partsMarginPercent,
      laborMarginPercent,
      totalJobsCount,
      avgProfitPerJob,
      avgTicketSize,
      topProfitService,
      highestMarginService,
    };
  }, [filteredJobs, serviceCategoryStats]);

  // 6. Chart Data Preparation
  const serviceChartData = useMemo(() => {
    return serviceCategoryStats.slice(0, 7).map((s) => ({
      name: s.category.replace(' & ', '\n& ').replace(' Service', ''),
      fullName: s.category,
      Revenue: s.totalRevenue,
      PartsCost: s.totalPartsCost,
      LaborCost: s.totalLaborCost,
      NetProfit: s.totalProfit,
      Margin: s.averageMarginPercent,
      Jobs: s.jobsCount,
    }));
  }, [serviceCategoryStats]);

  const costBreakdownPieData = useMemo(() => {
    if (kpiSummary.totalRevenue <= 0) return [];
    return [
      { name: 'Net Profit', value: Math.max(0, kpiSummary.totalNetProfit), color: '#10b981' }, // Emerald
      { name: 'Parts Cost', value: kpiSummary.totalPartsCost, color: '#3b82f6' }, // Blue
      { name: 'Labor Cost', value: kpiSummary.totalLaborCost, color: '#f59e0b' }, // Amber
      {
        name: 'Outsourced / Other',
        value: Math.max(0, kpiSummary.totalCost - kpiSummary.totalPartsCost - kpiSummary.totalLaborCost),
        color: '#8b5cf6',
      },
    ].filter((item) => item.value > 0);
  }, [kpiSummary]);

  // Export to CSV helper
  const handleExportCSV = () => {
    const headers = [
      'Invoice Number',
      'Date',
      'Customer',
      'Vehicle Reg',
      'Service Category',
      'Job Description',
      'Total Ex VAT (ZAR)',
      'Parts Cost (ZAR)',
      'Parts Revenue (ZAR)',
      'Parts Margin %',
      'Labor Cost (ZAR)',
      'Labor Revenue (ZAR)',
      'Labor Margin %',
      'Total Cost (ZAR)',
      'Net Profit (ZAR)',
      'Profit Margin %',
    ];

    const rows = filteredJobs.map((j) => [
      `"${j.invoiceNumber}"`,
      `"${j.date}"`,
      `"${j.customerName.replace(/"/g, '""')}"`,
      `"${j.vehicleReg}"`,
      `"${j.serviceCategory}"`,
      `"${j.jobDescription.replace(/"/g, '""')}"`,
      j.totalRevenueExVat.toFixed(2),
      j.partsCost.toFixed(2),
      j.partsRevenue.toFixed(2),
      `${j.partsMarginPercent}%`,
      j.laborCost.toFixed(2),
      j.laborRevenue.toFixed(2),
      `${j.laborMarginPercent}%`,
      j.totalCost.toFixed(2),
      j.netProfit.toFixed(2),
      `${j.marginPercent}%`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Workshop_Job_Profitability_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Card with Live Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 text-white shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Financial Telemetry & ROI Engine
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Live Inventory Deductions & Technician Wage Costing
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white mt-1 flex items-center space-x-2">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
              <span>Workshop Profitability & Job Margin Matrix</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Calculates precise job profit by deducting linked spare part acquisition costs (from Inventory) and technician payroll rate (R{laborCostPerHour}/hr) from invoiced amounts.
            </p>
          </div>

          {/* Right Action Tools: Labor Cost Adjustment & Export */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            {/* Labor Rate Tuning Button */}
            <button
              type="button"
              id="tune-labor-cost-btn"
              onClick={() => setIsTuningLaborRate(!isTuningLaborRate)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                isTuningLaborRate
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Cost Basis: R{laborCostPerHour}/hr labor</span>
            </button>

            {/* CSV Export */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredJobs.length === 0}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger</span>
            </button>
          </div>
        </div>

        {/* Expandable Labor Cost Rate Tuning Banner */}
        {isTuningLaborRate && (
          <div className="bg-slate-950/90 rounded-xl p-4 border border-amber-500/40 space-y-3 animate-in slide-in-from-top duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200">
                  Technician Wage Cost Basis Simulator
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Current active technician roster avg: <strong className="text-emerald-400">R{defaultCalculatedHourlyCost}/hr</strong> (Basic salary + UIF + SDL)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-xs">
              <div className="sm:col-span-2 space-y-1">
                <div className="flex justify-between text-slate-300 text-[11px] font-semibold">
                  <span>Simulated Workshop Labor Cost / Hour:</span>
                  <span className="font-mono font-bold text-amber-400">R{laborCostPerHour} / hr</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="450"
                  step="5"
                  value={laborCostPerHour}
                  onChange={(e) => setLaborCostPerHour(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Apprentice (R100)</span>
                  <span>Service Mech (R185)</span>
                  <span>Master Tech (R280)</span>
                  <span>High Overhead (R400+)</span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setLaborCostPerHour(defaultCalculatedHourlyCost)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                >
                  Reset to Auto
                </button>
                <button
                  type="button"
                  onClick={() => setIsTuningLaborRate(false)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors"
                >
                  Apply Rate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation & Timeframe Pill Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {/* Main View Tabs */}
          <div className="flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('SERVICES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                activeTab === 'SERVICES'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Top-Performing Services</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('JOBS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                activeTab === 'JOBS'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Job-by-Job Margin Ledger ({filteredJobs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ANALYTICS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                activeTab === 'ANALYTICS'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Cost & Margin Analytics</span>
            </button>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Period:</span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="bg-slate-800 font-bold text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Recorded Jobs</option>
              <option value="THIS_MONTH">This Month ({new Date().toISOString().slice(0, 7)})</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="LAST_90_DAYS">Last 90 Days</option>
              <option value="THIS_YEAR">Year to Date ({new Date().getFullYear()})</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Top-Level 4 KPI Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Net Workshop Gross Profit */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Net Job Profit</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black font-mono text-emerald-600">
            {formatZAR(kpiSummary.totalNetProfit)}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Overall Gross Margin:</span>
            <span className="font-bold text-slate-900">{kpiSummary.overallMarginPercent}%</span>
          </div>
        </div>

        {/* Card 2: Parts Cost vs Markup Margin */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Parts & Spares Cost</span>
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-800">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black font-mono text-slate-900">
            {formatZAR(kpiSummary.totalPartsCost)}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Parts Markup Margin:</span>
            <span className="font-bold text-blue-600">{kpiSummary.partsMarginPercent}% margin</span>
          </div>
        </div>

        {/* Card 3: Labor Cost vs Labor Margin */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Labor Wage Outlay</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black font-mono text-slate-900">
            {formatZAR(kpiSummary.totalLaborCost)}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Labor Yield Margin:</span>
            <span className="font-bold text-amber-600">{kpiSummary.laborMarginPercent}% margin</span>
          </div>
        </div>

        {/* Card 4: Top Service Performer */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Top Profit Service</span>
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-800">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">
            {kpiSummary.topProfitService?.category || 'No jobs logged'}
          </h4>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Avg Profit / Job:</span>
            <span className="font-bold font-mono text-emerald-600">
              {kpiSummary.topProfitService ? formatZAR(kpiSummary.topProfitService.averageProfitPerJob) : 'R0'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. TAB 1: TOP PERFORMING SERVICES BREAKDOWN */}
      {activeTab === 'SERVICES' && (
        <div className="space-y-6">
          {/* Visual Service Profitability Matrix Recharts */}
          {serviceChartData.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    <span>Top Services Revenue vs. Cost vs. Net Profit Matrix</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Compares gross revenue against parts acquisition and technician labor costs per service line
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {serviceCategoryStats.length} distinct service categories
                </span>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={serviceChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#64748b"
                      fontSize={10}
                      tickFormatter={(val) => `R${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#10b981"
                      fontSize={10}
                      tickFormatter={(val) => `${val}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      formatter={(val: any, name: string) => {
                        if (name === 'Margin') return [`${val}%`, 'Profit Margin'];
                        return [formatZAR(Number(val)), name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.fullName;
                        }
                        return label;
                      }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        color: '#fff',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    />
                    <Bar yAxisId="left" dataKey="Revenue" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Gross Revenue" />
                    <Bar yAxisId="left" dataKey="PartsCost" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Parts Cost" />
                    <Bar yAxisId="left" dataKey="LaborCost" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Labor Cost" />
                    <Bar yAxisId="left" dataKey="NetProfit" fill="#10b981" radius={[4, 4, 0, 0]} name="Net Profit" />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="Margin"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#059669' }}
                      name="Margin %"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Detailed Service Cards Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Service Category Profitability Ranking</span>
              </h3>
              <span className="text-xs text-slate-500">
                Sorted by total workshop net profit generated
              </span>
            </div>

            {serviceCategoryStats.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serviceCategoryStats.map((service, idx) => {
                  const isTopPerformer = idx === 0;
                  const isHighMargin = service.averageMarginPercent >= 50;

                  return (
                    <div
                      key={service.category}
                      className={`bg-white rounded-2xl border p-5 shadow-xs space-y-4 transition-all hover:shadow-md ${
                        isTopPerformer
                          ? 'border-emerald-300 ring-1 ring-emerald-200 bg-gradient-to-b from-emerald-50/20 to-white'
                          : 'border-slate-200'
                      }`}
                    >
                      {/* Card Header: Rank, Title, Margin Badge */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-black text-xs ${
                              idx === 0
                                ? 'bg-amber-400 text-slate-950'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-900'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div>
                            <h4 className="font-black text-slate-900 text-sm leading-snug">
                              {service.category}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {service.jobsCount} {service.jobsCount === 1 ? 'job completed' : 'jobs completed'} • {service.totalLaborHours} labor hrs
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded-full border shrink-0 ${
                            service.averageMarginPercent >= 50
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : service.averageMarginPercent >= 30
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {service.averageMarginPercent}% Margin
                        </span>
                      </div>

                      {/* Financial Key Numbers Strip */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Net Profit</span>
                          <span className="text-base font-black font-mono text-emerald-600">
                            {formatZAR(service.totalProfit)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Gross Invoiced</span>
                          <span className="text-base font-black font-mono text-slate-900">
                            {formatZAR(service.totalRevenue)}
                          </span>
                        </div>
                      </div>

                      {/* Cost Breakdown Progress Bars */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                          <span>Cost Composition:</span>
                          <span className="font-mono text-slate-500">
                            Parts {formatZAR(service.totalPartsCost)} | Labor {formatZAR(service.totalLaborCost)}
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                          <div
                            style={{
                              width: `${service.totalRevenue > 0 ? (service.totalPartsCost / service.totalRevenue) * 100 : 0}%`,
                            }}
                            className="bg-blue-500 h-full"
                            title={`Parts Cost: ${formatZAR(service.totalPartsCost)}`}
                          ></div>
                          <div
                            style={{
                              width: `${service.totalRevenue > 0 ? (service.totalLaborCost / service.totalRevenue) * 100 : 0}%`,
                            }}
                            className="bg-amber-500 h-full"
                            title={`Labor Cost: ${formatZAR(service.totalLaborCost)}`}
                          ></div>
                          <div
                            style={{
                              width: `${service.totalRevenue > 0 ? (service.totalProfit / service.totalRevenue) * 100 : 0}%`,
                            }}
                            className="bg-emerald-500 h-full"
                            title={`Net Profit: ${formatZAR(service.totalProfit)}`}
                          ></div>
                        </div>

                        <div className="flex justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                          <span className="flex items-center space-x-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                            <span>Parts ({service.totalRevenue > 0 ? Math.round((service.totalPartsCost / service.totalRevenue) * 100) : 0}%)</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                            <span>Labor ({service.totalRevenue > 0 ? Math.round((service.totalLaborCost / service.totalRevenue) * 100) : 0}%)</span>
                          </span>
                          <span className="flex items-center space-x-1 font-bold text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                            <span>Profit ({service.averageMarginPercent}%)</span>
                          </span>
                        </div>
                      </div>

                      {/* Averages Footer & Filter Quick-Link */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Avg Profit / Job:</span>
                          <span className="font-bold font-mono text-slate-800">
                            {formatZAR(service.averageProfitPerJob)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategoryFilter(service.category);
                            setActiveTab('JOBS');
                          }}
                          className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <span>Inspect Jobs</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-900 text-sm">No Jobs Recorded in this Period</h4>
                <p className="text-xs text-slate-400">
                  Generate workshop invoices with parts and labor line items to calculate live profit margins.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 2: JOB-BY-JOB PROFIT MARGIN LEDGER */}
      {activeTab === 'JOBS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          {/* Header, Search & Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Job-by-Job Profitability Ledger</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Detailed itemized margin breakdown for each workshop tax invoice
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {/* Search Bar */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search invoice, vehicle, client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Service Category Filter */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Service Types</option>
                {Array.from(new Set(allJobProfitDetails.map((j) => j.serviceCategory))).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Margin Filter */}
              <select
                value={marginFilter}
                onChange={(e) => setMarginFilter(e.target.value as any)}
                className="bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Margins</option>
                <option value="HIGH">High Margin (&gt;=50%)</option>
                <option value="HEALTHY">Healthy (30% - 50%)</option>
                <option value="LOW">Thin Margin (&lt;30%)</option>
              </select>

              {/* Sort selector */}
              <select
                value={sortJobsBy}
                onChange={(e) => setSortJobsBy(e.target.value as any)}
                className="bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="PROFIT_DESC">Sort: Net Profit (High to Low)</option>
                <option value="MARGIN_DESC">Sort: Margin % (High to Low)</option>
                <option value="REVENUE_DESC">Sort: Revenue (High to Low)</option>
                <option value="DATE_DESC">Sort: Date (Newest First)</option>
              </select>
            </div>
          </div>

          {/* Filter Status Strip if active */}
          {(selectedCategoryFilter !== 'ALL' || marginFilter !== 'ALL' || searchQuery) && (
            <div className="flex items-center space-x-2 text-xs bg-slate-50 p-2 rounded-xl text-slate-600">
              <span className="font-semibold">Active Filters:</span>
              {selectedCategoryFilter !== 'ALL' && (
                <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-bold">
                  {selectedCategoryFilter}
                </span>
              )}
              {marginFilter !== 'ALL' && (
                <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-bold">
                  Margin: {marginFilter}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter('ALL');
                  setMarginFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-emerald-700 hover:text-emerald-800 font-bold ml-auto text-[11px]"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Jobs Table */}
          {filteredJobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <th className="p-3.5">Invoice & Customer</th>
                    <th className="p-3.5">Vehicle & Service</th>
                    <th className="p-3.5 text-right">Invoiced (Ex VAT)</th>
                    <th className="p-3.5 text-right">Parts Cost</th>
                    <th className="p-3.5 text-right">Labor Cost</th>
                    <th className="p-3.5 text-right font-bold text-emerald-800">Net Profit</th>
                    <th className="p-3.5 text-center">Margin %</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredJobs.map((job) => (
                    <tr
                      key={job.invoiceId}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedJobModal(job)}
                    >
                      {/* Invoice & Customer */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-black text-slate-900">
                            {job.invoiceNumber}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              job.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : job.status === 'PARTIALLY_PAID'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {job.status}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800 mt-0.5">{job.customerName}</p>
                        <p className="text-[10px] text-slate-400">{job.date}</p>
                      </td>

                      {/* Vehicle & Service */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-1">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            {job.vehicleReg}
                          </span>
                          <span className="text-slate-600 truncate max-w-[150px]">
                            {job.vehicleMakeModel}
                          </span>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded inline-block mt-1">
                          {job.serviceCategory}
                        </span>
                      </td>

                      {/* Invoiced Ex VAT */}
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        {formatZAR(job.totalRevenueExVat)}
                      </td>

                      {/* Parts Cost */}
                      <td className="p-3.5 text-right font-mono text-slate-600">
                        <div>{formatZAR(job.partsCost)}</div>
                        <span className="text-[10px] text-blue-600 font-semibold">
                          {job.partsMarginPercent}% markup
                        </span>
                      </td>

                      {/* Labor Cost */}
                      <td className="p-3.5 text-right font-mono text-slate-600">
                        <div>{formatZAR(job.laborCost)}</div>
                        <span className="text-[10px] text-slate-400">
                          {job.laborHours} hrs @ R{laborCostPerHour}
                        </span>
                      </td>

                      {/* Net Profit */}
                      <td className="p-3.5 text-right font-mono font-black text-emerald-600 text-sm">
                        {formatZAR(job.netProfit)}
                      </td>

                      {/* Margin % */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block font-black font-mono text-xs px-2 py-0.5 rounded-full border ${
                            job.marginPercent >= 50
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : job.marginPercent >= 30
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : job.marginPercent >= 15
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          {job.marginPercent}%
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJobModal(job);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 transition-colors"
                          title="Inspect Line-Item Cost Breakdown"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <p className="font-semibold text-sm">No jobs match the active filters.</p>
              <p className="text-xs mt-1">Try selecting a broader timeframe or clearing the search query.</p>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: COST & MARGIN ANALYTICS */}
      {activeTab === 'ANALYTICS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: Cost Composition Breakdown Pie & Summary */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                <PieIcon className="w-4 h-4 text-emerald-600" />
                <span>Workshop Expense & Profit Distribution</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Where every Rand of workshop revenue goes: Parts vs. Labor vs. Gross Net Profit
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costBreakdownPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {costBreakdownPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatZAR(Number(val)), 'Amount']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        color: '#fff',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Breakdown Legend with % Shares */}
              <div className="space-y-2.5 text-xs">
                {costBreakdownPieData.map((item) => {
                  const sharePercent =
                    kpiSummary.totalRevenue > 0
                      ? Math.round((item.value / kpiSummary.totalRevenue) * 100)
                      : 0;

                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="font-semibold text-slate-800">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900 block">{formatZAR(item.value)}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{sharePercent}% of revenue</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Practical Workshop Recommendations Box */}
            <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-200 space-y-2 text-xs text-emerald-950">
              <div className="flex items-center space-x-2 font-bold text-emerald-900">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Executive Profitability Takeaways</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-emerald-900 pl-4 list-disc">
                <li>
                  <strong>Top Yield Category:</strong> {kpiSummary.highestMarginService?.category || 'Diagnostics'} delivers the highest profit margin at <strong>{kpiSummary.highestMarginService?.averageMarginPercent || 0}%</strong> due to low parts dependency.
                </li>
                <li>
                  <strong>Parts Cost Impact:</strong> Parts account for <strong>{kpiSummary.totalRevenue > 0 ? Math.round((kpiSummary.totalPartsCost / kpiSummary.totalRevenue) * 100) : 0}%</strong> of gross turnover. Ensuring at least a 35% mark-up on fast-moving filters and brake pads protects margins.
                </li>
                <li>
                  <strong>Technician Labor Efficiency:</strong> Workshop generates an effective <strong>{formatZAR((settings?.defaultLaborRateExVat || 550) - laborCostPerHour)}/hr</strong> gross contribution above base technician wage.
                </li>
              </ul>
            </div>
          </div>

          {/* Right 5 Cols: Profit Margin Distribution Histogram */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Margin Health Distribution</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Categorization of all completed jobs by margin threshold
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {/* Ultra High: >50% */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                <div className="flex justify-between font-bold text-emerald-900">
                  <span>High Margin (&gt;= 50%)</span>
                  <span>{filteredJobs.filter((j) => j.marginPercent >= 50).length} jobs</span>
                </div>
                <div className="w-full bg-emerald-200 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full"
                    style={{
                      width: `${filteredJobs.length > 0 ? (filteredJobs.filter((j) => j.marginPercent >= 50).length / filteredJobs.length) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
                <p className="text-[10px] text-emerald-700">Diagnostic scans, minor services, electrical checks</p>
              </div>

              {/* Healthy: 30-50% */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                <div className="flex justify-between font-bold text-blue-900">
                  <span>Healthy Target (30% - 50%)</span>
                  <span>{filteredJobs.filter((j) => j.marginPercent >= 30 && j.marginPercent < 50).length} jobs</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${filteredJobs.length > 0 ? (filteredJobs.filter((j) => j.marginPercent >= 30 && j.marginPercent < 50).length / filteredJobs.length) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
                <p className="text-[10px] text-blue-700">Brake overhauls, major services, suspension replacement</p>
              </div>

              {/* Thin Margin: <30% */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <div className="flex justify-between font-bold text-amber-900">
                  <span>Thin Margin (&lt; 30%)</span>
                  <span>{filteredJobs.filter((j) => j.marginPercent < 30).length} jobs</span>
                </div>
                <div className="w-full bg-amber-200 rounded-full h-2">
                  <div
                    className="bg-amber-600 h-2 rounded-full"
                    style={{
                      width: `${filteredJobs.length > 0 ? (filteredJobs.filter((j) => j.marginPercent < 30).length / filteredJobs.length) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
                <p className="text-[10px] text-amber-700">High parts-cost engine overhauls or outsourced machining</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-700 font-semibold">
                <span>Average Revenue per Job:</span>
                <span className="font-mono font-bold text-slate-900">{formatZAR(kpiSummary.avgTicketSize)}</span>
              </div>
              <div className="flex justify-between text-slate-700 font-semibold">
                <span>Average Profit per Job:</span>
                <span className="font-mono font-bold text-emerald-600">{formatZAR(kpiSummary.avgProfitPerJob)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: LINE-ITEM JOB PROFITABILITY INSPECTOR */}
      {selectedJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black text-xs bg-emerald-500 text-slate-950 px-2 py-0.5 rounded">
                    {selectedJobModal.invoiceNumber}
                  </span>
                  <span className="text-xs text-slate-400">{selectedJobModal.date}</span>
                </div>
                <h3 className="font-bold text-base text-white mt-1">
                  {selectedJobModal.jobDescription}
                </h3>
                <p className="text-xs text-slate-400">
                  Customer: <strong className="text-slate-200">{selectedJobModal.customerName}</strong> • Vehicle: <strong className="text-emerald-400">{selectedJobModal.vehicleReg} ({selectedJobModal.vehicleMakeModel})</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedJobModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {/* Summary 3-Box Financial Strip */}
              <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Invoiced (Ex VAT)</span>
                  <span className="font-mono font-black text-sm text-slate-900">
                    {formatZAR(selectedJobModal.totalRevenueExVat)}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Inc VAT: {formatZAR(selectedJobModal.totalRevenueIncVat)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Job Cost</span>
                  <span className="font-mono font-black text-sm text-slate-800">
                    {formatZAR(selectedJobModal.totalCost)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Parts: {formatZAR(selectedJobModal.partsCost)} | Labor: {formatZAR(selectedJobModal.laborCost)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Job Profit</span>
                  <span className="font-mono font-black text-sm text-emerald-600">
                    {formatZAR(selectedJobModal.netProfit)}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 block">
                    {selectedJobModal.marginPercent}% Net Margin
                  </span>
                </div>
              </div>

              {/* Line Items Dissection Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                  <Wrench className="w-3.5 h-3.5 text-slate-500" />
                  <span>Itemized Parts & Labor Margin Dissection</span>
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[9px]">
                      <tr>
                        <th className="p-2.5">Line Description</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5 text-right">Billed Price</th>
                        <th className="p-2.5 text-right">Unit Cost</th>
                        <th className="p-2.5 text-right">Total Cost</th>
                        <th className="p-2.5 text-right text-emerald-700">Profit</th>
                        <th className="p-2.5 text-center">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedJobModal.itemsBreakdown.map((item, i) => (
                        <tr key={item.id || i} className="hover:bg-slate-50">
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900">{item.description}</div>
                            {item.partSku && (
                              <span className="font-mono text-[9px] text-slate-400">SKU: {item.partSku} (Inventory Linked)</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                item.type === 'PART'
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.type === 'LABOR'
                                  ? 'bg-amber-100 text-amber-900'
                                  : item.type === 'DIAGNOSTIC'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {item.type}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            {formatZAR(item.totalExVat)}
                            <span className="text-[9px] text-slate-400 block">x{item.quantity}</span>
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-500">
                            {formatZAR(item.unitCost)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-slate-700">
                            {formatZAR(item.totalCost)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-600">
                            {formatZAR(item.profit)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                item.marginPercent >= 50
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.marginPercent >= 25
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.marginPercent}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedJobModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
