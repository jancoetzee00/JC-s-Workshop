import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Eye,
  CreditCard,
  RefreshCw,
  X,
  Printer,
  ChevronRight,
  Sparkles,
  Mail,
  Send,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Invoice,
  Quotation,
  Customer,
  InventoryItem,
  LineItem,
  PaymentEntry,
  WorkshopSettings,
} from '../types';
import { formatZAR } from '../utils/sarsTaxEngine';
import { generateInvoicePDF, generateQuotationPDF } from '../utils/pdfGenerator';
import {
  generateInvoiceEmailTemplate,
  generateQuotationEmailTemplate,
  buildMailtoUrl,
} from '../utils/emailTemplates';

interface QuotesAndInvoicesModuleProps {
  invoices: Invoice[];
  quotes: Quotation[];
  customers: Customer[];
  inventory: InventoryItem[];
  settings: WorkshopSettings;
  onSaveInvoice: (invoice: Invoice) => void;
  onSaveQuote: (quote: Quotation) => void;
  onDeleteInvoice: (id: string) => void;
  onDeleteQuote: (id: string) => void;
  onRecordPayment: (invoiceId: string, payment: PaymentEntry) => void;
  onConvertQuoteToInvoice: (quote: Quotation) => void;
  triggerNewInvoice?: boolean;
  onResetTriggerInvoice?: () => void;
  triggerNewQuote?: boolean;
  onResetTriggerQuote?: () => void;
}

