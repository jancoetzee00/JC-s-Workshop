import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import {
  Gauge,
  Calendar,
  TrendingUp,
  Activity,
  Car,
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Sliders,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Vehicle, Invoice } from '../types';
import { formatZAR } from '../utils/sarsTaxEngine';

interface VehicleMileageChartProps {
  vehicles: Vehicle[];
  invoices: Invoice[];
  selectedVehicleFilter?: string; // 'ALL' or specific regNumber
  onVehicleFilterChange?: (reg: string) => void;
  serviceIntervalKm?: number;
  className?: string;
}

interface ServiceDataPoint {
  index: number;
  date: string;
  formattedDate: string;
  vehicleReg: string;
  vehicleMakeModel: string;
  mileage: number;
  mileageFormatted: string;
  mileageDelta: number;
  daysDelta: number;
  monthlyPace: number;
  invoiceNumber: string;
  jobDescription: string;
  totalIncVat: number;
  isCurrentOdometer?: boolean;
  isProjected?: boolean;
  serviceType: 'MINOR' | 'INTERMEDIATE' | 'MAJOR' | 'CURRENT' | 'PROJECTED';
  targetThreshold?: number;
}

export const VehicleMileageChart: React.FC<VehicleMileageChartProps> = ({
  vehicles = [],
  invoices = [],
  selectedVehicleFilter = 'ALL',
  onVehicleFilterChange,
  serviceIntervalKm = 15000,
  className = '',
}) => {
  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  // Internal vehicle selection if not controlled or defaulted
  const [internalVehicleReg, setInternalVehicleReg] = useState<string>(
    selectedVehicleFilter !== 'ALL' ? selectedVehicleFilter : safeVehicles[0]?.regNumber || 'ALL'
  );

  // Active visualization mode
  const [viewMode, setViewMode] = useState<'TRAJECTORY' | 'INTERVALS' | 'COMPARISON'>('TRAJECTORY');
  const [showMilestoneLines, setShowMilestoneLines] = useState<boolean>(true);
  const [showProjection, setShowProjection] = useState<boolean>(true);

  // Sync internal vehicle reg if parent filter changes to a specific vehicle
  React.useEffect(() => {
    if (selectedVehicleFilter && selectedVehicleFilter !== 'ALL') {
      setInternalVehicleReg(selectedVehicleFilter);
    } else if (selectedVehicleFilter === 'ALL' && !safeVehicles.some(v => v.regNumber === internalVehicleReg)) {
      setInternalVehicleReg(safeVehicles[0]?.regNumber || 'ALL');
    }
  }, [selectedVehicleFilter, safeVehicles]);

  const activeVehicle = useMemo(() => {
    return safeVehicles.find(v => v.regNumber === internalVehicleReg) || safeVehicles[0];
  }, [safeVehicles, internalVehicleReg]);

  const handleSelectVehicle = (reg: string) => {
    setInternalVehicleReg(reg);
    if (onVehicleFilterChange) {
      onVehicleFilterChange(reg);
    }
  };

  // Build Chronological Data Points for the selected vehicle
  const chartData = useMemo(() => {
    if (!activeVehicle) return [];

    const vehInvoices = safeInvoices
      .filter(inv => inv && inv.vehicleReg === activeVehicle.regNumber && inv.vehicleMileage && inv.vehicleMileage > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const points: ServiceDataPoint[] = [];
    let priorMileage = 0;
    let priorDate: string | null = null;

    vehInvoices.forEach((inv, idx) => {
      const currentMileage = inv.vehicleMileage || 0;
      const mileageDelta = priorMileage > 0 && currentMileage >= priorMileage ? currentMileage - priorMileage : 0;
      
      let daysDelta = 0;
      let monthlyPace = 1250;
      if (priorDate && inv.date) {
        const timeDiff = new Date(inv.date).getTime() - new Date(priorDate).getTime();
        daysDelta = Math.max(1, Math.round(timeDiff / (1000 * 60 * 60 * 24)));
        if (daysDelta > 0 && mileageDelta > 0) {
          monthlyPace = Math.round((mileageDelta / daysDelta) * 30.42);
        }
      }

      // Determine service classification
      let serviceType: ServiceDataPoint['serviceType'] = 'MINOR';
      if (currentMileage % 60000 === 0 || (inv.jobDescription && inv.jobDescription.toLowerCase().includes('major'))) {
        serviceType = 'MAJOR';
      } else if (currentMileage % 30000 === 0 || (inv.jobDescription && inv.jobDescription.toLowerCase().includes('intermediate'))) {
        serviceType = 'INTERMEDIATE';
      }

      // Format date for chart axis: "12 Mar '25"
      const d = new Date(inv.date);
      const formattedDate = !isNaN(d.getTime())
        ? `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
        : inv.date;

      points.push({
        index: idx + 1,
        date: inv.date,
        formattedDate,
        vehicleReg: inv.vehicleReg,
        vehicleMakeModel: inv.vehicleMakeModel || `${activeVehicle.make} ${activeVehicle.model}`,
        mileage: currentMileage,
        mileageFormatted: `${currentMileage.toLocaleString()} km`,
        mileageDelta,
        daysDelta,
        monthlyPace,
        invoiceNumber: inv.invoiceNumber,
        jobDescription: inv.jobDescription || 'Scheduled Maintenance Service',
        totalIncVat: inv.totalIncVat || 0,
        serviceType,
      });

      priorMileage = currentMileage;
      priorDate = inv.date;
    });

    // Check if current vehicle odometer is higher than the last invoice
    const latestServiceMileage = points[points.length - 1]?.mileage || 0;
    const currentOdo = activeVehicle.mileage || 0;

    if (currentOdo > latestServiceMileage) {
      const todayStr = new Date().toISOString().split('T')[0];
      const d = new Date();
      const formattedDate = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(2)} (Live)`;
      const mileageDelta = latestServiceMileage > 0 ? currentOdo - latestServiceMileage : 0;
      
      let daysDelta = 0;
      if (priorDate) {
        const timeDiff = Date.now() - new Date(priorDate).getTime();
        daysDelta = Math.max(1, Math.round(timeDiff / (1000 * 60 * 60 * 24)));
      }

      points.push({
        index: points.length + 1,
        date: todayStr,
        formattedDate,
        vehicleReg: activeVehicle.regNumber,
        vehicleMakeModel: `${activeVehicle.make} ${activeVehicle.model}`,
        mileage: currentOdo,
        mileageFormatted: `${currentOdo.toLocaleString()} km`,
        mileageDelta,
        daysDelta,
        monthlyPace: daysDelta > 0 && mileageDelta > 0 ? Math.round((mileageDelta / daysDelta) * 30.42) : 1250,
        invoiceNumber: 'CURRENT_ODO',
        jobDescription: 'Live Odometer Telemetry Reading',
        totalIncVat: 0,
        isCurrentOdometer: true,
        serviceType: 'CURRENT',
      });
    }

    // Add projected next service milestone if projection toggle is enabled
    if (showProjection && points.length > 0) {
      const latestPoint = points[points.length - 1];
      const targetMileage = Math.ceil((latestPoint.mileage + 1) / serviceIntervalKm) * serviceIntervalKm;
      const kmRemaining = Math.max(500, targetMileage - latestPoint.mileage);
      
      // Calculate projected date based on driving velocity
      const avgMonthlyPace = Math.max(500, points.reduce((sum, p) => sum + (p.monthlyPace || 1250), 0) / points.length);
      const daysToTarget = Math.max(15, Math.round((kmRemaining / (avgMonthlyPace / 30.42))));
      
      const projDateObj = new Date(Date.now() + daysToTarget * 86400000);
      const projDateStr = projDateObj.toISOString().split('T')[0];
      const projFormattedDate = `${projDateObj.getDate()} ${projDateObj.toLocaleString('default', { month: 'short' })} '${String(projDateObj.getFullYear()).slice(2)} (Proj)`;

      points.push({
        index: points.length + 1,
        date: projDateStr,
        formattedDate: projFormattedDate,
        vehicleReg: activeVehicle.regNumber,
        vehicleMakeModel: `${activeVehicle.make} ${activeVehicle.model}`,
        mileage: targetMileage,
        mileageFormatted: `${targetMileage.toLocaleString()} km (Est.)`,
        mileageDelta: kmRemaining,
        daysDelta: daysToTarget,
        monthlyPace: avgMonthlyPace,
        invoiceNumber: 'PROJECTED_DUE',
        jobDescription: `Projected ${targetMileage.toLocaleString()} km Service Target`,
        totalIncVat: 0,
        isProjected: true,
        serviceType: 'PROJECTED',
        targetThreshold: targetMileage,
      });
    }

    return points;
  }, [activeVehicle, safeInvoices, serviceIntervalKm, showProjection]);

  // Combined Comparison Dataset for All Garage Vehicles
  const fleetComparisonData = useMemo(() => {
    if (safeVehicles.length <= 1) return [];

    // Extract all unique dates across invoices
    const allDatesSet = new Set<string>();
    safeInvoices.forEach(inv => {
      if (inv.date && inv.vehicleMileage) allDatesSet.add(inv.date);
    });

    const sortedDates = Array.from(allDatesSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return sortedDates.map(dateStr => {
      const d = new Date(dateStr);
      const formattedDate = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;
      
      const row: any = {
        date: dateStr,
        formattedDate,
      };

      safeVehicles.forEach(veh => {
        const inv = safeInvoices.find(i => i.date === dateStr && i.vehicleReg === veh.regNumber);
        if (inv && inv.vehicleMileage) {
          row[veh.regNumber] = inv.vehicleMileage;
        }
      });

      return row;
    });
  }, [safeVehicles, safeInvoices]);

  // Telemetry Metrics & Maintenance Frequency Analysis
  const metrics = useMemo(() => {
    if (!activeVehicle) {
      return {
        totalServices: 0,
        recordedMileageSpan: 0,
        avgIntervalKm: 0,
        avgIntervalDays: 0,
        annualPaceKm: 0,
        frequencyAdherence: 'N/A',
        frequencyScore: 100,
        adherenceStatus: 'NORMAL',
        latestMileage: 0,
        nextTargetMileage: serviceIntervalKm,
        kmUntilTarget: serviceIntervalKm,
        totalMaintenanceSpend: 0,
        costPerKm: 0,
      };
    }

    const realPoints = chartData.filter(p => !p.isProjected);
    const serviceVisits = realPoints.filter(p => !p.isCurrentOdometer);
    const totalServices = serviceVisits.length;

    const latestMileage = activeVehicle.mileage || realPoints[realPoints.length - 1]?.mileage || 0;
    const earliestMileage = realPoints[0]?.mileage || latestMileage;
    const recordedMileageSpan = Math.max(0, latestMileage - earliestMileage);

    const intervals = realPoints.map(p => p.mileageDelta).filter(d => d > 0);
    const avgIntervalKm = intervals.length > 0 ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : serviceIntervalKm;

    const daysList = realPoints.map(p => p.daysDelta).filter(d => d > 0);
    const avgIntervalDays = daysList.length > 0 ? Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length) : 180;

    const monthlyPaceList = realPoints.map(p => p.monthlyPace).filter(p => p > 0);
    const avgMonthlyPace = monthlyPaceList.length > 0 ? Math.round(monthlyPaceList.reduce((a, b) => a + b, 0) / monthlyPaceList.length) : 1250;
    const annualPaceKm = avgMonthlyPace * 12;

    const totalMaintenanceSpend = serviceVisits.reduce((sum, p) => sum + p.totalIncVat, 0);
    const costPerKm = recordedMileageSpan > 0 ? totalMaintenanceSpend / recordedMileageSpan : 0;

    // Evaluate interval adherence to 15,000 km standard
    let adherenceStatus: 'OPTIMAL' | 'FREQUENT' | 'EXTENDED' | 'OVERDUE' = 'OPTIMAL';
    let frequencyAdherence = 'Optimal (±15,000 km)';
    let frequencyScore = 95;

    if (avgIntervalKm > serviceIntervalKm + 3000) {
      adherenceStatus = 'EXTENDED';
      frequencyAdherence = 'Extended Intervals (>18,000 km)';
      frequencyScore = 65;
    } else if (avgIntervalKm < serviceIntervalKm - 4000 && avgIntervalKm > 0) {
      adherenceStatus = 'FREQUENT';
      frequencyAdherence = 'High Frequency Fleet Usage (<11,000 km)';
      frequencyScore = 90;
    }

    const nextTargetMileage = Math.ceil((latestMileage + 1) / serviceIntervalKm) * serviceIntervalKm;
    const kmUntilTarget = nextTargetMileage - latestMileage;

    return {
      totalServices,
      recordedMileageSpan,
      avgIntervalKm,
      avgIntervalDays,
      annualPaceKm,
      frequencyAdherence,
      frequencyScore,
      adherenceStatus,
      latestMileage,
      nextTargetMileage,
      kmUntilTarget,
      totalMaintenanceSpend,
      costPerKm,
    };
  }, [activeVehicle, chartData, serviceIntervalKm]);

  // Color palette for comparison
  const vehicleColors = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Custom Interactive Tooltip
  const CustomTrajectoryTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data: ServiceDataPoint = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700 rounded-xl p-3.5 shadow-2xl text-xs max-w-xs space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-2">
          <span className="font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
            {data.vehicleReg}
          </span>
          <span className="text-slate-400 font-medium text-[11px]">{data.date}</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-slate-400 text-[11px]">Odometer Reading:</span>
            <span className="font-mono text-sm font-black text-white">{data.mileageFormatted}</span>
          </div>

          {data.mileageDelta > 0 && (
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-[11px]">Interval Traveled:</span>
              <span className="font-mono text-emerald-400 font-bold">+{data.mileageDelta.toLocaleString()} km</span>
            </div>
          )}

          {data.daysDelta > 0 && (
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-[11px]">Interval Elapsed:</span>
              <span className="text-slate-300 font-semibold">{data.daysDelta} days (~{Math.round(data.daysDelta / 30.42)} mos)</span>
            </div>
          )}

          {data.monthlyPace > 0 && (
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400 text-[11px]">Calculated Pace:</span>
              <span className="font-mono text-amber-300 font-medium">~{data.monthlyPace.toLocaleString()} km/mo</span>
            </div>
          )}
        </div>

        <div className="pt-1.5 border-t border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Record Type:</span>
            <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
              data.isProjected
                ? 'bg-purple-900/80 text-purple-200 border border-purple-700'
                : data.isCurrentOdometer
                ? 'bg-blue-900/80 text-blue-200 border border-blue-700'
                : data.serviceType === 'MAJOR'
                ? 'bg-amber-900/80 text-amber-200 border border-amber-700'
                : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
            }`}>
              {data.isProjected ? 'Target Milestone (Projected)' : data.isCurrentOdometer ? 'Live Odometer' : `${data.serviceType} Service`}
            </span>
          </div>

          <p className="text-[11px] text-slate-300 italic truncate font-medium">
            {data.jobDescription}
          </p>

          {data.totalIncVat > 0 && (
            <div className="flex justify-between items-baseline pt-0.5">
              <span className="text-slate-400 text-[11px]">Invoice Amount:</span>
              <span className="font-mono font-bold text-amber-400">{formatZAR(data.totalIncVat)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5 ${className}`}>
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              Vehicle Telemetry & Service Frequency
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Chronological Odometer & Maintenance Cadence
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900 mt-1 flex items-center space-x-2">
            <Gauge className="w-5 h-5 text-emerald-600" />
            <span>Mileage Progression & Maintenance Interval Chart</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive visualization of distance traveled between workshop visits, service frequency consistency, and projected maintenance milestones.
          </p>
        </div>

        {/* View Mode & Vehicle Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Garage Vehicle Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
            <Car className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="font-bold text-slate-600">Vehicle:</span>
            <select
              id="mileage-chart-vehicle-select"
              value={internalVehicleReg}
              onChange={e => handleSelectVehicle(e.target.value)}
              className="bg-transparent font-black text-slate-900 focus:outline-none cursor-pointer pr-2"
            >
              {safeVehicles.map((v, i) => (
                <option key={v.id || i} value={v.regNumber}>
                  {v.regNumber} • {v.make} {v.model} ({v.year})
                </option>
              ))}
            </select>
          </div>

          {/* Visualization Modes */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              id="btn-mode-trajectory"
              onClick={() => setViewMode('TRAJECTORY')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                viewMode === 'TRAJECTORY'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Odometer Curve</span>
            </button>

            <button
              type="button"
              id="btn-mode-intervals"
              onClick={() => setViewMode('INTERVALS')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                viewMode === 'INTERVALS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Service Intervals</span>
            </button>

            {safeVehicles.length > 1 && (
              <button
                type="button"
                id="btn-mode-comparison"
                onClick={() => setViewMode('COMPARISON')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                  viewMode === 'COMPARISON'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Garage Fleet ({safeVehicles.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* High-Level Telemetry KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Latest Odometer</span>
            <Gauge className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-base sm:text-lg font-black font-mono text-slate-900">
            {metrics.latestMileage > 0 ? `${metrics.latestMileage.toLocaleString()} km` : 'Odometer N/A'}
          </p>
          <span className="text-[10px] text-slate-500 block truncate">
            {activeVehicle?.make} {activeVehicle?.model} ({activeVehicle?.regNumber})
          </span>
        </div>

        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Service Interval</span>
            <Activity className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-base sm:text-lg font-black font-mono text-amber-700">
            {metrics.avgIntervalKm > 0 ? `${metrics.avgIntervalKm.toLocaleString()} km` : '15,000 km'}
          </p>
          <span className="text-[10px] text-slate-500 block">
            Every ~{metrics.avgIntervalDays} days (~{Math.round(metrics.avgIntervalDays / 30.42)} months)
          </span>
        </div>

        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Annual Driving Velocity</span>
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-base sm:text-lg font-black font-mono text-blue-700">
            ~{metrics.annualPaceKm.toLocaleString()} km/yr
          </p>
          <span className="text-[10px] text-slate-500 block">
            ~{Math.round(metrics.annualPaceKm / 12).toLocaleString()} km / month
          </span>
        </div>

        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Next Service</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="text-base sm:text-lg font-black font-mono text-purple-700">
            {metrics.nextTargetMileage.toLocaleString()} km
          </p>
          <span className={`text-[10px] font-bold block ${metrics.kmUntilTarget <= 0 ? 'text-rose-600' : 'text-slate-500'}`}>
            {metrics.kmUntilTarget <= 0
              ? `Overdue by ${Math.abs(metrics.kmUntilTarget).toLocaleString()} km!`
              : `${metrics.kmUntilTarget.toLocaleString()} km remaining`}
          </span>
        </div>
      </div>

      {/* Chart Toggles Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        <div className="flex items-center space-x-3 text-slate-600">
          <label className="flex items-center space-x-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMilestoneLines}
              onChange={e => setShowMilestoneLines(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
            />
            <span className="font-semibold text-[11px]">Show 15,000 km Milestone Guidelines</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showProjection}
              onChange={e => setShowProjection(e.target.checked)}
              className="rounded text-purple-600 focus:ring-purple-500 h-3.5 w-3.5 cursor-pointer"
            />
            <span className="font-semibold text-[11px]">Include Next Projected Milestone</span>
          </label>
        </div>

        <div className="flex items-center space-x-3 text-[11px] text-slate-500">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Recorded Service</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
            <span>Live Odometer</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block border border-dashed border-purple-700"></span>
            <span>Projected Target</span>
          </span>
        </div>
      </div>

      {/* Main Recharts Container */}
      <div className="w-full h-80 pt-2 pb-1 bg-slate-900 rounded-2xl p-4 shadow-inner border border-slate-800">
        {chartData.length > 0 ? (
          viewMode === 'TRAJECTORY' ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="mileageAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />

                <XAxis
                  dataKey="formattedDate"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                />

                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                  tickFormatter={val => `${Math.round(val / 1000)}k km`}
                  domain={['dataMin - 5000', 'dataMax + 8000']}
                />

                <Tooltip content={<CustomTrajectoryTooltip />} />

                {/* Milestone Reference Lines (e.g. standard intervals 30k, 60k, 90k, 120k) */}
                {showMilestoneLines && (
                  <>
                    <ReferenceLine y={30000} stroke="#475569" strokeDasharray="3 3" label={{ value: '30,000 km', fill: '#64748b', fontSize: 10, position: 'insideTopRight' }} />
                    <ReferenceLine y={60000} stroke="#475569" strokeDasharray="3 3" label={{ value: '60,000 km (Major)', fill: '#64748b', fontSize: 10, position: 'insideTopRight' }} />
                    <ReferenceLine y={90000} stroke="#475569" strokeDasharray="3 3" label={{ value: '90,000 km', fill: '#64748b', fontSize: 10, position: 'insideTopRight' }} />
                    <ReferenceLine y={120000} stroke="#475569" strokeDasharray="3 3" label={{ value: '120,000 km (Major)', fill: '#64748b', fontSize: 10, position: 'insideTopRight' }} />
                  </>
                )}

                {/* Area Gradient & Main Progression Line */}
                <Area
                  type="monotone"
                  dataKey="mileage"
                  name="Cumulative Odometer (km)"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#mileageAreaGrad)"
                />

                <Line
                  type="monotone"
                  dataKey="mileage"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload.isProjected) {
                      return (
                        <circle
                          key={payload.index}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill="#8b5cf6"
                          stroke="#ffffff"
                          strokeWidth={2}
                          strokeDasharray="2 2"
                        />
                      );
                    }
                    if (payload.isCurrentOdometer) {
                      return (
                        <circle
                          key={payload.index}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill="#3b82f6"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      );
                    }
                    if (payload.serviceType === 'MAJOR') {
                      return (
                        <circle
                          key={payload.index}
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      );
                    }
                    return (
                      <circle
                        key={payload.index}
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  activeDot={{ r: 7, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : viewMode === 'INTERVALS' ? (
            /* Maintenance Interval Delta & Duration Composed View */
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData.filter(p => p.mileageDelta > 0)} margin={{ top: 15, right: 25, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />

                <XAxis
                  dataKey="formattedDate"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                />

                <YAxis
                  yAxisId="left"
                  stroke="#f59e0b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                  tickFormatter={val => `${(val / 1000).toFixed(0)}k km`}
                  label={{ value: 'Distance Traveled (km)', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 10 }}
                />

                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#38bdf8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                  tickFormatter={val => `${val}d`}
                  label={{ value: 'Days Elapsed', angle: 90, position: 'insideRight', fill: '#38bdf8', fontSize: 10 }}
                />

                <Tooltip content={<CustomTrajectoryTooltip />} />

                <ReferenceLine
                  yAxisId="left"
                  y={serviceIntervalKm}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: `Recommended Target (${serviceIntervalKm.toLocaleString()} km)`, fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }}
                />

                <Bar
                  yAxisId="left"
                  dataKey="mileageDelta"
                  name="Interval Distance (km)"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  barSize={28}
                />

                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="daysDelta"
                  name="Days Between Services"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#38bdf8' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            /* Multi-Vehicle Comparison View */
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fleetComparisonData} margin={{ top: 15, right: 25, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />

                <XAxis
                  dataKey="formattedDate"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                />

                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                  tickFormatter={val => `${Math.round(val / 1000)}k km`}
                />

                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '11px' }}
                  formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} km`, name]}
                />

                <Legend wrapperStyle={{ paddingTop: 10, fontSize: '11px' }} />

                {safeVehicles.map((veh, idx) => (
                  <Line
                    key={veh.regNumber}
                    type="monotone"
                    dataKey={veh.regNumber}
                    name={`${veh.regNumber} (${veh.make})`}
                    stroke={vehicleColors[idx % vehicleColors.length]}
                    strokeWidth={2.5}
                    connectNulls
                    dot={{ r: 4 }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
            <Gauge className="w-10 h-10 text-slate-600" />
            <p className="text-xs font-semibold text-slate-300">No service odometer records recorded for this vehicle yet.</p>
            <p className="text-[11px] text-slate-500 max-w-sm">
              As you issue tax invoices with logged vehicle mileage, this chart will plot the full chronological mileage growth and maintenance frequency telemetry automatically.
            </p>
          </div>
        )}
      </div>

      {/* Maintenance Cadence Quality & Advisory Strip */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            metrics.adherenceStatus === 'OPTIMAL'
              ? 'bg-emerald-100 text-emerald-800'
              : metrics.adherenceStatus === 'FREQUENT'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900">Maintenance Cadence Rating:</span>
              <span className={`font-black text-[11px] px-2 py-0.2 rounded-full ${
                metrics.adherenceStatus === 'OPTIMAL'
                  ? 'bg-emerald-100 text-emerald-800'
                  : metrics.adherenceStatus === 'FREQUENT'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {metrics.frequencyAdherence}
              </span>
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Historical service data indicates visits every <strong className="text-slate-800 font-mono">{metrics.avgIntervalKm.toLocaleString()} km</strong> (target: {serviceIntervalKm.toLocaleString()} km). Maintenance health score: <strong className="text-emerald-700 font-mono">{metrics.frequencyScore}%</strong>.
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Maintenance Spend</span>
          <span className="text-sm font-black font-mono text-slate-900">
            {formatZAR(metrics.totalMaintenanceSpend)}
          </span>
          {metrics.costPerKm > 0 && (
            <span className="text-[10px] text-slate-500 block font-mono">
              ~{formatZAR(metrics.costPerKm)} / km operated
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
