import React, { useState, useMemo } from 'react';
import {
  Users,
  Car,
  Search,
  Plus,
  Phone,
  PhoneCall,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  Download,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Printer,
  Wrench,
  History,
  ArrowUpDown,
  Filter,
  Gauge,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  Layers,
  Sparkles,
  Bell,
  BellRing,
  Send,
  MessageSquare,
  Copy,
  Check,
  Edit3,
  Sliders,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { Customer, Invoice, Quotation, Vehicle, WorkshopSettings, LineItem } from '../types';
import { formatZAR } from '../utils/sarsTaxEngine';
import { generateInvoicePDF, generateQuotationPDF, generateCustomerServiceHistoryPDF } from '../utils/pdfGenerator';
import { VehicleMileageChart } from './VehicleMileageChart';

interface ClientPortalModuleProps {
  customers: Customer[];
  invoices: Invoice[];
  quotes: Quotation[];
  settings: WorkshopSettings;
  onSaveCustomer: (customer: Customer) => void;
}

export const ClientPortalModule: React.FC<ClientPortalModuleProps> = ({
  customers = [],
  invoices = [],
  quotes = [],
  settings,
  onSaveCustomer,
}) => {
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(safeCustomers[0]?.id || '');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Summary, History, & Reminder Controls
  const [activeTab, setActiveTab] = useState<'summary' | 'reminders' | 'invoices' | 'service_history' | 'mileage_chart' | 'vehicles' | 'payments'>('summary');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  // Vehicle Service Reminder Controls & Threshold Settings
  const [reminderThreshold, setReminderThreshold] = useState<number>(1000); // Trigger reminder when within 1,000 km
  const [serviceIntervalKm, setServiceIntervalKm] = useState<number>(15000); // Standard 15,000 km service intervals
  const [reminderFilterSeverity, setReminderFilterSeverity] = useState<'ALL' | 'ACTION_REQUIRED' | 'OVERDUE' | 'DUE_SOON'>('ALL');
  const [reminderModalVehicle, setReminderModalVehicle] = useState<any | null>(null);
  const [editingOdometerVehicle, setEditingOdometerVehicle] = useState<{ regNumber: string; mileage: number; makeModel: string } | null>(null);
  const [newOdometerValue, setNewOdometerValue] = useState<number>(0);
  const [copiedReminderFeedback, setCopiedReminderFeedback] = useState<boolean>(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formVatNumber, setFormVatNumber] = useState('');

  // Vehicle form inside customer
  const [formVehicles, setFormVehicles] = useState<Vehicle[]>([
    {
      id: `VEH-${Date.now()}`,
      regNumber: 'CA 782-910',
      make: 'Toyota',
      model: 'Hilux 2.8 GD-6 4x4',
      year: 2021,
      mileage: 82500,
      vin: 'AHTBA3CD20199482',
    },
  ]);

  const selectedCustomer = safeCustomers.find(c => c.id === selectedCustomerId) || safeCustomers[0];

  // Invoices & Quotes for selected customer
  const rawCustomerInvoices = useMemo(() => {
    return safeInvoices.filter(
      inv => inv && (
        (selectedCustomer?.id && inv.customerId === selectedCustomer.id) ||
        (selectedCustomer?.name && inv.customerName && inv.customerName.toLowerCase() === selectedCustomer.name.toLowerCase())
      )
    );
  }, [safeInvoices, selectedCustomer]);

  const customerQuotes = useMemo(() => {
    return safeQuotes.filter(
      qt => qt && (
        (selectedCustomer?.id && qt.customerId === selectedCustomer.id) ||
        (selectedCustomer?.name && qt.customerName && qt.customerName.toLowerCase() === selectedCustomer.name.toLowerCase())
      )
    );
  }, [safeQuotes, selectedCustomer]);

  // Chronologically Filtered & Sorted Invoices
  const customerInvoices = useMemo(() => {
    return rawCustomerInvoices
      .filter(inv => {
        const matchesVehicle = selectedVehicleFilter === 'ALL' || inv.vehicleReg === selectedVehicleFilter;
        const q = historySearchQuery.toLowerCase().trim();
        const matchesSearch = !q ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.vehicleReg.toLowerCase().includes(q) ||
          inv.vehicleMakeModel.toLowerCase().includes(q) ||
          inv.jobDescription.toLowerCase().includes(q) ||
          inv.date.includes(q) ||
          (inv.items || []).some(item => item.description.toLowerCase().includes(q) || (item.sku && item.sku.toLowerCase().includes(q)));
        return matchesVehicle && matchesSearch;
      })
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [rawCustomerInvoices, selectedVehicleFilter, historySearchQuery, sortOrder]);

  // Vehicle Service History Records (Deriving chronological service history events from invoices)
  const serviceHistoryEvents = useMemo(() => {
    // Sort all customer invoices chronologically ascending to calculate odometer progression accurately
    const sortedAsc = [...rawCustomerInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Map prior service mileage per vehicle
    const vehiclePriorMileageMap = new Map<string, number>();

    const events = sortedAsc.map((inv) => {
      const priorMileage = vehiclePriorMileageMap.get(inv.vehicleReg) || 0;
      const currentMileage = inv.vehicleMileage || 0;
      const mileageDelta = priorMileage > 0 && currentMileage > priorMileage ? currentMileage - priorMileage : 0;
      if (currentMileage > 0) {
        vehiclePriorMileageMap.set(inv.vehicleReg, currentMileage);
      }

      const partsCount = (inv.items || []).filter(i => i.type === 'PART').length;
      const laborCount = (inv.items || []).filter(i => i.type === 'LABOR' || i.type === 'DIAGNOSTIC').length;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        dueDate: inv.dueDate,
        vehicleReg: inv.vehicleReg,
        vehicleMakeModel: inv.vehicleMakeModel,
        vehicleMileage: currentMileage,
        mileageDelta,
        jobDescription: inv.jobDescription,
        items: inv.items || [],
        partsCount,
        laborCount,
        subtotalExVat: inv.subtotalExVat,
        vatAmount: inv.vatAmount,
        totalIncVat: inv.totalIncVat,
        amountPaid: inv.amountPaid,
        balanceDue: inv.balanceDue,
        status: inv.status,
        notes: inv.notes,
        rawInvoice: inv,
      };
    });

    // Apply vehicle filter and search query
    const filtered = events.filter(evt => {
      const matchesVehicle = selectedVehicleFilter === 'ALL' || evt.vehicleReg === selectedVehicleFilter;
      const q = historySearchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        evt.invoiceNumber.toLowerCase().includes(q) ||
        evt.vehicleReg.toLowerCase().includes(q) ||
        evt.vehicleMakeModel.toLowerCase().includes(q) ||
        evt.jobDescription.toLowerCase().includes(q) ||
        evt.date.includes(q) ||
        evt.items.some(item => item.description.toLowerCase().includes(q) || (item.sku && item.sku.toLowerCase().includes(q)));
      return matchesVehicle && matchesSearch;
    });

    // Apply sort order
    return filtered.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [rawCustomerInvoices, selectedVehicleFilter, historySearchQuery, sortOrder]);

  // Overall Financial & Garage Metrics for selected client
  const totalBilled = rawCustomerInvoices.reduce((sum, inv) => sum + (inv?.totalIncVat || 0), 0);
  const totalPaid = rawCustomerInvoices.reduce((sum, inv) => sum + (inv?.amountPaid || 0), 0);
  const totalOutstanding = rawCustomerInvoices.reduce((sum, inv) => sum + (inv?.balanceDue || 0), 0);

  // All payments received from this customer
  const allPayments = useMemo(() => {
    return rawCustomerInvoices.flatMap(inv =>
      (inv.payments || []).map(p => ({
        ...p,
        invoiceNumber: inv.invoiceNumber,
        vehicleReg: inv.vehicleReg,
      }))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawCustomerInvoices]);

  // Helper to recommend service package & checklist based on mileage target
  const getRecommendedServicePackage = (targetMileage: number) => {
    if (targetMileage > 0 && targetMileage % 60000 === 0) {
      return {
        type: 'MAJOR_SERVICE',
        title: `Major ${targetMileage.toLocaleString()} km Comprehensive Service`,
        intervalLabel: '60,000 km Major Milestone',
        checklist: [
          'Full Synthetic Engine Oil & OEM Oil Filter Replacement',
          'Engine Air & Cabin / Pollen Micro-Filters',
          'Spark Plugs / Glow Plugs Replacement',
          'DOT 4 Brake Fluid & Engine Coolant Full System Flush',
          'Serpentine & Auxiliary Drive Belts Tension Check',
          'Differential & Transmission Oil Level / Condition Check',
          'Brake Disc / Pad Thickness & Suspension Bushing Test',
          '65-Point Roadworthy Safety Diagnostic Scan & Reset',
        ],
      };
    } else if (targetMileage > 0 && targetMileage % 30000 === 0) {
      return {
        type: 'INTERMEDIATE_SERVICE',
        title: `Intermediate ${targetMileage.toLocaleString()} km Service`,
        intervalLabel: '30,000 km Intermediate Service',
        checklist: [
          'Full Synthetic Engine Oil & OEM Oil Filter',
          'Engine Air Filter Replacement',
          'Brake Fluid Moisture Level & Hydraulic Pressure Test',
          'Brake Caliper, Pad & Rotor Wear Measurement',
          'Steering Rack, Tie Rods & Ball Joints Inspection',
          'Battery Health, Alternator Output & Voltage Drop Test',
          'Full OBD-II Diagnostic Scan & Reset Inspection Indicator',
        ],
      };
    } else {
      return {
        type: 'MINOR_SERVICE',
        title: `Standard ${targetMileage.toLocaleString()} km Minor Service`,
        intervalLabel: `${serviceIntervalKm.toLocaleString()} km Minor Maintenance`,
        checklist: [
          'Full Synthetic Engine Oil & OEM Filter Replacement',
          'Sump Plug Washer & Seal Replacement',
          'Engine Air Filter Inspection & Blow Out',
          'Underbody Fluid Leak Check & Chassis Bolt Torque',
          'Tyre Pressure & Tread Depth Uniformity Check',
          'Battery Terminals, Wiper Fluid & Lighting Check',
          'Service Interval Light Reset & Road Test',
        ],
      };
    }
  };

  // Comprehensive Vehicle Stats & Historical Service Reminder Analytics
  const customerVehicles = selectedCustomer?.vehicles || [];
  const vehicleStats = useMemo(() => {
    return customerVehicles.map(veh => {
      const vehInvoices = rawCustomerInvoices.filter(i => i.vehicleReg === veh.regNumber);
      const sortedVehInvoices = [...vehInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const lastService = sortedVehInvoices[sortedVehInvoices.length - 1];
      const firstService = sortedVehInvoices[0];
      const totalSpend = vehInvoices.reduce((sum, i) => sum + (i.totalIncVat || 0), 0);
      
      const lastServiceMileage = lastService?.vehicleMileage || 0;
      const lastServiceDate = lastService?.date || null;
      const lastServiceInvoice = lastService?.invoiceNumber || null;
      
      // Current odometer reading (either explicitly updated or from latest service)
      const currentMileage = veh.mileage || lastServiceMileage || 0;
      
      // Compute historical driving pace (km per month)
      let monthlyKmPace = 1250; // default South African avg (~15,000 km/year)
      if (sortedVehInvoices.length >= 2 && lastServiceDate && firstService?.date && lastServiceDate !== firstService.date) {
        const daysElapsed = Math.max(1, (new Date(lastServiceDate).getTime() - new Date(firstService.date).getTime()) / (1000 * 60 * 60 * 24));
        const kmDelta = Math.max(0, (lastService.vehicleMileage || 0) - (firstService.vehicleMileage || 0));
        if (kmDelta > 0 && daysElapsed > 0) {
          monthlyKmPace = Math.max(300, Math.round((kmDelta / daysElapsed) * 30.42));
        }
      }
      
      // Calculate target next service mileage
      let nextServiceMileageTarget: number;
      if (lastServiceMileage > 0) {
        nextServiceMileageTarget = lastServiceMileage + serviceIntervalKm;
      } else if (currentMileage > 0) {
        nextServiceMileageTarget = Math.ceil((currentMileage + 1) / serviceIntervalKm) * serviceIntervalKm;
      } else {
        nextServiceMileageTarget = serviceIntervalKm;
      }
      
      // Distance remaining to next target
      const kmRemaining = nextServiceMileageTarget - currentMileage;
      
      // Time calculations
      const daysSinceLastService = lastServiceDate 
        ? Math.max(0, Math.floor((Date.now() - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24)))
        : null;
        
      const isAnnualOverdue = daysSinceLastService !== null && daysSinceLastService >= 365;
      
      // Estimated days until service threshold based on monthly driving pace
      const estimatedDaysRemaining = kmRemaining > 0 
        ? Math.max(1, Math.round((kmRemaining / (monthlyKmPace / 30.42))))
        : 0;
        
      const estimatedDueDate = new Date(Date.now() + estimatedDaysRemaining * 86400000).toISOString().split('T')[0];
      
      // Evaluate threshold reminder status
      let severity: 'critical' | 'warning' | 'info' | 'good';
      let statusText: 'OVERDUE' | 'DUE_SOON' | 'APPROACHING' | 'UP_TO_DATE';
      let statusBadge: string;
      let statusDescription: string;
      
      if (kmRemaining <= 0 || isAnnualOverdue) {
        severity = 'critical';
        statusText = 'OVERDUE';
        if (kmRemaining <= 0) {
          statusBadge = `Overdue by ${Math.abs(kmRemaining).toLocaleString()} km`;
          statusDescription = `Vehicle has exceeded the ${nextServiceMileageTarget.toLocaleString()} km threshold!`;
        } else {
          statusBadge = `Annual Service Overdue (${daysSinceLastService} days)`;
          statusDescription = `Over 12 months since last recorded workshop visit (${lastServiceDate}).`;
        }
      } else if (kmRemaining <= reminderThreshold || estimatedDaysRemaining <= 30) {
        severity = 'warning';
        statusText = 'DUE_SOON';
        statusBadge = `Due Soon (${kmRemaining.toLocaleString()} km left)`;
        statusDescription = `Approaching target threshold within ${reminderThreshold.toLocaleString()} km!`;
      } else if (kmRemaining <= reminderThreshold * 2.5 || estimatedDaysRemaining <= 60) {
        severity = 'info';
        statusText = 'APPROACHING';
        statusBadge = `Approaching (${kmRemaining.toLocaleString()} km left)`;
        statusDescription = `Estimated due in ~${Math.round(estimatedDaysRemaining / 7)} weeks (${estimatedDueDate}).`;
      } else {
        severity = 'good';
        statusText = 'UP_TO_DATE';
        statusBadge = `Up to date (${kmRemaining.toLocaleString()} km left)`;
        statusDescription = `Next service estimated in ~${estimatedDaysRemaining} days.`;
      }
      
      // Interval progress percentage (0 to 100%)
      const baseMileage = lastServiceMileage > 0 ? lastServiceMileage : Math.max(0, nextServiceMileageTarget - serviceIntervalKm);
      const progressPercent = Math.min(100, Math.max(0, Math.round(((currentMileage - baseMileage) / serviceIntervalKm) * 100)));
      
      const servicePackage = getRecommendedServicePackage(nextServiceMileageTarget);
      
      return {
        ...veh,
        latestMileage: currentMileage,
        currentMileage,
        totalServices: vehInvoices.length,
        totalSpend,
        lastServiceDate: lastServiceDate || 'No services yet',
        lastServiceMileage,
        lastServiceInvoice,
        nextServiceMileageTarget,
        targetMileage: nextServiceMileageTarget,
        kmRemaining,
        daysSinceLastService,
        monthlyKmPace,
        estimatedDaysRemaining,
        estimatedDueDate,
        severity,
        statusText,
        statusBadge,
        statusDescription,
        progressPercent,
        servicePackage,
      };
    });
  }, [customerVehicles, rawCustomerInvoices, reminderThreshold, serviceIntervalKm]);

  // Overall reminder summary counters for the selected customer
  const reminderSummary = useMemo(() => {
    const overdueCount = vehicleStats.filter(v => v.severity === 'critical').length;
    const dueSoonCount = vehicleStats.filter(v => v.severity === 'warning').length;
    const approachingCount = vehicleStats.filter(v => v.severity === 'info').length;
    const goodCount = vehicleStats.filter(v => v.severity === 'good').length;
    const actionRequiredCount = overdueCount + dueSoonCount;
    return {
      overdueCount,
      dueSoonCount,
      approachingCount,
      goodCount,
      actionRequiredCount,
      totalVehicles: vehicleStats.length,
    };
  }, [vehicleStats]);

  // Check if any customer in the directory has an overdue or due-soon vehicle
  const checkCustomerHasReminderAlert = (cust: Customer) => {
    const custVehicles = cust.vehicles || [];
    let hasCritical = false;
    let hasWarning = false;
    for (const v of custVehicles) {
      const vInvoices = safeInvoices.filter(i => i.vehicleReg === v.regNumber);
      const sorted = [...vInvoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const last = sorted[sorted.length - 1];
      const lastMileage = last?.vehicleMileage || 0;
      const currentMil = v.mileage || lastMileage || 0;
      const target = lastMileage > 0 ? lastMileage + serviceIntervalKm : (Math.ceil((currentMil + 1) / serviceIntervalKm) * serviceIntervalKm || serviceIntervalKm);
      const rem = target - currentMil;
      const daysSince = last?.date ? Math.floor((Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24)) : null;
      if (rem <= 0 || (daysSince !== null && daysSince >= 365)) {
        hasCritical = true;
      } else if (rem <= reminderThreshold) {
        hasWarning = true;
      }
    }
    return { hasCritical, hasWarning, hasActionRequired: hasCritical || hasWarning };
  };

  // Quick Odometer Handlers
  const handleOpenQuickOdometer = (veh: any) => {
    setEditingOdometerVehicle({
      regNumber: veh.regNumber,
      mileage: veh.currentMileage,
      makeModel: `${veh.make} ${veh.model}`,
    });
    setNewOdometerValue(veh.currentMileage);
  };

  const handleSaveQuickOdometer = () => {
    if (!editingOdometerVehicle || !selectedCustomer) return;
    const updatedVehicles = (selectedCustomer.vehicles || []).map(v => {
      if (v.regNumber === editingOdometerVehicle.regNumber) {
        return {
          ...v,
          mileage: Math.max(0, Number(newOdometerValue) || 0),
        };
      }
      return v;
    });

    const updatedCustomer: Customer = {
      ...selectedCustomer,
      vehicles: updatedVehicles,
    };

    onSaveCustomer(updatedCustomer);
    setEditingOdometerVehicle(null);
  };

  // WhatsApp / SMS / Email Reminder Formatter
  const generateReminderMessageText = (v: any) => {
    if (!v || !selectedCustomer) return '';
    const workshopName = settings.workshopName || "JC's AutoCraft Workshop";
    const statusLine = v.kmRemaining <= 0 
      ? `⚠️ ATTENTION: Your vehicle is OVERDUE for scheduled maintenance by ${Math.abs(v.kmRemaining).toLocaleString()} km.`
      : `⏳ NOTICE: Your vehicle is approaching its scheduled service threshold (only ${v.kmRemaining.toLocaleString()} km remaining).`;

    return `*${workshopName} - Service Reminder* 🚗\n\nDear ${selectedCustomer.name},\n\n${statusLine}\n\n📋 *Vehicle:* ${v.year} ${v.make} ${v.model}\n🔢 *Registration:* ${v.regNumber}\n📊 *Current Odometer:* ${v.currentMileage.toLocaleString()} km\n🎯 *Next Service Target:* ${v.targetMileage.toLocaleString()} km\n📅 *Estimated Target Date:* ${v.estimatedDueDate}\n\n🔧 *Recommended Service Scope:* ${v.servicePackage.title}\n\nIncluded Maintenance Scope:\n${v.servicePackage.checklist.map((item: string) => `• ${item}`).join('\n')}\n\nRegular scheduled maintenance preserves your engine life, maintains warranty standing, and ensures optimum fuel economy.\n\nTo reserve your preferred workshop booking slot:\n📞 Tel: ${settings.workshopPhone}\n📧 Email: ${settings.workshopEmail}\n📍 ${settings.workshopAddress}\n\nThank you for choosing ${workshopName}!`;
  };

  const handleCopyReminderText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedReminderFeedback(true);
    setTimeout(() => setCopiedReminderFeedback(false), 2500);
  };

  // Download Service History PDF
  const handleDownloadCustomerHistoryPDF = () => {
    if (!selectedCustomer) return;
    const doc = generateCustomerServiceHistoryPDF(
      selectedCustomer,
      safeInvoices,
      settings,
      selectedVehicleFilter
    );
    doc.save(`${selectedCustomer.name.replace(/\s+/g, '_')}_Vehicle_Service_History.pdf`);
  };

  // Handlers
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('+27 (0)');
    setFormEmail('');
    setFormAddress('Cape Town, South Africa');
    setFormVatNumber('');
    setFormVehicles([
      {
        id: `VEH-${Date.now()}`,
        regNumber: '',
        make: '',
        model: '',
        year: 2020,
        mileage: 50000,
        vin: '',
      },
    ]);
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormName(cust.name);
    setFormPhone(cust.phone);
    setFormEmail(cust.email);
    setFormAddress(cust.address);
    setFormVatNumber(cust.vatNumber || '');
    setFormVehicles(cust.vehicles || []);
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    const customerToSave: Customer = {
      id: editingCustomer ? editingCustomer.id : `CUST-${Date.now().toString().slice(-4)}`,
      name: formName,
      phone: formPhone,
      email: formEmail,
      address: formAddress,
      vatNumber: formVatNumber,
      vehicles: formVehicles.filter(v => v.regNumber && v.make),
      totalSpend: editingCustomer ? editingCustomer.totalSpend : 0,
      outstandingBalance: editingCustomer ? editingCustomer.outstandingBalance : 0,
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
    };

    onSaveCustomer(customerToSave);
    setSelectedCustomerId(customerToSave.id);
    setIsCustomerModalOpen(false);
  };

  const handleAddVehicleRow = () => {
    setFormVehicles([
      ...formVehicles,
      {
        id: `VEH-${Date.now()}`,
        regNumber: '',
        make: '',
        model: '',
        year: 2021,
        mileage: 45000,
        vin: '',
      },
    ]);
  };

  const handleUpdateVehicleRow = (index: number, field: keyof Vehicle, value: any) => {
    const updated = [...formVehicles];
    updated[index] = { ...updated[index], [field]: value };
    setFormVehicles(updated);
  };

  const handleRemoveVehicleRow = (index: number) => {
    setFormVehicles(formVehicles.filter((_, i) => i !== index));
  };

  const handleDownloadInvoicePDF = (inv: Invoice) => {
    const doc = generateInvoicePDF(inv, settings);
    doc.save(`${inv.invoiceNumber}_${inv.vehicleReg.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDownloadQuotePDF = (qt: Quotation) => {
    const doc = generateQuotationPDF(qt, settings);
    doc.save(`${qt.quoteNumber}_${qt.vehicleReg.replace(/\s+/g, '_')}.pdf`);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.vehicles.some(v => v.regNumber.toLowerCase().includes(searchQuery.toLowerCase()) || v.make.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Client Portal & Payment History</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Customer Self-Service View
            </span>
          </h1>
          <p className="text-slate-500 text-sm">
            Customer vehicle garage profiles, payment receipts, statement balances, and direct PDF downloads
          </p>
        </div>

        <button
          onClick={handleOpenAddCustomer}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Client</span>
        </button>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Customer Directory */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Workshop Clients</h3>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, phone, reg #..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {filteredCustomers.map(cust => {
                const isSelected = cust.id === selectedCustomerId;
                const reminderStatus = checkCustomerHasReminderAlert(cust);
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-2 border-emerald-600 text-slate-950 shadow-xs'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <p className="font-bold text-xs">{cust.name}</p>
                        {reminderStatus.hasCritical && (
                          <span title="Vehicle Service Overdue!" className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 animate-pulse border border-rose-300">
                            <BellRing className="w-2.5 h-2.5 mr-0.5" /> Due
                          </span>
                        )}
                        {!reminderStatus.hasCritical && reminderStatus.hasWarning && (
                          <span title="Service Due Soon (< Threshold)" className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            <Bell className="w-2.5 h-2.5 mr-0.5" /> Due Soon
                          </span>
                        )}
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-300'}`} />
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-1">
                      <Phone className="w-3 h-3" />
                      <span>{cust.phone}</span>
                    </div>

                    {cust.vehicles && cust.vehicles.length > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono mt-1.5 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                        <div className="flex items-center space-x-1">
                          <Car className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[150px]">{cust.vehicles[0].regNumber} • {cust.vehicles[0].make}</span>
                        </div>
                        {cust.vehicles.length > 1 && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded font-bold">
                            +{cust.vehicles.length - 1}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Client Portal Simulation View */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCustomer ? (
            <>
              {/* Client Profile Header Banner */}
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        Client Master Profile
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ID: {selectedCustomer.id}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white mt-1">{selectedCustomer.name}</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-300 mt-2">
                      <span className="flex items-center space-x-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-mono">{selectedCustomer.phone}</span>
                      </span>
                      <span className="flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5 text-amber-400" />
                        <span>{selectedCustomer.email || 'No email registered'}</span>
                      </span>
                      {selectedCustomer.address && (
                        <span className="flex items-center space-x-1.5 text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[240px]">{selectedCustomer.address}</span>
                        </span>
                      )}
                      {selectedCustomer.vatNumber && (
                        <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-amber-300 border border-slate-700 text-[11px]">
                          VAT Reg: {selectedCustomer.vatNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                    <button
                      id="export-service-history-pdf-btn"
                      onClick={handleDownloadCustomerHistoryPDF}
                      title="Download Full Chronological Vehicle Service History Logbook (PDF)"
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Service PDF</span>
                    </button>
                    <button
                      onClick={() => handleOpenEditCustomer(selectedCustomer)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs border border-slate-700 transition-colors flex items-center justify-center space-x-1"
                    >
                      <span>Edit Profile</span>
                    </button>
                  </div>
                </div>

                {/* Lifetime Financial & Garage KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Total Invoiced</span>
                    <p className="text-sm sm:text-base font-black font-mono text-white mt-0.5">{formatZAR(totalBilled)}</p>
                    <span className="text-[10px] text-slate-500">{rawCustomerInvoices.length} invoices issued</span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Total Settled</span>
                    <p className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-0.5">{formatZAR(totalPaid)}</p>
                    <span className="text-[10px] text-emerald-500/80">{allPayments.length} payment receipts</span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Balance Due</span>
                    <p className={`text-sm sm:text-base font-black font-mono mt-0.5 ${totalOutstanding > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {formatZAR(totalOutstanding)}
                    </p>
                    <span className={`text-[10px] ${totalOutstanding > 0 ? 'text-rose-400/80 font-bold' : 'text-slate-500'}`}>
                      {totalOutstanding > 0 ? 'Payment pending' : 'Account in good standing'}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold block">Garage Fleet</span>
                    <p className="text-sm sm:text-base font-black font-mono text-amber-300 mt-0.5">{customerVehicles.length} Vehicles</p>
                    <span className="text-[10px] text-slate-500">{serviceHistoryEvents.length} workshop visits</span>
                  </div>
                </div>
              </div>

              {/* Service Reminder Alert Ribbon (if any vehicle overdue or approaching threshold) */}
              {reminderSummary.actionRequiredCount > 0 && (
                <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border border-amber-300/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shrink-0 mt-0.5 shadow-xs">
                      <BellRing className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="font-black text-xs sm:text-sm text-slate-900">
                          Vehicle Service Maintenance Notice
                        </h4>
                        {reminderSummary.overdueCount > 0 && (
                          <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full">
                            {reminderSummary.overdueCount} Overdue
                          </span>
                        )}
                        {reminderSummary.dueSoonCount > 0 && (
                          <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                            {reminderSummary.dueSoonCount} Approaching Threshold
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {reminderSummary.overdueCount > 0 
                          ? `${reminderSummary.overdueCount} vehicle(s) have passed their maintenance interval target based on historical service mileage.`
                          : `${reminderSummary.dueSoonCount} vehicle(s) are within ${reminderThreshold.toLocaleString()} km of their scheduled service threshold.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
                    <button
                      id="banner-manage-reminders-btn"
                      onClick={() => setActiveTab('reminders')}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>Review Service Alerts ({reminderSummary.actionRequiredCount})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* View Modes & Navigation Tabs */}
              <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap gap-1">
                <button
                  id="tab-customer-summary"
                  onClick={() => setActiveTab('summary')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'summary'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Master Overview & Timeline</span>
                </button>

                <button
                  id="tab-customer-reminders"
                  onClick={() => setActiveTab('reminders')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'reminders'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <span>Service Reminders</span>
                  {reminderSummary.actionRequiredCount > 0 ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black bg-rose-500 text-white animate-pulse">
                      {reminderSummary.actionRequiredCount}
                    </span>
                  ) : (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${activeTab === 'reminders' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-700'}`}>
                      {vehicleStats.length}
                    </span>
                  )}
                </button>

                <button
                  id="tab-customer-invoices"
                  onClick={() => setActiveTab('invoices')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'invoices'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Past Invoices Ledger</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${activeTab === 'invoices' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-700'}`}>
                    {rawCustomerInvoices.length}
                  </span>
                </button>

                <button
                  id="tab-customer-service-history"
                  onClick={() => setActiveTab('service_history')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'service_history'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-500" />
                  <span>Vehicle Service History</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${activeTab === 'service_history' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-700'}`}>
                    {rawCustomerInvoices.length}
                  </span>
                </button>

                <button
                  id="tab-customer-mileage-chart"
                  onClick={() => setActiveTab('mileage_chart')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'mileage_chart'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mileage & Cadence Chart</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${activeTab === 'mileage_chart' ? 'bg-slate-800 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}>
                    Recharts
                  </span>
                </button>

                <button
                  id="tab-customer-vehicles"
                  onClick={() => setActiveTab('vehicles')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'vehicles'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Car className="w-3.5 h-3.5 text-blue-500" />
                  <span>Garage Vehicles</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${activeTab === 'vehicles' ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-slate-700'}`}>
                    {customerVehicles.length}
                  </span>
                </button>

                <button
                  id="tab-customer-payments"
                  onClick={() => setActiveTab('payments')}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'payments'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                  <span>Payment Receipts</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${activeTab === 'payments' ? 'bg-slate-800 text-purple-300' : 'bg-slate-100 text-slate-700'}`}>
                    {allPayments.length}
                  </span>
                </button>
              </div>

              {/* Chronological Filters & Search Controls Toolbar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Vehicle Filter Selector */}
                    <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                      <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-600">Vehicle:</span>
                      <select
                        value={selectedVehicleFilter}
                        onChange={e => setSelectedVehicleFilter(e.target.value)}
                        className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">All Garage Vehicles ({customerVehicles.length})</option>
                        {customerVehicles.map((v, i) => (
                          <option key={v.id || i} value={v.regNumber}>
                            {v.regNumber} • {v.make} {v.model}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Chronological Sorting Toggle */}
                    <button
                      type="button"
                      id="toggle-chronological-sort-btn"
                      onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-xs transition-colors"
                      title="Sort Chronologically"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
                      <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                    </button>
                  </div>

                  {/* Search within customer history */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Search past jobs, invoice #, parts..."
                      value={historySearchQuery}
                      onChange={e => setHistorySearchQuery(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                    {historySearchQuery && (
                      <button
                        onClick={() => setHistorySearchQuery('')}
                        className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>

                {/* Active filter summary pill */}
                {(selectedVehicleFilter !== 'ALL' || historySearchQuery) && (
                  <div className="flex items-center space-x-2 text-[11px] text-slate-600 bg-amber-50/70 border border-amber-200/80 px-2.5 py-1 rounded-lg">
                    <span className="font-semibold text-amber-900">Filtered view:</span>
                    {selectedVehicleFilter !== 'ALL' && (
                      <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200 text-slate-900 font-bold">
                        {selectedVehicleFilter}
                      </span>
                    )}
                    {historySearchQuery && (
                      <span>Search: &ldquo;{historySearchQuery}&rdquo;</span>
                    )}
                    <button
                      onClick={() => {
                        setSelectedVehicleFilter('ALL');
                        setHistorySearchQuery('');
                      }}
                      className="text-amber-800 hover:underline font-bold ml-auto"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>

              {/* TAB 1: MASTER OVERVIEW & CHRONOLOGICAL TIMELINE */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  {/* Vehicle Garage Status & Service Projections */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                          <Car className="w-4 h-4 text-amber-500" />
                          <span>Vehicle Garage Status & Service Interval Projections</span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Live odometer tracking, maintenance alerts, and historical service thresholds
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setActiveTab('reminders')}
                          className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold px-2.5 py-1 rounded-lg flex items-center space-x-1 transition-colors"
                        >
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                          <span>Reminders View</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('vehicles')}
                          className="text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center space-x-1"
                        >
                          <span>View Garage</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {vehicleStats.map((veh, i) => (
                        <div
                          key={veh.id || i}
                          className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs space-y-3 relative overflow-hidden"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono font-black text-slate-950 bg-white px-2 py-0.5 rounded border border-slate-300 text-xs">
                                {veh.regNumber}
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm mt-1">{veh.make} {veh.model} ({veh.year})</h4>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                veh.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                  : veh.severity === 'warning'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : veh.severity === 'info'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}>
                                {veh.statusBadge}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {veh.totalServices} services logged
                              </span>
                            </div>
                          </div>

                          {/* Progress toward next service interval */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                              <span>Service Cycle Progress</span>
                              <span className="font-mono font-bold text-slate-800">{veh.progressPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  veh.severity === 'critical'
                                    ? 'bg-rose-500'
                                    : veh.severity === 'warning'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, veh.progressPercent))}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80 text-[11px]">
                            <div>
                              <span className="text-slate-500 text-[10px] block">Current Odometer</span>
                              <div className="flex items-center space-x-1">
                                <span className="font-mono font-bold text-slate-900">
                                  {veh.currentMileage.toLocaleString()} km
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickOdometer(veh)}
                                  title="Update Odometer"
                                  className="text-slate-400 hover:text-slate-800 text-[10px] p-0.5"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block">Next Service Target</span>
                              <span className="font-mono font-bold text-amber-700">
                                {veh.targetMileage.toLocaleString()} km
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block">Last Workshop Visit</span>
                              <span className="text-slate-800 font-medium">{veh.lastServiceDate}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block">Est. Due Date</span>
                              <span className="font-mono font-bold text-slate-900">{veh.estimatedDueDate}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <span className="text-[10px] text-slate-500 italic">
                              {veh.servicePackage.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => setReminderModalVehicle(veh)}
                              className="text-[11px] bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold px-2.5 py-1 rounded-lg flex items-center space-x-1 transition-colors"
                            >
                              <Bell className="w-3 h-3 text-amber-400" />
                              <span>Send Reminder</span>
                            </button>
                          </div>
                        </div>
                      ))}

                      {vehicleStats.length === 0 && (
                        <p className="text-slate-400 text-xs py-4 text-center col-span-2">No vehicles registered for this client.</p>
                      )}
                    </div>
                  </div>

                  {/* Recharts Vehicle Mileage Progression & Maintenance Frequency Chart */}
                  <VehicleMileageChart
                    vehicles={customerVehicles}
                    invoices={rawCustomerInvoices}
                    selectedVehicleFilter={selectedVehicleFilter}
                    onVehicleFilterChange={(reg) => setSelectedVehicleFilter(reg)}
                    serviceIntervalKm={serviceIntervalKm}
                  />

                  {/* Unified Chronological Master Timeline */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                          <History className="w-4 h-4 text-amber-500" />
                          <span>Chronological Service & Invoicing Master Timeline</span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Complete sequential record of all workshop jobs, diagnostic scopes, replacement parts, and invoice settlements
                        </p>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full w-fit">
                        {serviceHistoryEvents.length} Chronological Records
                      </span>
                    </div>

                    <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                      {serviceHistoryEvents.map((evt) => (
                        <div key={evt.id} className="relative group">
                          {/* Timeline Pin Dot */}
                          <div className={`absolute -left-6 sm:-left-8 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${
                            evt.status === 'PAID'
                              ? 'bg-emerald-500'
                              : evt.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                          </div>

                          {/* Event Card */}
                          <div className="bg-slate-50 hover:bg-slate-100/80 rounded-xl p-4 border border-slate-200 transition-all space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 text-xs">
                                  {evt.vehicleReg}
                                </span>
                                <span className="font-bold text-slate-800 text-xs">{evt.vehicleMakeModel}</span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  &bull; {evt.vehicleMileage > 0 ? `${evt.vehicleMileage.toLocaleString()} km` : 'Odo N/A'}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2 text-xs">
                                <span className="text-slate-500 font-medium">{evt.date}</span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    evt.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : evt.status === 'PARTIALLY_PAID'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {evt.status}
                                </span>
                              </div>
                            </div>

                            {/* Job Description Scope */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Service Scope / Diagnosis:
                              </span>
                              <p className="text-xs font-semibold text-slate-900 leading-snug">
                                {evt.jobDescription}
                              </p>
                            </div>

                            {/* Replaced Parts & Labor Badges */}
                            {evt.items && evt.items.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {evt.items.map((item, idx) => (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center space-x-1 text-[10px] font-medium px-2 py-0.5 rounded border ${
                                      item.type === 'PART'
                                        ? 'bg-amber-50/90 text-amber-900 border-amber-200'
                                        : 'bg-blue-50/90 text-blue-900 border-blue-200'
                                    }`}
                                  >
                                    <span className="font-bold">{item.quantity}x</span>
                                    <span>{item.description}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Financial Summary & Actions */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
                              <div className="flex items-center space-x-3">
                                <span className="font-mono text-slate-600">
                                  Ex VAT: <strong className="text-slate-900">{formatZAR(evt.subtotalExVat)}</strong>
                                </span>
                                <span className="font-mono text-slate-600">
                                  Total: <strong className="text-amber-800 font-black">{formatZAR(evt.totalIncVat)}</strong>
                                </span>
                                {evt.balanceDue > 0 && (
                                  <span className="font-mono text-rose-600 font-bold">
                                    Due: {formatZAR(evt.balanceDue)}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                                <button
                                  type="button"
                                  id={`timeline-preview-pdf-${evt.id}`}
                                  onClick={() => setPreviewInvoice(evt.rawInvoice)}
                                  className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center space-x-1 transition-colors"
                                >
                                  <Eye className="w-3 h-3 text-amber-600" />
                                  <span>Preview Invoice</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadInvoicePDF(evt.rawInvoice)}
                                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center space-x-1 transition-colors"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>PDF</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {serviceHistoryEvents.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          No service records or invoices found matching current search.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: VEHICLE SERVICE REMINDERS & THRESHOLD MANAGEMENT */}
              {activeTab === 'reminders' && (
                <div className="space-y-6">
                  {/* Reminders Header & Interactive Threshold Config */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Predictive Maintenance Engine
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Based on Historical Service Telemetry & Driving Pace
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 mt-1 flex items-center space-x-2">
                          <BellRing className="w-5 h-5 text-amber-500" />
                          <span>Vehicle Service Reminders & Threshold Management</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Automatically flags vehicles approaching service thresholds and generates WhatsApp / SMS / Email maintenance notices.
                        </p>
                      </div>

                      {/* Threshold & Interval Configuration Controls */}
                      <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs shrink-0">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Warning Threshold:
                          </label>
                          <select
                            id="reminder-threshold-select"
                            value={reminderThreshold}
                            onChange={e => setReminderThreshold(Number(e.target.value))}
                            className="bg-white font-bold text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          >
                            <option value={500}>Within 500 km</option>
                            <option value={1000}>Within 1,000 km</option>
                            <option value={1500}>Within 1,500 km (Standard)</option>
                            <option value={2500}>Within 2,500 km</option>
                            <option value={5000}>Within 5,000 km (Early Notice)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Service Interval:
                          </label>
                          <select
                            id="service-interval-select"
                            value={serviceIntervalKm}
                            onChange={e => setServiceIntervalKm(Number(e.target.value))}
                            className="bg-white font-bold text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                          >
                            <option value={10000}>Every 10,000 km</option>
                            <option value={15000}>Every 15,000 km (Standard ZA)</option>
                            <option value={20000}>Every 20,000 km (Extended)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Summary KPI Cards Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div 
                        onClick={() => setReminderFilterSeverity('critical')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          reminderFilterSeverity === 'critical'
                            ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-rose-700">Overdue</span>
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        </div>
                        <p className="text-xl font-black font-mono text-rose-700 mt-1">{reminderSummary.overdueCount}</p>
                        <span className="text-[10px] text-slate-500">Exceeded km limit</span>
                      </div>

                      <div 
                        onClick={() => setReminderFilterSeverity('warning')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          reminderFilterSeverity === 'warning'
                            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-amber-800">Due Soon</span>
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <p className="text-xl font-black font-mono text-amber-700 mt-1">{reminderSummary.dueSoonCount}</p>
                        <span className="text-[10px] text-slate-500">&lt; {reminderThreshold.toLocaleString()} km left</span>
                      </div>

                      <div 
                        onClick={() => setReminderFilterSeverity('info')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          reminderFilterSeverity === 'info'
                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-blue-700">Approaching</span>
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <p className="text-xl font-black font-mono text-blue-700 mt-1">{reminderSummary.approachingCount}</p>
                        <span className="text-[10px] text-slate-500">Next 60 days</span>
                      </div>

                      <div 
                        onClick={() => setReminderFilterSeverity('good')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          reminderFilterSeverity === 'good'
                            ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-emerald-700">Up To Date</span>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <p className="text-xl font-black font-mono text-emerald-700 mt-1">{reminderSummary.goodCount}</p>
                        <span className="text-[10px] text-slate-500">Normal operating range</span>
                      </div>
                    </div>

                    {/* Filter Severity Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 font-semibold mr-1">Filter by status:</span>
                      <button
                        type="button"
                        onClick={() => setReminderFilterSeverity('all')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          reminderFilterSeverity === 'all'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        All Vehicles ({vehicleStats.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setReminderFilterSeverity('action_required')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          reminderFilterSeverity === 'action_required'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-amber-100/80 text-amber-900 hover:bg-amber-200'
                        }`}
                      >
                        Action Required ({reminderSummary.actionRequiredCount})
                      </button>

                      <button
                        type="button"
                        onClick={() => setReminderFilterSeverity('critical')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          reminderFilterSeverity === 'critical'
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        Overdue ({reminderSummary.overdueCount})
                      </button>

                      <button
                        type="button"
                        onClick={() => setReminderFilterSeverity('warning')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          reminderFilterSeverity === 'warning'
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        Due Soon ({reminderSummary.dueSoonCount})
                      </button>

                      <button
                        type="button"
                        onClick={() => setReminderFilterSeverity('good')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          reminderFilterSeverity === 'good'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                      >
                        Up To Date ({reminderSummary.goodCount})
                      </button>
                    </div>
                  </div>

                  {/* Vehicle Reminder Cards */}
                  <div className="space-y-4">
                    {vehicleStats
                      .filter(veh => {
                        if (selectedVehicleFilter !== 'ALL' && veh.regNumber !== selectedVehicleFilter) return false;
                        if (reminderFilterSeverity === 'action_required') return veh.severity === 'critical' || veh.severity === 'warning';
                        if (reminderFilterSeverity === 'critical') return veh.severity === 'critical';
                        if (reminderFilterSeverity === 'warning') return veh.severity === 'warning';
                        if (reminderFilterSeverity === 'info') return veh.severity === 'info';
                        if (reminderFilterSeverity === 'good') return veh.severity === 'good';
                        return true;
                      })
                      .map((veh, i) => (
                        <div
                          key={veh.id || i}
                          className={`bg-white rounded-2xl border p-5 shadow-xs space-y-4 transition-all ${
                            veh.severity === 'critical'
                              ? 'border-rose-300 ring-1 ring-rose-200 bg-gradient-to-b from-rose-50/20 to-white'
                              : veh.severity === 'warning'
                              ? 'border-amber-300 ring-1 ring-amber-200 bg-gradient-to-b from-amber-50/20 to-white'
                              : 'border-slate-200'
                          }`}
                        >
                          {/* Card Header: Reg, Title, Severity Badge */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-center space-x-2.5">
                              <span className="font-mono font-black text-sm bg-slate-900 text-white px-2.5 py-1 rounded-lg shadow-xs">
                                {veh.regNumber}
                              </span>
                              <div>
                                <h4 className="font-black text-slate-900 text-base">
                                  {veh.year} {veh.make} {veh.model}
                                </h4>
                                {veh.vin && (
                                  <p className="font-mono text-[10px] text-slate-400">VIN: {veh.vin}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 self-start sm:self-center">
                              <span className={`text-xs font-black px-3 py-1 rounded-full border flex items-center space-x-1.5 ${
                                veh.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                  : veh.severity === 'warning'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : veh.severity === 'info'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}>
                                {veh.severity === 'critical' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                                {veh.severity === 'warning' && <Bell className="w-3.5 h-3.5 text-amber-600" />}
                                {veh.severity === 'info' && <Clock className="w-3.5 h-3.5 text-blue-600" />}
                                {veh.severity === 'good' && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                                <span>{veh.statusBadge}</span>
                              </span>
                            </div>
                          </div>

                          {/* Status Description Alert Callout */}
                          <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-3 ${
                            veh.severity === 'critical'
                              ? 'bg-rose-50 border border-rose-200 text-rose-900'
                              : veh.severity === 'warning'
                              ? 'bg-amber-50 border border-amber-200 text-amber-900'
                              : veh.severity === 'info'
                              ? 'bg-blue-50 border border-blue-200 text-blue-900'
                              : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                          }`}>
                            <div className="flex items-center space-x-2">
                              <Sparkles className="w-4 h-4 shrink-0" />
                              <span className="font-semibold">{veh.statusDescription}</span>
                            </div>
                            <span className="text-[11px] font-mono font-bold shrink-0 hidden sm:inline">
                              Interval: {serviceIntervalKm.toLocaleString()} km
                            </span>
                          </div>

                          {/* Service Interval Progress Bar & Marker Track */}
                          <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-600 flex items-center space-x-1">
                                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                                <span>Service Cycle Mileage Progress</span>
                              </span>
                              <span className="font-mono font-black text-slate-900">
                                {veh.progressPercent}% of cycle
                              </span>
                            </div>

                            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden relative">
                              <div
                                className={`h-3 rounded-full transition-all ${
                                  veh.severity === 'critical'
                                    ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                                    : veh.severity === 'warning'
                                    ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                    : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, veh.progressPercent))}%` }}
                              ></div>
                            </div>

                            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                              <span>Last Service: {veh.lastServiceMileage > 0 ? `${veh.lastServiceMileage.toLocaleString()} km` : '0 km'}</span>
                              <span className="font-bold text-slate-800">Current: {veh.currentMileage.toLocaleString()} km</span>
                              <span className="font-bold text-amber-700">Target: {veh.targetMileage.toLocaleString()} km</span>
                            </div>
                          </div>

                          {/* 4-Metric Diagnostic Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                              <span className="text-slate-500 text-[10px] uppercase font-bold block">Current Odometer</span>
                              <div className="flex items-center space-x-1.5">
                                <span className="text-sm font-black font-mono text-slate-900">
                                  {veh.currentMileage.toLocaleString()} km
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickOdometer(veh)}
                                  title="Quick Update Odometer"
                                  className="text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 p-1 rounded transition-colors"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-[10px] text-slate-400 block">Click to adjust</span>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                              <span className="text-slate-500 text-[10px] uppercase font-bold block">Service Milestone Target</span>
                              <p className="text-sm font-black font-mono text-amber-700">
                                {veh.targetMileage.toLocaleString()} km
                              </p>
                              <span className="text-[10px] text-slate-500 block">
                                {veh.kmRemaining <= 0 ? 'Exceeded milestone' : `${veh.kmRemaining.toLocaleString()} km to go`}
                              </span>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                              <span className="text-slate-500 text-[10px] uppercase font-bold block">Driving Pace (Historical)</span>
                              <p className="text-sm font-black font-mono text-slate-900">
                                ~ {veh.monthlyKmPace.toLocaleString()} km / mo
                              </p>
                              <span className="text-[10px] text-slate-500 block">
                                {veh.daysSinceLastService !== null ? `${veh.daysSinceLastService} days since visit` : 'No prior history'}
                              </span>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                              <span className="text-slate-500 text-[10px] uppercase font-bold block">Projected Due Date</span>
                              <p className="text-sm font-black font-mono text-emerald-700">
                                {veh.kmRemaining <= 0 ? 'IMMEDIATE' : veh.estimatedDueDate}
                              </p>
                              <span className="text-[10px] text-slate-500 block">
                                {veh.kmRemaining <= 0 ? 'Overdue for workshop' : `In ~${veh.estimatedDaysRemaining} days`}
                              </span>
                            </div>
                          </div>

                          {/* Recommended Service Scope & Maintenance Scope Box */}
                          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                              <div>
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                                  Recommended Scheduled Maintenance Scope
                                </span>
                                <h5 className="font-bold text-slate-900 text-xs sm:text-sm">
                                  {veh.servicePackage.title}
                                </h5>
                              </div>
                              <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full w-fit">
                                {veh.servicePackage.intervalLabel}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {veh.servicePackage.checklist.map((item: string, idx: number) => (
                                <div key={idx} className="flex items-start space-x-1.5 text-slate-700 text-[11px]">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Actions Bar: WhatsApp/Email Reminder, Odometer Edit, Service History */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                            <div className="flex items-center space-x-2 text-xs text-slate-500">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              <span>Last serviced on {veh.lastServiceDate}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenQuickOdometer(veh)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-colors"
                              >
                                <Gauge className="w-3.5 h-3.5 text-slate-600" />
                                <span>Update Odometer</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedVehicleFilter(veh.regNumber);
                                  setActiveTab('service_history');
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-colors"
                              >
                                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                                <span>Service History</span>
                              </button>

                              <button
                                type="button"
                                id={`send-reminder-btn-${veh.regNumber}`}
                                onClick={() => setReminderModalVehicle(veh)}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Send Service Reminder</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                    {vehicleStats.filter(veh => {
                      if (selectedVehicleFilter !== 'ALL' && veh.regNumber !== selectedVehicleFilter) return false;
                      if (reminderFilterSeverity === 'action_required') return veh.severity === 'critical' || veh.severity === 'warning';
                      if (reminderFilterSeverity === 'critical') return veh.severity === 'critical';
                      if (reminderFilterSeverity === 'warning') return veh.severity === 'warning';
                      if (reminderFilterSeverity === 'info') return veh.severity === 'info';
                      if (reminderFilterSeverity === 'good') return veh.severity === 'good';
                      return true;
                    }).length === 0 && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                        <h4 className="font-bold text-slate-900 text-sm">No vehicles match this filter</h4>
                        <p className="text-xs text-slate-500">All vehicles in this view are within safe operating thresholds.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setReminderFilterSeverity('all');
                            setSelectedVehicleFilter('ALL');
                          }}
                          className="mt-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg"
                        >
                          Show All Vehicles
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CHRONOLOGICAL PAST INVOICES LEDGER */}
              {activeTab === 'invoices' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>Chronological Past Invoices & Financial Statements</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Itemized chronological billing history with SARS 15% VAT breakdown and settlement receipts
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full">
                        {customerInvoices.length} Invoices
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-8"></th>
                          <th className="py-2.5 px-3">Date & Invoice #</th>
                          <th className="py-2.5 px-3">Vehicle Details</th>
                          <th className="py-2.5 px-3">Service Scope</th>
                          <th className="py-2.5 px-3 text-right">Total (inc VAT)</th>
                          <th className="py-2.5 px-3 text-right">Settled</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {customerInvoices.map((inv) => {
                          const isExpanded = expandedInvoiceId === inv.id;
                          return (
                            <React.Fragment key={inv.id}>
                              <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-amber-50/30' : ''}`}>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                                    title="Expand line items"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </td>

                                <td className="py-2.5 px-3 font-medium">
                                  <span className="font-mono font-bold text-slate-900 block">{inv.invoiceNumber}</span>
                                  <span className="text-[10px] text-slate-500 block">{inv.date}</span>
                                </td>

                                <td className="py-2.5 px-3">
                                  <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] block w-fit">
                                    {inv.vehicleReg}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">
                                    {inv.vehicleMakeModel}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 max-w-[180px]">
                                  <p className="truncate text-slate-800 font-medium text-[11px]" title={inv.jobDescription}>
                                    {inv.jobDescription}
                                  </p>
                                  <span className="text-[10px] text-slate-400">
                                    {inv.items?.length || 0} line item(s)
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                                  {formatZAR(inv.totalIncVat)}
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                                  {formatZAR(inv.amountPaid)}
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono font-bold">
                                  {inv.balanceDue > 0 ? (
                                    <span className="text-rose-600">{formatZAR(inv.balanceDue)}</span>
                                  ) : (
                                    <span className="text-emerald-600">R 0.00</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      inv.status === 'PAID'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : inv.status === 'PARTIALLY_PAID'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {inv.status}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end space-x-1">
                                    <button
                                      id={`client-invoices-preview-${inv.id}`}
                                      type="button"
                                      onClick={() => setPreviewInvoice(inv)}
                                      title="Preview Print-Ready A4 Tax Invoice Modal"
                                      className="bg-amber-50 hover:bg-amber-500 hover:text-slate-950 text-amber-900 border border-amber-200 font-bold px-2 py-1 rounded text-[11px] transition-colors flex items-center space-x-1"
                                    >
                                      <Eye className="w-3 h-3 text-amber-700" />
                                      <span>Preview</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadInvoicePDF(inv)}
                                      className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-800 font-bold px-2 py-1 rounded text-[11px] transition-colors flex items-center space-x-1"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>PDF</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded Row for Line Items */}
                              {isExpanded && (
                                <tr className="bg-slate-50/90 border-b border-slate-200">
                                  <td colSpan={9} className="p-3 sm:p-4">
                                    <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
                                      <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                                        <span className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">
                                          Itemized Breakdown for #{inv.invoiceNumber} ({inv.date})
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          Odometer: {(inv.vehicleMileage || 0).toLocaleString()} km
                                        </span>
                                      </div>

                                      <table className="w-full text-left text-[11px]">
                                        <thead className="bg-slate-50 text-slate-500 uppercase text-[9px]">
                                          <tr>
                                            <th className="py-1.5 px-2">Type</th>
                                            <th className="py-1.5 px-2">Description</th>
                                            <th className="py-1.5 px-2 text-center">Qty</th>
                                            <th className="py-1.5 px-2 text-right">Unit Price (ex VAT)</th>
                                            <th className="py-1.5 px-2 text-right">Total (ex VAT)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {(inv.items || []).map((item, idx) => (
                                            <tr key={idx}>
                                              <td className="py-1.5 px-2">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                  item.type === 'PART' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                                                }`}>
                                                  {item.type}
                                                </span>
                                              </td>
                                              <td className="py-1.5 px-2 font-medium text-slate-900">{item.description}</td>
                                              <td className="py-1.5 px-2 text-center font-bold">{item.quantity}</td>
                                              <td className="py-1.5 px-2 text-right font-mono text-slate-600">{formatZAR(item.unitPrice)}</td>
                                              <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">{formatZAR(item.totalExVat)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>

                                      {inv.notes && (
                                        <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                          <span className="font-semibold">Notes:</span> {inv.notes}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>

                    {customerInvoices.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No invoices recorded for this client matching current filter.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: VEHICLE SERVICE HISTORY LOGBOOK */}
              {activeTab === 'service_history' && (
                <div className="space-y-5">
                  {/* Vehicle Mileage & Maintenance Interval Visualization */}
                  <VehicleMileageChart
                    vehicles={customerVehicles}
                    invoices={rawCustomerInvoices}
                    selectedVehicleFilter={selectedVehicleFilter}
                    onVehicleFilterChange={(reg) => setSelectedVehicleFilter(reg)}
                    serviceIntervalKm={serviceIntervalKm}
                  />

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                        <Wrench className="w-4 h-4 text-amber-500" />
                        <span>Vehicle Service & Maintenance History Logbook</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Odometer intervals, parts installed, diagnostic findings, and warranty maintenance history
                      </p>
                    </div>
                    <button
                      type="button"
                      id="export-service-logbook-pdf"
                      onClick={handleDownloadCustomerHistoryPDF}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow-xs transition-colors self-start sm:self-auto"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Service Logbook PDF</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {serviceHistoryEvents.map((evt) => {
                      const isExpanded = expandedServiceId === evt.id;
                      return (
                        <div
                          key={evt.id}
                          className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-xs bg-slate-900 text-white px-2.5 py-0.5 rounded">
                                {evt.vehicleReg}
                              </span>
                              <span className="font-bold text-slate-900 text-sm">{evt.vehicleMakeModel}</span>
                              <span className="text-[11px] bg-amber-100 text-amber-900 font-mono font-bold px-2 py-0.5 rounded">
                                <Gauge className="w-3 h-3 inline mr-1 text-amber-700" />
                                {evt.vehicleMileage > 0 ? `${evt.vehicleMileage.toLocaleString()} km` : 'Mileage N/A'}
                              </span>
                              {evt.mileageDelta > 0 && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-mono px-1.5 py-0.5 rounded">
                                  +{evt.mileageDelta.toLocaleString()} km since prior service
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 text-xs">
                              <span className="text-slate-500 flex items-center space-x-1">
                                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                <span>{evt.date}</span>
                              </span>
                              <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                #{evt.invoiceNumber}
                              </span>
                            </div>
                          </div>

                          {/* Work Order Description */}
                          <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Work Order / Service Scope Performed:
                            </span>
                            <p className="text-xs text-slate-900 font-semibold">{evt.jobDescription}</p>
                          </div>

                          {/* Parts and Labor Items Table */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Replacement Parts & Labor Rendered ({evt.items.length} items)
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpandedServiceId(isExpanded ? null : evt.id)}
                                className="text-[11px] text-amber-700 hover:text-amber-800 font-bold"
                              >
                                {isExpanded ? 'Collapse Details' : 'View Full Itemized Specs'}
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {evt.items.slice(0, isExpanded ? evt.items.length : 3).map((item, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center text-[11px]"
                                >
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                      item.type === 'PART' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                                    }`}>
                                      {item.type}
                                    </span>
                                    <span className="font-medium text-slate-800 truncate">{item.description}</span>
                                  </div>
                                  <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                                    {item.quantity}x @ {formatZAR(item.unitPrice)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {!isExpanded && evt.items.length > 3 && (
                              <p className="text-[10px] text-slate-500 italic pt-0.5">
                                + {evt.items.length - 3} more parts/services logged on this job. Click &ldquo;View Full Itemized Specs&rdquo; above.
                              </p>
                            )}
                          </div>

                          {/* Footer with Warranty note and Total */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
                            <div className="flex items-center space-x-2 text-[11px] text-slate-600">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Workmanship guaranteed for 6 months / 10,000 km</span>
                            </div>

                            <div className="flex items-center space-x-3 self-end sm:self-auto">
                              <span className="font-mono text-xs font-black text-slate-950">
                                Total: {formatZAR(evt.totalIncVat)}
                              </span>
                              <button
                                type="button"
                                id={`service-preview-pdf-${evt.id}`}
                                onClick={() => setPreviewInvoice(evt.rawInvoice)}
                                className="bg-amber-50 hover:bg-amber-500 hover:text-slate-950 text-amber-900 border border-amber-200 font-bold px-2 py-1 rounded text-[11px] transition-colors flex items-center space-x-1"
                              >
                                <Eye className="w-3 h-3 text-amber-700" />
                                <span>Preview Invoice</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadInvoicePDF(evt.rawInvoice)}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-2 py-1 rounded text-[11px] transition-colors flex items-center space-x-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>PDF</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {serviceHistoryEvents.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No service records logged for this vehicle or customer.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* TAB: VEHICLE MILEAGE TELEMETRY & FREQUENCY ANALYTICS */}
              {activeTab === 'mileage_chart' && (
                <div className="space-y-5">
                  <VehicleMileageChart
                    vehicles={customerVehicles}
                    invoices={rawCustomerInvoices}
                    selectedVehicleFilter={selectedVehicleFilter}
                    onVehicleFilterChange={(reg) => setSelectedVehicleFilter(reg)}
                    serviceIntervalKm={serviceIntervalKm}
                  />
                </div>
              )}

              {/* TAB 4: GARAGE VEHICLES */}
              {activeTab === 'vehicles' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                        <Car className="w-4 h-4 text-blue-500" />
                        <span>Client Vehicle Garage ({customerVehicles.length})</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Registered vehicles with live odometer telemetry, maintenance status, and lifetime service spend
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenEditCustomer(selectedCustomer)}
                      className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto"
                    >
                      + Add / Edit Vehicles
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {vehicleStats.map((veh, i) => (
                      <div
                        key={veh.id || i}
                        className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono font-black text-sm bg-white px-2.5 py-0.5 rounded border border-slate-300 text-slate-950">
                              {veh.regNumber}
                            </span>
                            <h4 className="font-black text-slate-900 text-base mt-1">{veh.make} {veh.model}</h4>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                              {veh.year}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              veh.severity === 'critical'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : veh.severity === 'warning'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : veh.severity === 'info'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}>
                              {veh.statusBadge}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200/80">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">Current Odometer:</span>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono font-bold text-slate-900">{veh.currentMileage.toLocaleString()} km</span>
                              <button
                                type="button"
                                onClick={() => handleOpenQuickOdometer(veh)}
                                title="Update Odometer"
                                className="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 p-0.5 rounded border border-amber-200"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">Next Service Target:</span>
                            <span className="font-mono font-bold text-amber-700">{veh.targetMileage.toLocaleString()} km</span>
                          </div>
                          {veh.vin && <p className="font-mono text-[11px]"><span className="font-semibold text-slate-800">VIN:</span> {veh.vin}</p>}
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">Workshop Visits:</span>
                            <span>{veh.totalServices} services logged</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">Lifetime Spend:</span>
                            <span className="font-mono font-bold text-slate-900">{formatZAR(veh.totalSpend)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVehicleFilter(veh.regNumber);
                              setActiveTab('service_history');
                            }}
                            className="text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center space-x-1"
                          >
                            <span>Service History</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setReminderModalVehicle(veh)}
                            className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-lg flex items-center space-x-1 transition-colors shadow-xs"
                          >
                            <Send className="w-3 h-3" />
                            <span>Remind Client</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: PAYMENT RECEIPTS */}
              {activeTab === 'payments' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        <span>Itemized Payment Receipts & Settlements ({allPayments.length})</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Chronological record of EFT, SnapScan, Card, and Cash settlements received from this client
                      </p>
                    </div>
                    <span className="font-mono font-black text-emerald-700 text-sm bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      Total Settled: {formatZAR(totalPaid)}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {allPayments.map((pay, i) => (
                      <div
                        key={pay.id || i}
                        className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200 gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{pay.method} Payment</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded">
                              Ref: {pay.reference}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Date: {pay.date} &bull; Applied to Invoice <span className="font-mono font-bold text-slate-800">#{pay.invoiceNumber}</span> ({pay.vehicleReg})
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="font-mono font-black text-emerald-700 text-base">
                            {formatZAR(pay.amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">Settled & Reconciled</span>
                        </div>
                      </div>
                    ))}

                    {allPayments.length === 0 && (
                      <p className="text-center text-slate-400 text-xs py-6">No payments recorded for this client yet.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="font-bold">Select a client from the left directory to view portal summary & service history.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add / Edit Client Profile */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingCustomer ? 'Edit Client Profile' : 'Register New Client & Vehicles'}
              </h2>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerSubmit} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Client Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="e.g. Johan Van Der Merwe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="+27 (0)82 491 8291"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="johan@capetransport.co.za"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SARS VAT Number</label>
                  <input
                    type="text"
                    value={formVatNumber}
                    onChange={e => setFormVatNumber(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    placeholder="4980192837"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Physical / Postal Address</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  placeholder="Unit 4, Brackenfell Industrial Park, Cape Town, 7560"
                />
              </div>

              {/* Vehicle Sub-form */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 uppercase">Vehicles In Garage</h4>
                    <p className="text-[11px] text-slate-500">Auto-filled into quotes & invoices</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVehicleRow}
                    className="bg-slate-800 text-amber-400 font-bold px-2.5 py-1 rounded text-xs"
                  >
                    + Add Vehicle
                  </button>
                </div>

                {formVehicles.map((veh, index) => (
                  <div
                    key={veh.id || index}
                    className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 items-center text-xs"
                  >
                    <input
                      type="text"
                      placeholder="Reg (e.g. CA 123-456)"
                      value={veh.regNumber}
                      onChange={e => handleUpdateVehicleRow(index, 'regNumber', e.target.value)}
                      className="p-1.5 border border-slate-300 rounded font-mono uppercase font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Make (e.g. Ford)"
                      value={veh.make}
                      onChange={e => handleUpdateVehicleRow(index, 'make', e.target.value)}
                      className="p-1.5 border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      placeholder="Model (e.g. Ranger 3.2)"
                      value={veh.model}
                      onChange={e => handleUpdateVehicleRow(index, 'model', e.target.value)}
                      className="p-1.5 border border-slate-300 rounded"
                    />
                    <input
                      type="number"
                      placeholder="Odo (km)"
                      value={veh.mileage}
                      onChange={e => handleUpdateVehicleRow(index, 'mileage', Number(e.target.value))}
                      className="p-1.5 border border-slate-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveVehicleRow(index)}
                      className="text-rose-600 hover:text-rose-800 font-bold text-xs p-1 text-right"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-sm"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Tax Invoice Preview Modal (Print-Ready A4 Document) */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto invoice-modal-backdrop">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto invoice-modal-container">
            {/* Modal Actions Header - Hidden in Print */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 invoice-modal-header no-print">
              <div className="flex items-center space-x-2">
                <span className="bg-amber-100 text-amber-900 font-black text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                  SARS Tax Invoice
                </span>
                <h2 className="text-base font-bold text-slate-900 font-mono">
                  {previewInvoice.invoiceNumber}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="client-modal-print-invoice-btn"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Print A4 Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadInvoicePDF(previewInvoice)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF Export</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official Rendered Tax Invoice Paper (A4 Format) */}
            <div id="printable-tax-invoice-client" className="printable-invoice-sheet bg-white rounded-xl p-6 sm:p-8 space-y-6 text-xs text-slate-900 border border-slate-200 print-border shadow-xs">
              {/* Header Section: Workshop Identity & Invoice Metadata */}
              <div className="invoice-header-section flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-xs">
                      JC
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase">
                        {settings.workshopName}
                      </h1>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium pt-1">
                    Specialist Mechanical Repairs, Diagnostics & Auto Services
                  </p>
                  <div className="text-[11px] text-slate-600 space-y-0.5 pt-0.5">
                    <p><span className="font-semibold text-slate-800">Physical Address:</span> {settings.physicalAddress}</p>
                    <p><span className="font-semibold text-slate-800">Tel / WhatsApp:</span> {settings.phone}</p>
                    <p className="font-mono text-slate-700">
                      <span className="font-semibold">SARS VAT Reg No:</span> {settings.vatNumber} &bull; <span className="font-semibold">PAYE No:</span> {settings.sarsPayeNumber}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1.5 shrink-0">
                  <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded text-sm sm:text-base font-black tracking-wider uppercase">
                    TAX INVOICE
                  </div>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-mono font-black text-slate-950 text-sm">
                      #{previewInvoice.invoiceNumber}
                    </p>
                    <p className="text-slate-600"><span className="font-semibold text-slate-800">Issue Date:</span> {previewInvoice.date}</p>
                    <p className="text-slate-600"><span className="font-semibold text-slate-800">Payment Due:</span> {previewInvoice.dueDate}</p>
                    <div className="pt-1">
                      <span
                        className={`inline-block font-black text-[10px] px-2.5 py-0.5 rounded uppercase tracking-wider ${
                          previewInvoice.status === 'PAID'
                            ? 'print-badge-paid bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : previewInvoice.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'print-badge-unpaid bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        Status: {previewInvoice.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer & Vehicle Information Side-by-Side */}
              <div className="invoice-customer-vehicle-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="print-box bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 mb-1.5">
                    Billed Client Details
                  </span>
                  <p className="font-bold text-sm text-slate-950">{previewInvoice.customerName}</p>
                  <p className="text-slate-600">{previewInvoice.customerPhone}</p>
                  <p className="text-slate-600">{previewInvoice.customerEmail}</p>
                  <p className="text-slate-600">{previewInvoice.customerAddress}</p>
                  {previewInvoice.customerVatNumber && (
                    <p className="text-slate-800 font-mono text-[11px] pt-1">
                      <span className="font-bold">Client VAT Reg:</span> {previewInvoice.customerVatNumber}
                    </p>
                  )}
                </div>

                <div className="print-box bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 mb-1.5">
                    Vehicle Particulars & Job Scope
                  </span>
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-sm text-slate-950">{previewInvoice.vehicleMakeModel}</p>
                    <span className="font-mono font-black text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-900">
                      {previewInvoice.vehicleReg}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-700">Odometer:</span> {previewInvoice.vehicleMileage.toLocaleString()} km
                    {previewInvoice.vehicleVin && ` • VIN: ${previewInvoice.vehicleVin}`}
                  </p>
                  <div className="bg-white p-2 rounded border border-slate-200/80 mt-1">
                    <span className="font-bold text-[10px] text-slate-500 block uppercase">Work Order Scope:</span>
                    <p className="text-slate-800 text-[11px] font-medium leading-snug">{previewInvoice.jobDescription}</p>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto">
                <table className="printable-table w-full text-left">
                  <thead className="bg-slate-100 border-y-2 border-slate-300 text-slate-800 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-center w-16">Type</th>
                      <th className="py-2.5 px-3 text-center w-14">Qty</th>
                      <th className="py-2.5 px-3 text-right w-28">Unit Price (ex VAT)</th>
                      <th className="py-2.5 px-3 text-center w-14">Disc</th>
                      <th className="py-2.5 px-3 text-right w-28">Total (ex VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(previewInvoice.items || []).map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{i + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{item.description}</td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              item.type === 'LABOR' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{formatZAR(item.unitPrice)}</td>
                        <td className="py-2 px-3 text-center font-mono text-slate-500">
                          {item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatZAR(item.totalExVat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Banking Details */}
              <div className="invoice-totals-summary grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t-2 border-slate-200">
                {/* EFT Banking Details & SARS Reference */}
                <div className="invoice-banking-terms print-box bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <span className="font-bold text-slate-800 block text-xs uppercase tracking-wide border-b border-slate-200 pb-1">
                    EFT Banking Details
                  </span>
                  <div className="space-y-0.5 text-[11px] text-slate-700">
                    <p><span className="font-semibold text-slate-900">Bank Name:</span> {settings.bankName}</p>
                    <p><span className="font-semibold text-slate-900">Account Number:</span> <span className="font-mono font-bold text-slate-950">{settings.accountNumber}</span></p>
                    <p><span className="font-semibold text-slate-900">Branch Code:</span> <span className="font-mono">{settings.branchCode}</span></p>
                    <p><span className="font-semibold text-slate-900">Payment Reference:</span> <span className="font-mono font-black text-amber-700">{previewInvoice.invoiceNumber}</span></p>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-1 leading-relaxed border-t border-slate-200/80">
                    Please email proof of payment to accounts with your invoice number reference.
                  </p>
                </div>

                {/* Tax & Total Calculation */}
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Subtotal (Excl. 15% VAT):</span>
                    <span className="font-mono font-semibold text-slate-900">{formatZAR(previewInvoice.subtotalExVat)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">SARS Output VAT @ 15.0%:</span>
                    <span className="font-mono font-semibold text-slate-900">{formatZAR(previewInvoice.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-y-2 border-slate-900 print-total-highlight text-sm sm:text-base font-black text-slate-950">
                    <span>Grand Total (Incl. 15% VAT):</span>
                    <span className="font-mono text-amber-700 font-black">{formatZAR(previewInvoice.totalIncVat)}</span>
                  </div>
                  {previewInvoice.amountPaid > 0 && (
                    <div className="flex justify-between py-1 text-emerald-700 font-bold">
                      <span>Total Amount Paid / Settled:</span>
                      <span className="font-mono">- {formatZAR(previewInvoice.amountPaid)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 text-sm font-black text-slate-950">
                    <span>Outstanding Balance Due:</span>
                    <span className="font-mono text-rose-700 font-black">{formatZAR(previewInvoice.balanceDue)}</span>
                  </div>
                </div>
              </div>

              {/* Workmanship Guarantee & Legal Notice */}
              <div className="avoid-page-break bg-slate-50 p-3 rounded-lg border border-slate-200 text-[10px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">SARS Compliance Notice & Warranty Terms:</p>
                <p className="leading-relaxed">
                  Official South African Tax Invoice issued in accordance with Section 20(4) of the Value-Added Tax Act No. 89 of 1991. 
                  All replacement parts carry standard manufacturer warranties. Workmanship is guaranteed for 6 months or 10,000 km, whichever occurs first. 
                  Goods remain the property of {settings.workshopName} until settled in full.
                </p>
                {previewInvoice.notes && (
                  <p className="pt-1 text-slate-800 border-t border-slate-200 font-medium">
                    <span className="font-bold">Workshop Notes:</span> {previewInvoice.notes}
                  </p>
                )}
              </div>

              {/* Signature Blocks for Formal Sign-off */}
              <div className="invoice-signatures-block grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs">
                <div className="space-y-8">
                  <div className="border-b border-slate-400 pb-1"></div>
                  <div className="text-[11px] text-slate-600">
                    <p className="font-bold text-slate-900">Authorized Workshop Signature</p>
                    <p className="text-[10px] text-slate-400">For {settings.workshopName} &bull; Date: _______________</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="border-b border-slate-400 pb-1"></div>
                  <div className="text-[11px] text-slate-600">
                    <p className="font-bold text-slate-900">Customer Acceptance & Vehicle Release</p>
                    <p className="text-[10px] text-slate-400">Signed in acceptance of work completed &bull; Date: _______________</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SERVICE REMINDER NOTIFICATION DISPATCH (WHATSAPP / EMAIL / SMS) */}
      {reminderModalVehicle && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500 text-slate-950 rounded-xl">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    Send Vehicle Service Reminder
                  </h3>
                  <p className="text-xs text-slate-400">
                    {reminderModalVehicle.year} {reminderModalVehicle.make} {reminderModalVehicle.model} ({reminderModalVehicle.regNumber})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReminderModalVehicle(null);
                  setCopiedReminderFeedback(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {/* Recipient summary banner */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-semibold">Client Name:</span>
                  <span className="font-bold text-slate-900">{selectedCustomer.name}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-semibold">Mobile Phone (WhatsApp):</span>
                  <span className="font-mono font-bold text-slate-900">{selectedCustomer.phone}</span>
                </div>
                {selectedCustomer.email && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-semibold">Email Address:</span>
                    <span className="text-slate-900">{selectedCustomer.email}</span>
                  </div>
                )}
              </div>

              {/* Status summary pill */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs">{reminderModalVehicle.statusBadge}</span>
                  <p className="text-[11px]">{reminderModalVehicle.statusDescription}</p>
                </div>
                <span className="font-mono font-black text-xs text-amber-800 shrink-0">
                  Target: {reminderModalVehicle.targetMileage.toLocaleString()} km
                </span>
              </div>

              {/* Formatted Message Preview */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Generated Service Notice Message:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const text = generateReminderMessageText(reminderModalVehicle);
                      handleCopyReminderText(text);
                    }}
                    className="text-amber-700 hover:text-amber-800 font-bold flex items-center space-x-1 text-[11px]"
                  >
                    {copiedReminderFeedback ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto border border-slate-800 select-all">
                  {generateReminderMessageText(reminderModalVehicle)}
                </div>
              </div>
            </div>

            {/* Modal Footer / Dispatch Actions */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setReminderModalVehicle(null);
                  setCopiedReminderFeedback(false);
                }}
                className="text-slate-600 hover:text-slate-900 font-bold text-xs px-3 py-2"
              >
                Close
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {/* WhatsApp Dispatch Button */}
                <a
                  href={`https://wa.me/${selectedCustomer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(generateReminderMessageText(reminderModalVehicle))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Open WhatsApp</span>
                </a>

                {/* Email Dispatch Button (if customer has email) */}
                {selectedCustomer.email && (
                  <a
                    href={`mailto:${selectedCustomer.email}?subject=${encodeURIComponent(`Vehicle Service Reminder - ${reminderModalVehicle.regNumber} (${settings.workshopName})`)}&body=${encodeURIComponent(generateReminderMessageText(reminderModalVehicle))}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Email</span>
                  </a>
                )}

                {/* Copy to Clipboard */}
                <button
                  type="button"
                  onClick={() => {
                    const text = generateReminderMessageText(reminderModalVehicle);
                    handleCopyReminderText(text);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  {copiedReminderFeedback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReminderFeedback ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: QUICK ODOMETER UPDATE */}
      {editingOdometerVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Update Odometer Reading</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingOdometerVehicle(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveQuickOdometer();
              }}
              className="p-5 space-y-4"
            >
              <div>
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                  {editingOdometerVehicle.regNumber}
                </span>
                <p className="font-bold text-slate-900 text-sm mt-1">
                  {editingOdometerVehicle.makeModel}
                </p>
                <p className="text-[11px] text-slate-500">
                  Previous recorded odometer: {editingOdometerVehicle.mileage.toLocaleString()} km
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Current Odometer (km):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={newOdometerValue}
                    onChange={(e) => setNewOdometerValue(Number(e.target.value))}
                    className="w-full pl-3 pr-10 py-2 font-mono font-bold text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="e.g. 85000"
                    autoFocus
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                    KM
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Updates customer vehicle fleet records and recalculates reminder intervals instantly.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOdometerVehicle(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs"
                >
                  Save Odometer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