export const QuotesAndInvoicesModule: React.FC<QuotesAndInvoicesModuleProps> = ({
  invoices = [],
  quotes = [],
  customers = [],
  inventory = [],
  settings,
  onSaveInvoice,
  onSaveQuote,
  onDeleteInvoice,
  onDeleteQuote,
  onRecordPayment,
  onConvertQuoteToInvoice,
  triggerNewInvoice,
  onResetTriggerInvoice,
  triggerNewQuote,
  onResetTriggerQuote,
}) => {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotes'>('invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal States
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);

  // Send to Customer (mailto: template) Modal State
  const [emailModalData, setEmailModalData] = useState<{
    type: 'INVOICE' | 'QUOTE';
    invoice?: Invoice;
    quote?: Quotation;
    to: string;
    subject: string;
    body: string;
  } | null>(null);
  const [copiedEmailFeedback, setCopiedEmailFeedback] = useState(false);

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'EFT' | 'CARD' | 'CASH' | 'SNAPSCAN' | 'YOCO'>('EFT');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Invoice / Quote Form State
  const [formType, setFormType] = useState<'INVOICE' | 'QUOTE'>('INVOICE');
  const [formId, setFormId] = useState<string>('');
  const [formNumber, setFormNumber] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formCustomerName, setFormCustomerName] = useState<string>('');
  const [formCustomerPhone, setFormCustomerPhone] = useState<string>('');
  const [formCustomerEmail, setFormCustomerEmail] = useState<string>('');
  const [formCustomerAddress, setFormCustomerAddress] = useState<string>('');
  const [formCustomerVat, setFormCustomerVat] = useState<string>('');

  const [formVehicleReg, setFormVehicleReg] = useState<string>('');
  const [formVehicleMakeModel, setFormVehicleMakeModel] = useState<string>('');
  const [formVehicleMileage, setFormVehicleMileage] = useState<number>(85000);
  const [formVehicleVin, setFormVehicleVin] = useState<string>('');
  const [formJobDescription, setFormJobDescription] = useState<string>('Standard Mechanical Service & Inspection');

  const [formLineItems, setFormLineItems] = useState<LineItem[]>([
    {
      id: 'LI-INIT-1',
      type: 'LABOR',
      description: 'Standard Minor Service Inspection & Diagnostics (2.0 hrs)',
      quantity: 2.0,
      unitPrice: settings.defaultLaborRateExVat,
      discountPercent: 0,
      totalExVat: settings.defaultLaborRateExVat * 2,
    },
  ]);

  const [formNotes, setFormNotes] = useState<string>('All parts carry manufacturer warranty. Workmanship guaranteed for 6 months / 10,000km.');

  // Customer Selector Handler
  const handleSelectCustomer = (customerId: string) => {
    setFormCustomerId(customerId);
    const cust = customers.find(c => c.id === customerId);
    if (cust) {
      setFormCustomerName(cust.name);
      setFormCustomerPhone(cust.phone);
      setFormCustomerEmail(cust.email);
      setFormCustomerAddress(cust.address);
      setFormCustomerVat(cust.vatNumber || '');

      if (cust.vehicles && cust.vehicles.length > 0) {
        const v = cust.vehicles[0];
        setFormVehicleReg(v.regNumber);
        setFormVehicleMakeModel(`${v.make} ${v.model} (${v.year})`);
        setFormVehicleMileage(v.mileage || 80000);
        setFormVehicleVin(v.vin || '');
      }
    }
  };

  // Line Items Calculation
  const subtotalExVat = formLineItems.reduce((sum, item) => sum + item.totalExVat, 0);
  const vatAmount = Math.round(subtotalExVat * settings.vatRate * 100) / 100;
  const totalIncVat = subtotalExVat + vatAmount;

  // Add Line Item
  const handleAddLineItem = (type: 'LABOR' | 'PART') => {
    if (type === 'LABOR') {
      setFormLineItems([
        ...formLineItems,
        {
          id: `LI-${Date.now()}`,
          type: 'LABOR',
          description: 'Workshop Mechanical Labor (1.0 hr)',
          quantity: 1.0,
          unitPrice: settings.defaultLaborRateExVat,
          discountPercent: 0,
          totalExVat: settings.defaultLaborRateExVat,
        },
      ]);
    } else {
      // Pick first item in inventory
      const firstPart = inventory[0];
      setFormLineItems([
        ...formLineItems,
        {
          id: `LI-${Date.now()}`,
          type: 'PART',
          partId: firstPart?.id,
          sku: firstPart?.sku,
          description: firstPart ? firstPart.name : 'Replacement Auto Part',
          quantity: 1,
          unitPrice: firstPart ? firstPart.sellingPrice : 250,
          discountPercent: 0,
          totalExVat: firstPart ? firstPart.sellingPrice : 250,
        },
      ]);
    }
  };

  const handleUpdateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...formLineItems];
    const item = { ...updated[index], [field]: value };

    // If part was selected from dropdown, update sku, description, and price automatically
    if (field === 'partId') {
      const selectedPart = inventory.find(p => p.id === value);
      if (selectedPart) {
        item.sku = selectedPart.sku;
        item.description = selectedPart.name;
        item.unitPrice = selectedPart.sellingPrice;
      }
    }

    // Recompute total
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discountPercent) || 0;
    item.totalExVat = Math.round(qty * price * (1 - disc / 100) * 100) / 100;

    updated[index] = item;
    setFormLineItems(updated);
  };

  const handleRemoveLineItem = (index: number) => {
    setFormLineItems(formLineItems.filter((_, i) => i !== index));
  };

  // Trigger modal effects from external buttons
  React.useEffect(() => {
    if (triggerNewInvoice) {
      handleOpenNewInvoice();
      if (onResetTriggerInvoice) onResetTriggerInvoice();
    }
  }, [triggerNewInvoice]);

  React.useEffect(() => {
    if (triggerNewQuote) {
      handleOpenNewQuote();
      if (onResetTriggerQuote) onResetTriggerQuote();
    }
  }, [triggerNewQuote]);

  // Open New Invoice Modal
  const handleOpenNewInvoice = () => {
    setFormType('INVOICE');
    setFormId(`INV-${Date.now().toString().slice(-4)}`);
    setFormNumber(`${settings.invoicePrefix}-${new Date().getFullYear()}-${(invoices.length + 1).toString().padStart(4, '0')}`);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    // Select first customer by default if available
    if (customers.length > 0) {
      handleSelectCustomer(customers[0].id);
    } else {
      setFormCustomerId('');
      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormCustomerEmail('');
      setFormCustomerAddress('');
      setFormVehicleMakeModel('');
      setFormVehicleReg('');
      setFormVehicleVin('');
      setFormVehicleMileage(0);
    }
    
    setIsInvoiceModalOpen(true);
  };

  // Open New Quote Modal
  const handleOpenNewQuote = () => {
    setFormType('QUOTE');
    setFormId(`QT-${Date.now().toString().slice(-4)}`);
    setFormNumber(`${settings.quotePrefix}-${new Date().getFullYear()}-${(quotes.length + 1).toString().padStart(4, '0')}`);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDueDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    if (customers.length > 0) {
      handleSelectCustomer(customers[0].id);
    } else {
      setFormCustomerId('');
      setFormCustomerName('');
      setFormCustomerPhone('');
      setFormCustomerEmail('');
      setFormCustomerAddress('');
      setFormVehicleMakeModel('');
      setFormVehicleReg('');
      setFormVehicleVin('');
      setFormVehicleMileage(0);
    }
    
    setIsQuoteModalOpen(true);
  };

  // Save Invoice Submit
  const handleSaveInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName || formLineItems.length === 0) return;

    const invoice: Invoice = {
      id: formId,
      invoiceNumber: formNumber,
      date: formDate,
      dueDate: formDueDate,
      customerId: formCustomerId || 'CUST-WALKIN',
      customerName: formCustomerName,
      customerPhone: formCustomerPhone,
      customerEmail: formCustomerEmail,
      customerAddress: formCustomerAddress,
      customerVatNumber: formCustomerVat,
      vehicleReg: formVehicleReg || 'UNREGISTERED',
      vehicleMakeModel: formVehicleMakeModel || 'Generic Vehicle',
      vehicleMileage: Number(formVehicleMileage) || 0,
      vehicleVin: formVehicleVin,
      jobDescription: formJobDescription,
      items: formLineItems,
      subtotalExVat,
      vatRate: settings.vatRate,
      vatAmount,
      totalIncVat,
      amountPaid: 0,
      balanceDue: totalIncVat,
      status: 'UNPAID',
      payments: [],
      notes: formNotes,
      createdAt: new Date().toISOString(),
    };

    onSaveInvoice(invoice);
    setIsInvoiceModalOpen(false);
  };

  // Save Quote Submit
  const handleSaveQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName || formLineItems.length === 0) return;

    const quote: Quotation = {
      id: formId,
      quoteNumber: formNumber,
      date: formDate,
      expiryDate: formDueDate,
      customerId: formCustomerId || 'CUST-WALKIN',
      customerName: formCustomerName,
      customerPhone: formCustomerPhone,
      customerEmail: formCustomerEmail,
      customerAddress: formCustomerAddress,
      customerVatNumber: formCustomerVat,
      vehicleReg: formVehicleReg || 'UNREGISTERED',
      vehicleMakeModel: formVehicleMakeModel || 'Generic Vehicle',
      vehicleMileage: Number(formVehicleMileage) || 0,
      vehicleVin: formVehicleVin,
      jobDescription: formJobDescription,
      items: formLineItems,
      subtotalExVat,
      vatRate: settings.vatRate,
      vatAmount,
      totalIncVat,
      notes: formNotes,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };

    onSaveQuote(quote);
    setIsQuoteModalOpen(false);
  };

  // Record Payment Modal Open
  const handleOpenPaymentModal = (invoice: Invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentAmount(invoice.balanceDue);
    setPaymentMethod('EFT');
    setPaymentRef(`EFT-${invoice.invoiceNumber}`);
    setPaymentNotes('Settlement of workshop invoice');
    setIsPaymentModalOpen(true);
  };

  // Record Payment Submit
  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment || paymentAmount <= 0) return;

    const payment: PaymentEntry = {
      id: `PAY-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      amount: Number(paymentAmount),
      method: paymentMethod,
      reference: paymentRef || `REC-${Date.now().toString().slice(-4)}`,
      notes: paymentNotes,
    };

    onRecordPayment(selectedInvoiceForPayment.id, payment);
    setIsPaymentModalOpen(false);

    // Trigger celebration confetti
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
    });
  };

  // Direct PDF Download handlers
  const handleDownloadInvoicePDF = (inv: Invoice) => {
    const doc = generateInvoicePDF(inv, settings);
    doc.save(`${inv.invoiceNumber}_${inv.vehicleReg.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDownloadQuotePDF = (qt: Quotation) => {
    const doc = generateQuotationPDF(qt, settings);
    doc.save(`${qt.quoteNumber}_${qt.vehicleReg.replace(/\s+/g, '_')}.pdf`);
  };

  // Send to Customer (mailto: template) handlers
  const handleOpenSendInvoiceModal = (inv: Invoice, triggerDirectMailto: boolean = false) => {
    const tmpl = generateInvoiceEmailTemplate(inv, settings);
    setEmailModalData({
      type: 'INVOICE',
      invoice: inv,
      to: tmpl.to,
      subject: tmpl.subject,
      body: tmpl.body,
    });
    if (triggerDirectMailto && tmpl.to) {
      window.location.href = buildMailtoUrl(tmpl.to, tmpl.subject, tmpl.body);
    }
  };

  const handleOpenSendQuoteModal = (qt: Quotation, triggerDirectMailto: boolean = false) => {
    const tmpl = generateQuotationEmailTemplate(qt, settings);
    setEmailModalData({
      type: 'QUOTE',
      quote: qt,
      to: tmpl.to,
      subject: tmpl.subject,
      body: tmpl.body,
    });
    if (triggerDirectMailto && tmpl.to) {
      window.location.href = buildMailtoUrl(tmpl.to, tmpl.subject, tmpl.body);
    }
  };

  const handleTriggerMailto = () => {
    if (!emailModalData) return;
    const url = buildMailtoUrl(emailModalData.to, emailModalData.subject, emailModalData.body);
    window.location.href = url;
  };

  const handleCopyEmailText = () => {
    if (!emailModalData) return;
    const textToCopy = `To: ${emailModalData.to}\nSubject: ${emailModalData.subject}\n\n${emailModalData.body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedEmailFeedback(true);
    setTimeout(() => setCopiedEmailFeedback(false), 2500);
  };

  // Filtered lists
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.vehicleReg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.vehicleMakeModel.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredQuotes = quotes.filter(qt => {
    const matchesSearch =
      qt.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qt.vehicleReg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qt.vehicleMakeModel.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || qt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Quotations & Tax Invoices</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Direct PDF Export
            </span>
          </h1>
          <p className="text-slate-500 text-sm">
            SARS compliant 15% VAT invoices, estimates, live parts integration, and payment history
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="create-new-quote-btn"
            onClick={handleOpenNewQuote}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold px-4 py-2 rounded-xl text-sm border border-slate-700 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>New Quotation</span>
          </button>
          <button
            id="create-new-invoice-btn"
            onClick={handleOpenNewInvoice}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Tax Invoice</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 justify-between items-center">
          <div className="flex">
            <button
              id="tab-view-invoices"
              onClick={() => {
                setActiveTab('invoices');
                setStatusFilter('ALL');
              }}
              className={`py-3 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
                activeTab === 'invoices'
                  ? 'border-emerald-600 text-slate-900 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Tax Invoices ({invoices.length})</span>
            </button>
            <button
              id="tab-view-quotes"
              onClick={() => {
                setActiveTab('quotes');
                setStatusFilter('ALL');
              }}
              className={`py-3 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
                activeTab === 'quotes'
                  ? 'border-emerald-600 text-slate-900 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Quotations ({quotes.length})</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search invoice #, customer, reg, make..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {activeTab === 'invoices' ? (
              <>
                <button
                  onClick={() => setStatusFilter('UNPAID')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    statusFilter === 'UNPAID' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  Unpaid
                </button>
                <button
                  onClick={() => setStatusFilter('PARTIALLY_PAID')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    statusFilter === 'PARTIALLY_PAID'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  Partially Paid
                </button>
                <button
                  onClick={() => setStatusFilter('PAID')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    statusFilter === 'PAID'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  Paid / Settled
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setStatusFilter('SENT')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    statusFilter === 'SENT' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                  }`}
                >
                  Sent
                </button>
                <button
                  onClick={() => setStatusFilter('ACCEPTED')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    statusFilter === 'ACCEPTED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  Accepted
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Invoices Table */}
        {activeTab === 'invoices' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Invoice # & Date</th>
                  <th className="py-3 px-4">Customer & Vehicle</th>
                  <th className="py-3 px-4 text-right">Subtotal (ex VAT)</th>
                  <th className="py-3 px-4 text-right">VAT (15%)</th>
                  <th className="py-3 px-4 text-right">Total (inc VAT)</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold text-slate-900 text-xs">{inv.invoiceNumber}</p>
                      <span className="text-[11px] text-slate-400">Date: {inv.date}</span>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{inv.customerName}</p>
                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-600 mt-0.5">
                        <span className="font-semibold">{inv.vehicleMakeModel}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-500">{inv.vehicleReg}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatZAR(inv.subtotalExVat)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatZAR(inv.vatAmount)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatZAR(inv.totalIncVat)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono">
                      {inv.balanceDue > 0 ? (
                        <span className="font-bold text-rose-600">{formatZAR(inv.balanceDue)}</span>
                      ) : (
                        <span className="font-bold text-emerald-600">R 0.00</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
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

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {inv.balanceDue > 0 && (
                          <button
                            id={`record-payment-${inv.id}`}
                            onClick={() => handleOpenPaymentModal(inv)}
                            title="Record Customer Payment"
                            className="bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Pay</span>
                          </button>
                        )}

                        <button
                          id={`send-to-customer-${inv.id}`}
                          onClick={() => handleOpenSendInvoiceModal(inv)}
                          title="Send Tax Invoice to Customer via Email (mailto:)"
                          className="bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1 shadow-2xs"
                        >
                          <Mail className="w-3 h-3 text-blue-600" />
                          <span>Send to Customer</span>
                        </button>

                        <button
                          id={`preview-pdf-${inv.id}`}
                          onClick={() => setPreviewInvoice(inv)}
                          title="Preview Print-Ready A4 Tax Invoice Modal"
                          className="bg-amber-50 hover:bg-amber-500 hover:text-slate-950 text-amber-900 border border-amber-200/90 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1 shadow-2xs"
                        >
                          <Eye className="w-3 h-3 text-amber-700" />
                          <span>Preview PDF</span>
                        </button>

                        <button
                          id={`download-pdf-${inv.id}`}
                          onClick={() => handleDownloadInvoicePDF(inv)}
                          title="Download SARS Compliant Tax Invoice PDF"
                          className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>

                        <button
                          id={`print-invoice-${inv.id}`}
                          onClick={() => {
                            setPreviewInvoice(inv);
                            setTimeout(() => {
                              window.print();
                            }, 250);
                          }}
                          title="Print A4 Tax Invoice"
                          className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print</span>
                        </button>

                        <button
                          onClick={() => onDeleteInvoice(inv.id)}
                          title="Delete Invoice"
                          className="p-1 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredInvoices.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold">No tax invoices found.</p>
                <p className="text-xs text-slate-400 mt-1">Create an invoice or convert an existing quotation.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Quotes Table */}
        {activeTab === 'quotes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Quote # & Date</th>
                  <th className="py-3 px-4">Customer & Vehicle</th>
                  <th className="py-3 px-4">Estimated Scope</th>
                  <th className="py-3 px-4 text-right">Subtotal (ex VAT)</th>
                  <th className="py-3 px-4 text-right">Total (inc 15% VAT)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map(qt => (
                  <tr key={qt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold text-slate-900 text-xs">{qt.quoteNumber}</p>
                      <span className="text-[11px] text-slate-400">Valid: {qt.expiryDate}</span>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{qt.customerName}</p>
                      <span className="text-[11px] text-slate-600 block">
                        {qt.vehicleMakeModel} ({qt.vehicleReg})
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs text-slate-600">
                      <p className="line-clamp-1">{qt.jobDescription}</p>
                      <span className="text-[10px] text-slate-400">{(qt?.items || []).length} line items</span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatZAR(qt.subtotalExVat)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatZAR(qt.totalIncVat)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          qt.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : qt.status === 'CONVERTED'
                            ? 'bg-purple-100 text-purple-800'
                            : qt.status === 'SENT'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {qt.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {qt.status !== 'CONVERTED' && (
                          <button
                            id={`convert-quote-${qt.id}`}
                            onClick={() => onConvertQuoteToInvoice(qt)}
                            title="Convert Quote to Official Tax Invoice"
                            className="bg-amber-50 hover:bg-amber-500 hover:text-slate-950 text-amber-800 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Convert to Invoice</span>
                          </button>
                        )}

                        <button
                          id={`send-quote-to-customer-${qt.id}`}
                          onClick={() => handleOpenSendQuoteModal(qt)}
                          title="Send Quotation to Customer via Email (mailto:)"
                          className="bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1 shadow-2xs"
                        >
                          <Mail className="w-3 h-3 text-blue-600" />
                          <span>Send to Customer</span>
                        </button>

                        <button
                          id={`preview-quote-pdf-${qt.id}`}
                          onClick={() => setPreviewQuote(qt)}
                          title="Preview Print-Ready A4 Quotation Modal"
                          className="bg-amber-50 hover:bg-amber-500 hover:text-slate-950 text-amber-900 border border-amber-200/90 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1 shadow-2xs"
                        >
                          <Eye className="w-3 h-3 text-amber-700" />
                          <span>Preview PDF</span>
                        </button>

                        <button
                          id={`download-quote-pdf-${qt.id}`}
                          onClick={() => handleDownloadQuotePDF(qt)}
                          title="Download Official Quotation PDF"
                          className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>

                        <button
                          id={`print-quote-${qt.id}`}
                          onClick={() => {
                            setPreviewQuote(qt);
                            setTimeout(() => {
                              window.print();
                            }, 250);
                          }}
                          title="Print A4 Quotation"
                          className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print</span>
                        </button>

                        <button
                          onClick={() => onDeleteQuote(qt.id)}
                          title="Delete Quote"
                          className="p-1 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredQuotes.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold">No quotations found.</p>
                <p className="text-xs text-slate-400 mt-1">Create a new customer quotation to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal 1: Create New Tax Invoice / Quotation Builder */}
      {(isInvoiceModalOpen || isQuoteModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {formType === 'INVOICE' ? 'Create SARS Tax Invoice' : 'Create Customer Quotation'}
                </h2>
                <p className="text-xs text-slate-500">
                  {formType === 'INVOICE'
                    ? 'Official South African VAT Tax Invoice (15% Standard Rate)'
                    : 'Formal Workshop Estimate with 14-day price guarantee'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsInvoiceModalOpen(false);
                  setIsQuoteModalOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={formType === 'INVOICE' ? handleSaveInvoiceSubmit : handleSaveQuoteSubmit}
              className="space-y-5 text-xs sm:text-sm"
            >
              {/* Document Number & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {formType === 'INVOICE' ? 'Invoice Number *' : 'Quote Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formNumber}
                    onChange={e => setFormNumber(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date Issued</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {formType === 'INVOICE' ? 'Due Date (Payment Terms)' : 'Quotation Expiry Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={e => setFormDueDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Customer Selection & Details */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Customer Information
                  </label>
                  <select
                    onChange={e => handleSelectCustomer(e.target.value)}
                    className="text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700"
                  >
                    <option value="">-- Auto-fill from Saved Customers --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formCustomerName}
                      onChange={e => setFormCustomerName(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                      placeholder="e.g. Pieter Du Plessis"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Phone Number</label>
                    <input
                      type="text"
                      value={formCustomerPhone}
                      onChange={e => setFormCustomerPhone(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                      placeholder="+27 (0)82 555 3829"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Email Address</label>
                    <input
                      type="email"
                      value={formCustomerEmail}
                      onChange={e => setFormCustomerEmail(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                      placeholder="client@email.co.za"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">SARS VAT Number</label>
                    <input
                      type="text"
                      value={formCustomerVat}
                      onChange={e => setFormCustomerVat(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                      placeholder="4980287162"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle & Job Information */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Vehicle & Job Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Registration # *</label>
                    <input
                      type="text"
                      required
                      value={formVehicleReg}
                      onChange={e => setFormVehicleReg(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono uppercase font-bold"
                      placeholder="e.g. CJ 84920"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Vehicle Make & Model *</label>
                    <input
                      type="text"
                      required
                      value={formVehicleMakeModel}
                      onChange={e => setFormVehicleMakeModel(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                      placeholder="e.g. Toyota Hilux 2.8 GD-6"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Current Odometer (km)</label>
                    <input
                      type="number"
                      value={formVehicleMileage}
                      onChange={e => setFormVehicleMileage(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                      placeholder="95000"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">VIN Number</label>
                    <input
                      type="text"
                      value={formVehicleVin}
                      onChange={e => setFormVehicleVin(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px]"
                      placeholder="AHTBB3CD4019..."
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Job Diagnosis / Summary</label>
                  <input
                    type="text"
                    value={formJobDescription}
                    onChange={e => setFormJobDescription(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="e.g. 90,000km Major Service + Front Brake Pads Replacement"
                  />
                </div>
              </div>

              {/* Line Items Editor */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Line Items (Parts & Labor)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Add inventory parts or workshop labor hours with automatic stock checks
                    </p>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => handleAddLineItem('LABOR')}
                      className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>+ Labor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddLineItem('PART')}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Part from Stock</span>
                    </button>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-2">
                  {formLineItems.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="grid grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 items-center text-xs"
                    >
                      {/* Type Pill */}
                      <div className="col-span-2 sm:col-span-1">
                        <span
                          className={`block text-center py-1 rounded text-[10px] font-bold ${
                            item.type === 'LABOR' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.type}
                        </span>
                      </div>

                      {/* Part Selector / Description */}
                      <div className="col-span-10 sm:col-span-5">
                        {item.type === 'PART' ? (
                          <select
                            value={item.partId || ''}
                            onChange={e => handleUpdateLineItem(index, 'partId', e.target.value)}
                            className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                          >
                            <option value="">-- Select from Inventory Catalog --</option>
                            {inventory.map(invItem => (
                              <option key={invItem.id} value={invItem.id}>
                                {invItem.name} ({invItem.sku}) • Stock: {invItem.stockOnHand} • {formatZAR(invItem.sellingPrice)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => handleUpdateLineItem(index, 'description', e.target.value)}
                            className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                            placeholder="Labor description..."
                          />
                        )}
                      </div>

                      {/* Qty */}
                      <div className="col-span-3 sm:col-span-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={item.quantity}
                          onChange={e => handleUpdateLineItem(index, 'quantity', Number(e.target.value))}
                          className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-xs"
                          placeholder="Qty"
                        />
                      </div>

                      {/* Unit Price ex VAT */}
                      <div className="col-span-4 sm:col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={e => handleUpdateLineItem(index, 'unitPrice', Number(e.target.value))}
                          className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-right text-xs"
                          placeholder="Price (ex VAT)"
                        />
                      </div>

                      {/* Disc % */}
                      <div className="col-span-2 sm:col-span-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPercent}
                          onChange={e => handleUpdateLineItem(index, 'discountPercent', Number(e.target.value))}
                          className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-center text-xs"
                          placeholder="Disc %"
                        />
                      </div>

                      {/* Total Ex VAT & Remove */}
                      <div className="col-span-3 sm:col-span-2 flex items-center justify-end space-x-2">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {formatZAR(item.totalExVat)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(index)}
                          className="p-1 text-slate-300 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal, 15% VAT, and Total summary */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col items-end space-y-1.5 text-xs">
                  <div className="flex justify-between w-64 text-slate-600">
                    <span>Subtotal (ex VAT):</span>
                    <span className="font-mono font-semibold">{formatZAR(subtotalExVat)}</span>
                  </div>
                  <div className="flex justify-between w-64 text-slate-600">
                    <span>SARS VAT (15%):</span>
                    <span className="font-mono font-semibold">{formatZAR(vatAmount)}</span>
                  </div>
                  <div className="flex justify-between w-64 pt-2 border-t border-slate-300 text-slate-900 font-bold text-sm">
                    <span>Total (inc VAT):</span>
                    <span className="font-mono text-amber-600 font-black">{formatZAR(totalIncVat)}</span>
                  </div>
                </div>
              </div>

              {/* Terms & Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Guarantee Terms</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsInvoiceModalOpen(false);
                    setIsQuoteModalOpen(false);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-sm"
                >
                  {formType === 'INVOICE' ? 'Save & Issue Tax Invoice' : 'Save & Issue Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Record Payment Modal */}
      {isPaymentModalOpen && selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Record Customer Payment</h2>
                <p className="text-xs text-slate-500">{selectedInvoiceForPayment.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500">Invoice Total:</span>
                  <p className="font-bold text-slate-900">{formatZAR(selectedInvoiceForPayment.totalIncVat)}</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Outstanding Balance:</span>
                  <p className="text-base font-black text-rose-600">
                    {formatZAR(selectedInvoiceForPayment.balanceDue)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Paid (ZAR) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={selectedInvoiceForPayment.balanceDue}
                  required
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-base text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EFT', 'CARD', 'CASH', 'SNAPSCAN', 'YOCO'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`p-2 rounded-xl border font-bold text-xs text-center ${
                        paymentMethod === method
                          ? 'bg-amber-500 text-slate-950 border-amber-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Reference / Slip #</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
                  placeholder="e.g. FNB-EFT-948201"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Paid at reception via speedpoint"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm"
                >
                  Confirm Payment Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Tax Invoice Preview Modal (Print-Ready A4 Document) */}
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
                  id="modal-send-invoice-btn"
                  onClick={() => handleOpenSendInvoiceModal(previewInvoice)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send to Customer</span>
                </button>
                <button
                  type="button"
                  id="modal-print-invoice-btn"
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
            <div id="printable-tax-invoice" className="printable-invoice-sheet bg-white rounded-xl p-6 sm:p-8 space-y-6 text-xs text-slate-900 border border-slate-200 print-border shadow-xs">
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

      {/* Modal 4: Quotation Preview Modal (Print-Ready A4 Document) */}
      {previewQuote && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto invoice-modal-backdrop">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto invoice-modal-container">
            {/* Modal Actions Header - Hidden in Print */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 invoice-modal-header no-print">
              <div className="flex items-center space-x-2">
                <span className="bg-teal-100 text-teal-900 font-black text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Formal Quotation Estimate
                </span>
                <h2 className="text-base font-bold text-slate-900 font-mono">
                  {previewQuote.quoteNumber}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="modal-send-quote-btn"
                  onClick={() => handleOpenSendQuoteModal(previewQuote)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send to Customer</span>
                </button>
                <button
                  type="button"
                  id="modal-print-quote-btn"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-teal-400" />
                  <span>Print A4 Quote</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadQuotePDF(previewQuote)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF Export</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewQuote(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official Rendered Quotation Paper (A4 Format) */}
            <div id="printable-quotation" className="printable-invoice-sheet bg-white rounded-xl p-6 sm:p-8 space-y-6 text-xs text-slate-900 border border-slate-200 print-border shadow-xs">
              {/* Header Section: Workshop Identity & Quotation Metadata */}
              <div className="invoice-header-section flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
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
                      <span className="font-semibold">SARS VAT Reg No:</span> {settings.vatNumber}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1.5 shrink-0">
                  <div className="inline-block bg-teal-700 text-white px-3 py-1 rounded text-sm sm:text-base font-black tracking-wider uppercase">
                    OFFICIAL QUOTATION
                  </div>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-mono font-black text-slate-950 text-sm">
                      #{previewQuote.quoteNumber}
                    </p>
                    <p className="text-slate-600"><span className="font-semibold text-slate-800">Date Issued:</span> {previewQuote.date}</p>
                    <p className="text-slate-600"><span className="font-semibold text-slate-800">Valid Until:</span> {previewQuote.expiryDate}</p>
                    <div className="pt-1">
                      <span className="inline-block font-black text-[10px] px-2.5 py-0.5 rounded uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-300">
                        Status: {previewQuote.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer & Vehicle Information Side-by-Side */}
              <div className="invoice-customer-vehicle-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="print-box bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 mb-1.5">
                    Client Details
                  </span>
                  <p className="font-bold text-sm text-slate-950">{previewQuote.customerName}</p>
                  <p className="text-slate-600">{previewQuote.customerPhone}</p>
                  <p className="text-slate-600">{previewQuote.customerEmail}</p>
                  <p className="text-slate-600">{previewQuote.customerAddress}</p>
                </div>

                <div className="print-box bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 mb-1.5">
                    Vehicle Particulars & Scope
                  </span>
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-sm text-slate-950">{previewQuote.vehicleMakeModel}</p>
                    <span className="font-mono font-black text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-900">
                      {previewQuote.vehicleReg}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-700">Odometer:</span> {previewQuote.vehicleMileage.toLocaleString()} km
                    {previewQuote.vehicleVin && ` • VIN: ${previewQuote.vehicleVin}`}
                  </p>
                  <div className="bg-white p-2 rounded border border-slate-200/80 mt-1">
                    <span className="font-bold text-[10px] text-slate-500 block uppercase">Scope of Work:</span>
                    <p className="text-slate-800 text-[11px] font-medium leading-snug">{previewQuote.jobDescription}</p>
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
                      <th className="py-2.5 px-3 text-right w-28">Total (ex VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(previewQuote.items || []).map((item, i) => (
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
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatZAR(item.totalExVat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Calculation */}
              <div className="invoice-totals-summary grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t-2 border-slate-200">
                <div className="invoice-banking-terms print-box bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <span className="font-bold text-slate-800 block text-xs uppercase tracking-wide border-b border-slate-200 pb-1">
                    Quotation Terms & Guarantee
                  </span>
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <p>&bull; Prices quoted are valid for 14 calendar days from date of issue.</p>
                    <p>&bull; Final cost may vary if additional hidden damage is discovered upon disassembly, subject to client pre-approval.</p>
                    <p>&bull; All replacement parts are brand new OEM or high-grade certified equivalents.</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Estimate Subtotal (Excl. VAT):</span>
                    <span className="font-mono font-semibold text-slate-900">{formatZAR(previewQuote.subtotalExVat)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Estimated SARS VAT @ 15.0%:</span>
                    <span className="font-mono font-semibold text-slate-900">{formatZAR(previewQuote.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-y-2 border-slate-900 print-total-highlight text-sm sm:text-base font-black text-slate-950">
                    <span>Estimated Total (Incl. 15% VAT):</span>
                    <span className="font-mono text-teal-700 font-black">{formatZAR(previewQuote.totalIncVat)}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="invoice-signatures-block grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs">
                <div className="space-y-8">
                  <div className="border-b border-slate-400 pb-1"></div>
                  <div className="text-[11px] text-slate-600">
                    <p className="font-bold text-slate-900">Workshop Estimator Signature</p>
                    <p className="text-[10px] text-slate-400">Prepared by {settings.workshopName}</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="border-b border-slate-400 pb-1"></div>
                  <div className="text-[11px] text-slate-600">
                    <p className="font-bold text-slate-900">Client Approval & Go-Ahead</p>
                    <p className="text-[10px] text-slate-400">Signature: __________________ Date: ___________</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Pre-filled Email to Customer Modal (mailto: protocol) */}
      {emailModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full">
                      {emailModalData.type === 'INVOICE' ? 'TAX INVOICE EMAIL' : 'QUOTATION EMAIL'}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {emailModalData.type === 'INVOICE'
                        ? emailModalData.invoice?.invoiceNumber
                        : emailModalData.quote?.quoteNumber}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5">
                    Send to Customer via Email
                  </h2>
                </div>
              </div>
              <button
                type="button"
                id="close-email-modal-btn"
                onClick={() => setEmailModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Context Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-slate-900">
                  {emailModalData.type === 'INVOICE'
                    ? emailModalData.invoice?.customerName
                    : emailModalData.quote?.customerName}
                </p>
                <p className="text-slate-500">
                  Vehicle:{' '}
                  <span className="font-semibold text-slate-700">
                    {emailModalData.type === 'INVOICE'
                      ? `${emailModalData.invoice?.vehicleMakeModel} (${emailModalData.invoice?.vehicleReg})`
                      : `${emailModalData.quote?.vehicleMakeModel} (${emailModalData.quote?.vehicleReg})`}
                  </span>
                </p>
              </div>
              <div className="text-right sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold block">
                  {emailModalData.type === 'INVOICE' ? 'Amount Due' : 'Quoted Total'}
                </span>
                <span className="text-sm font-black text-slate-900 font-mono">
                  {emailModalData.type === 'INVOICE'
                    ? formatZAR(emailModalData.invoice?.balanceDue ?? 0)
                    : formatZAR(emailModalData.quote?.totalIncVat ?? 0)}
                </span>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Recipient Email Address (<code className="text-slate-500">To:</code>)
                </label>
                <input
                  type="email"
                  id="email-modal-recipient-input"
                  value={emailModalData.to}
                  onChange={e => setEmailModalData({ ...emailModalData, to: e.target.value })}
                  placeholder="customer@example.co.za"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {!emailModalData.to && (
                  <p className="text-amber-600 text-[11px] mt-1 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Customer email is currently empty. Please type the recipient email above.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  id="email-modal-subject-input"
                  value={emailModalData.subject}
                  onChange={e => setEmailModalData({ ...emailModalData, subject: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-800"
                />
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  id="execute-mailto-btn"
                  onClick={handleTriggerMailto}
                  className="flex-1 min-w-[200px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Open in Email App (mailto:)</span>
                </button>

                <button
                  type="button"
                  id="copy-email-text-btn"
                  onClick={handleCopyEmailText}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 ${
                    copiedEmailFeedback
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  {copiedEmailFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Message Text</span>
                    </>
                  )}
                </button>

                {emailModalData.type === 'INVOICE' && emailModalData.invoice && (
                  <button
                    type="button"
                    id="email-modal-download-pdf-btn"
                    onClick={() => handleDownloadInvoicePDF(emailModalData.invoice!)}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center space-x-1.5 shadow-xs"
                    title="Download PDF to attach to email"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                )}

                {emailModalData.type === 'QUOTE' && emailModalData.quote && (
                  <button
                    type="button"
                    id="email-modal-download-quote-pdf-btn"
                    onClick={() => handleDownloadQuotePDF(emailModalData.quote!)}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center space-x-1.5 shadow-xs"
                    title="Download PDF to attach to email"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                )}
              </div>
            </div>

            {/* Email Body Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Pre-filled Message Preview:</span>
                <span className="text-[11px] text-slate-400">Includes SARS tax particulars & Customer Portal access</span>
              </div>
              <textarea
                id="email-modal-body-preview"
                rows={11}
                value={emailModalData.body}
                onChange={e => setEmailModalData({ ...emailModalData, body: e.target.value })}
                className="w-full p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed border border-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Portal Highlight Note */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Customer Portal Instructions Included:</span>
                <p className="text-emerald-800 mt-0.5">
                  The email instructions guide the customer to search by their vehicle registration (
                  <span className="font-mono font-bold">
                    {emailModalData.type === 'INVOICE'
                      ? emailModalData.invoice?.vehicleReg
                      : emailModalData.quote?.vehicleReg}
                  </span>
                  ) in the Client Portal to access all past service history, download PDF tax invoices, and track maintenance records.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
