import React, { useState, useEffect } from 'react';
import {
  NavigationTab,
  InventoryItem,
  Invoice,
  Quotation,
  Employee,
  PayrollRecord,
  FinancialTransaction,
  Customer,
  WorkshopSettings,
  StockMovement,
  PaymentEntry,
  AuditLogEntry,
} from './types';
import {
  loadInventory,
  saveInventory,
  loadInvoices,
  saveInvoices,
  loadQuotes,
  saveQuotes,
  loadEmployees,
  saveEmployees,
  loadPayrolls,
  savePayrolls,
  loadFinances,
  saveFinances,
  loadCustomers,
  saveCustomers,
  loadSettings,
  saveSettings,
  loadStockMovements,
  saveStockMovements,
} from './utils/storage';
import {
  loadAuditLogs,
  appendAuditLog,
  initializeHistoricalAuditTrailIfEmpty,
  diffInvoices,
  diffFinancialTransactions,
} from './utils/auditLogger';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { InventoryModule } from './components/InventoryModule';
import { QuotesAndInvoicesModule } from './components/QuotesAndInvoicesModule';
import { PayrollModule } from './components/PayrollModule';
import { FinancesModule } from './components/FinancesModule';
import { SarsTaxModule } from './components/SarsTaxModule';
import { ClientPortalModule } from './components/ClientPortalModule';
import { SettingsModule } from './components/SettingsModule';
import { Plus, FileSpreadsheet, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');

  // Core Application State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [finances, setFinances] = useState<FinancialTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<WorkshopSettings>(loadSettings());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Quick Action Modals Trigger Flag
  const [triggerInvoiceModal, setTriggerInvoiceModal] = useState(false);
  const [triggerQuoteModal, setTriggerQuoteModal] = useState(false);

  // Initialize data on mount
  useEffect(() => {
    const loadedInventory = loadInventory();
    const loadedMovements = loadStockMovements();
    const loadedInvoices = loadInvoices();
    const loadedQuotes = loadQuotes();
    const loadedEmployees = loadEmployees();
    const loadedPayrolls = loadPayrolls();
    const loadedFinances = loadFinances();
    const loadedCustomers = loadCustomers();
    const loadedSettings = loadSettings();

    setInventory(loadedInventory);
    setStockMovements(loadedMovements);
    setInvoices(loadedInvoices);
    setQuotes(loadedQuotes);
    setEmployees(loadedEmployees);
    setPayrolls(loadedPayrolls);
    setFinances(loadedFinances);
    setCustomers(loadedCustomers);
    setSettings(loadedSettings);

    // Load or initialize cryptographic SARS audit trail
    let logs = loadAuditLogs();
    if (logs.length === 0) {
      logs = initializeHistoricalAuditTrailIfEmpty(loadedInvoices, loadedFinances, loadedPayrolls);
    }
    setAuditLogs(logs);

    setIsLoaded(true);
  }, []);

  // Sync helpers
  const handleSaveInventory = (updated: InventoryItem[]) => {
    setInventory(updated);
    saveInventory(updated);
  };

  const handleSaveStockMovement = (movement: StockMovement) => {
    const updatedMovements = [movement, ...stockMovements];
    setStockMovements(updatedMovements);
    saveStockMovements(updatedMovements);

    // Update inventory item stock count
    const updatedInventory = inventory.map(item => {
      if (item.id === movement.itemId) {
        return { ...item, stockOnHand: movement.newStockOnHand };
      }
      return item;
    });
    handleSaveInventory(updatedInventory);
  };

  const handleSaveInvoice = (invoice: Invoice) => {
    const existingIndex = invoices.findIndex(i => i.id === invoice.id);
    let updatedInvoices: Invoice[];
    
    if (existingIndex >= 0) {
      const oldInvoice = invoices[existingIndex];
      const diff = diffInvoices(oldInvoice, invoice);
      updatedInvoices = [...invoices];
      updatedInvoices[existingIndex] = invoice;

      // SARS Section 29 Audit Log: Invoice Amendment
      const updatedLogs = appendAuditLog({
        actionType: 'INVOICE_MODIFIED',
        entityType: 'INVOICE',
        entityId: invoice.id,
        entityNumber: invoice.invoiceNumber,
        taxPeriod: invoice.date.slice(0, 7),
        narrative: `Tax Invoice ${invoice.invoiceNumber} amended for ${invoice.customerName}. Subtotal: R ${invoice.subtotalExVat}, Total: R ${invoice.totalIncVat} (VAT: R ${invoice.vatAmount}).`,
        changes: diff,
        previousPayload: oldInvoice,
        newPayload: invoice,
      });
      setAuditLogs(updatedLogs);
    } else {
      updatedInvoices = [invoice, ...invoices];

      // Auto-deduct inventory if parts were consumed on this new invoice
      let updatedInv = [...inventory];
      const newMovements: StockMovement[] = [];

      invoice.items.forEach(line => {
        if (line.type === 'PART' && line.partId) {
          const partIndex = updatedInv.findIndex(p => p.id === line.partId);
          if (partIndex >= 0) {
            const currentPart = updatedInv[partIndex];
            const newStock = Math.max(0, currentPart.stockOnHand - line.quantity);
            updatedInv[partIndex] = { ...currentPart, stockOnHand: newStock };

            newMovements.push({
              id: `MOV-${Date.now()}-${Math.random().toString().slice(-4)}`,
              itemId: currentPart.id,
              partName: currentPart.name,
              sku: currentPart.sku,
              type: 'INVOICE_SALE',
              quantity: -line.quantity,
              previousStockOnHand: currentPart.stockOnHand,
              newStockOnHand: newStock,
              referenceNo: invoice.invoiceNumber,
              date: invoice.date,
              notes: `Fitted to ${invoice.vehicleMakeModel} (${invoice.vehicleReg})`,
            });
          }
        }
      });

      if (newMovements.length > 0) {
        handleSaveInventory(updatedInv);
        const allMovements = [...newMovements, ...stockMovements];
        setStockMovements(allMovements);
        saveStockMovements(allMovements);
      }

      // SARS Section 29 Audit Log: New Invoice Created
      const updatedLogs = appendAuditLog({
        actionType: 'INVOICE_CREATED',
        entityType: 'INVOICE',
        entityId: invoice.id,
        entityNumber: invoice.invoiceNumber,
        taxPeriod: invoice.date.slice(0, 7),
        narrative: `Original Tax Invoice ${invoice.invoiceNumber} created for customer ${invoice.customerName} (${invoice.vehicleMakeModel} - ${invoice.vehicleReg}). Total: R ${invoice.totalIncVat} (VAT: R ${invoice.vatAmount}).`,
        changes: [],
        newPayload: invoice,
      });
      setAuditLogs(updatedLogs);
    }

    setInvoices(updatedInvoices);
    saveInvoices(updatedInvoices);
  };

  const handleDeleteInvoice = (id: string) => {
    const target = invoices.find(i => i.id === id);
    if (target) {
      // SARS Section 29 Audit Log: Invoice Voided / Archived
      const updatedLogs = appendAuditLog({
        actionType: 'INVOICE_VOIDED',
        entityType: 'INVOICE',
        entityId: target.id,
        entityNumber: target.invoiceNumber,
        taxPeriod: target.date.slice(0, 7),
        narrative: `Tax Invoice ${target.invoiceNumber} (Total: R ${target.totalIncVat}, VAT: R ${target.vatAmount}) for customer ${target.customerName} marked voided/deleted from workshop register.`,
        previousPayload: target,
      });
      setAuditLogs(updatedLogs);
    }

    const updated = invoices.filter(i => i.id !== id);
    setInvoices(updated);
    saveInvoices(updated);
  };

  const handleSaveQuote = (quote: Quotation) => {
    const existingIndex = quotes.findIndex(q => q.id === quote.id);
    let updatedQuotes: Quotation[];
    if (existingIndex >= 0) {
      updatedQuotes = [...quotes];
      updatedQuotes[existingIndex] = quote;
    } else {
      updatedQuotes = [quote, ...quotes];
    }
    setQuotes(updatedQuotes);
    saveQuotes(updatedQuotes);
  };

  const handleDeleteQuote = (id: string) => {
    const updated = quotes.filter(q => q.id !== id);
    setQuotes(updated);
    saveQuotes(updated);
  };

  const handleRecordPayment = (invoiceId: string, payment: PaymentEntry) => {
    const invoiceIndex = invoices.findIndex(i => i.id === invoiceId);
    if (invoiceIndex < 0) return;

    const inv = invoices[invoiceIndex];
    const newPayments = [...(inv.payments || []), payment];
    const newAmountPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);
    const newBalance = Math.max(0, inv.totalIncVat - newAmountPaid);
    const newStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

    const updatedInvoice: Invoice = {
      ...inv,
      payments: newPayments,
      amountPaid: newAmountPaid,
      balanceDue: newBalance,
      status: newStatus,
    };

    const updatedInvoices = [...invoices];
    updatedInvoices[invoiceIndex] = updatedInvoice;
    setInvoices(updatedInvoices);
    saveInvoices(updatedInvoices);

    // Auto record in Financials Ledger as Income
    const newIncomeTxn: FinancialTransaction = {
      id: `TXN-PAY-${Date.now().toString().slice(-4)}`,
      date: payment.date,
      type: 'INCOME',
      category: 'Workshop Labor',
      amountExVat: Math.round((payment.amount / 1.15) * 100) / 100,
      vatAmount: Math.round((payment.amount - payment.amount / 1.15) * 100) / 100,
      amountIncVat: payment.amount,
      isVatClaimable: false,
      description: `Customer payment received: ${inv.customerName} (${inv.invoiceNumber})`,
      referenceNo: payment.reference,
      paymentMethod: payment.method as any,
      taxDeductible: false,
    };

    const updatedFinances = [newIncomeTxn, ...finances];
    setFinances(updatedFinances);
    saveFinances(updatedFinances);

    // SARS Section 29 Audit Log: Payment Recorded
    const updatedLogs = appendAuditLog({
      actionType: 'INVOICE_PAYMENT_RECORDED',
      entityType: 'INVOICE',
      entityId: inv.id,
      entityNumber: inv.invoiceNumber,
      taxPeriod: payment.date.slice(0, 7),
      narrative: `Customer payment of R ${payment.amount.toLocaleString()} settled on Tax Invoice ${inv.invoiceNumber} via ${payment.method} (Ref: ${payment.reference || 'N/A'}). Remaining balance: R ${newBalance.toLocaleString()}.`,
      changes: [
        {
          fieldName: 'amountPaid',
          fieldLabel: 'Total Paid',
          previousValue: inv.amountPaid || 0,
          newValue: newAmountPaid,
          isFinancialAmount: true,
        },
        {
          fieldName: 'balanceDue',
          fieldLabel: 'Balance Due',
          previousValue: inv.balanceDue,
          newValue: newBalance,
          isFinancialAmount: true,
        },
        {
          fieldName: 'status',
          fieldLabel: 'Invoice Status',
          previousValue: inv.status,
          newValue: newStatus,
          isFinancialAmount: false,
        },
      ],
      previousPayload: inv,
      newPayload: updatedInvoice,
    });
    setAuditLogs(updatedLogs);
  };

  const handleConvertQuoteToInvoice = (quote: Quotation) => {
    const newInvoiceNumber = `${settings.invoicePrefix}-${new Date().getFullYear()}-${(invoices.length + 84).toString().padStart(4, '0')}`;
    const newInvoice: Invoice = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      invoiceNumber: newInvoiceNumber,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      customerId: quote.customerId,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      customerEmail: quote.customerEmail,
      customerAddress: quote.customerAddress,
      customerVatNumber: quote.customerVatNumber,
      vehicleReg: quote.vehicleReg,
      vehicleMakeModel: quote.vehicleMakeModel,
      vehicleMileage: quote.vehicleMileage,
      vehicleVin: quote.vehicleVin,
      jobDescription: quote.jobDescription,
      items: quote.items,
      subtotalExVat: quote.subtotalExVat,
      vatRate: quote.vatRate,
      vatAmount: quote.vatAmount,
      totalIncVat: quote.totalIncVat,
      amountPaid: 0,
      balanceDue: quote.totalIncVat,
      status: 'UNPAID',
      payments: [],
      notes: quote.notes,
      createdAt: new Date().toISOString(),
    };

    handleSaveInvoice(newInvoice);

    // Update Quote status to CONVERTED
    const updatedQuotes = quotes.map(q => (q.id === quote.id ? { ...q, status: 'CONVERTED' as const } : q));
    setQuotes(updatedQuotes);
    saveQuotes(updatedQuotes);

    // Switch to invoices view
    setActiveTab('quotes_invoices');
  };

  const handleSaveEmployee = (emp: Employee) => {
    const existingIndex = employees.findIndex(e => e.id === emp.id);
    let updated: Employee[];
    if (existingIndex >= 0) {
      updated = [...employees];
      updated[existingIndex] = emp;
    } else {
      updated = [...employees, emp];
    }
    setEmployees(updated);
    saveEmployees(updated);
  };

  const handleRunMonthlyPayroll = (records: PayrollRecord[]) => {
    const existingFiltered = payrolls.filter(p => !records.some(r => r.id === p.id || (r.employeeId === p.employeeId && r.monthYear === p.monthYear)));
    const updatedPayrolls = [...records, ...existingFiltered];
    setPayrolls(updatedPayrolls);
    savePayrolls(updatedPayrolls);

    // Auto-record salary expenses in Financial Ledger
    const salaryExpenseTxns: FinancialTransaction[] = records.map(rec => ({
      id: `TXN-SAL-${rec.id}`,
      date: rec.paymentDate,
      type: 'EXPENSE',
      category: 'Salaries & Wages',
      amountExVat: rec.grossIncome,
      vatAmount: 0,
      amountIncVat: rec.grossIncome,
      isVatClaimable: false,
      description: `Monthly salary & wages: ${rec.employeeName} (${rec.monthYear})`,
      referenceNo: `PAYROLL-${rec.monthYear}-${rec.employeeNumber}`,
      paymentMethod: 'EFT',
      taxDeductible: true,
    }));

    const updatedFinances = [...salaryExpenseTxns, ...finances];
    setFinances(updatedFinances);
    saveFinances(updatedFinances);

    // SARS Section 29 Audit Log: Payroll Execution
    records.forEach(rec => {
      const updatedLogs = appendAuditLog({
        actionType: 'PAYROLL_EXECUTED',
        entityType: 'PAYROLL_RECORD',
        entityId: rec.id,
        entityNumber: `EMP201-${rec.monthYear}-${rec.employeeNumber}`,
        taxPeriod: rec.monthYear,
        narrative: `Monthly statutory payroll calculated & executed for ${rec.employeeName}. Gross: R ${rec.grossIncome.toLocaleString()}, PAYE Tax: R ${rec.sarsPayeMonthly.toLocaleString()}, Employee UIF: R ${rec.uifEmployee.toLocaleString()}, Employer UIF: R ${rec.uifEmployer.toLocaleString()}, SDL: R ${rec.sdlEmployer.toLocaleString()}, Net Pay: R ${rec.netPay.toLocaleString()}.`,
        changes: [],
        newPayload: rec,
      });
      setAuditLogs(updatedLogs);
    });
  };

  const handleSaveFinancialTransaction = (txn: FinancialTransaction) => {
    const existingIndex = finances.findIndex(f => f.id === txn.id);
    let updated: FinancialTransaction[];
    
    if (existingIndex >= 0) {
      const oldTxn = finances[existingIndex];
      const diff = diffFinancialTransactions(oldTxn, txn);
      updated = [...finances];
      updated[existingIndex] = txn;

      const updatedLogs = appendAuditLog({
        actionType: 'FINANCIAL_ENTRY_MODIFIED',
        entityType: 'FINANCIAL_TRANSACTION',
        entityId: txn.id,
        entityNumber: txn.referenceNo || txn.id,
        taxPeriod: txn.date.slice(0, 7),
        narrative: `Financial ledger record #${txn.referenceNo || txn.id} (${txn.type} - ${txn.category}) amended. Amount: R ${txn.amountIncVat} (VAT: R ${txn.vatAmount}).`,
        changes: diff,
        previousPayload: oldTxn,
        newPayload: txn,
      });
      setAuditLogs(updatedLogs);
    } else {
      updated = [txn, ...finances];

      const updatedLogs = appendAuditLog({
        actionType: 'FINANCIAL_ENTRY_CREATED',
        entityType: 'FINANCIAL_TRANSACTION',
        entityId: txn.id,
        entityNumber: txn.referenceNo || txn.id,
        taxPeriod: txn.date.slice(0, 7),
        narrative: `Financial ledger transaction recorded: ${txn.type} (${txn.category}) - ${txn.description}. Ex-VAT: R ${txn.amountExVat}, VAT: R ${txn.vatAmount}, Total: R ${txn.amountIncVat} (VAT Claimable: ${txn.isVatClaimable ? 'YES' : 'NO'}).`,
        changes: [],
        newPayload: txn,
      });
      setAuditLogs(updatedLogs);
    }

    setFinances(updated);
    saveFinances(updated);
  };

  const handleDeleteFinancialTransaction = (id: string) => {
    const target = finances.find(f => f.id === id);
    if (target) {
      const updatedLogs = appendAuditLog({
        actionType: 'FINANCIAL_ENTRY_DELETED',
        entityType: 'FINANCIAL_TRANSACTION',
        entityId: target.id,
        entityNumber: target.referenceNo || target.id,
        taxPeriod: target.date.slice(0, 7),
        narrative: `Financial transaction #${target.referenceNo || target.id} (R ${target.amountIncVat} ${target.category}) removed from active financial ledger.`,
        previousPayload: target,
      });
      setAuditLogs(updatedLogs);
    }

    const updated = finances.filter(f => f.id !== id);
    setFinances(updated);
    saveFinances(updated);
  };

  const handleSaveCustomer = (cust: Customer) => {
    const existingIndex = customers.findIndex(c => c.id === cust.id);
    let updated: Customer[];
    if (existingIndex >= 0) {
      updated = [...customers];
      updated[existingIndex] = cust;
    } else {
      updated = [cust, ...customers];
    }
    setCustomers(updated);
    saveCustomers(updated);
  };

  const handleSaveSettings = (newSettings: WorkshopSettings) => {
    const updatedLogs = appendAuditLog({
      actionType: 'TAX_CONFIG_CHANGED',
      entityType: 'TAX_CONFIG',
      entityId: 'SETTINGS_GLOBAL',
      entityNumber: newSettings.registrationNumber,
      taxPeriod: new Date().toISOString().slice(0, 7),
      narrative: `Workshop tax and statutory profile updated: ${newSettings.workshopName} (VAT: ${newSettings.vatNumber}, PAYE: ${newSettings.sarsPayeNumber}, Small Business Corp: ${newSettings.sbcTaxRegime ? 'YES' : 'NO'}).`,
      previousPayload: settings,
      newPayload: newSettings,
    });
    setAuditLogs(updatedLogs);

    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleResetData = () => {
    setInventory(loadInventory());
    setStockMovements(loadStockMovements());
    setInvoices(loadInvoices());
    setQuotes(loadQuotes());
    setEmployees(loadEmployees());
    setPayrolls(loadPayrolls());
    setFinances(loadFinances());
    setCustomers(loadCustomers());
    setSettings(loadSettings());
    const refreshedLogs = loadAuditLogs();
    setAuditLogs(refreshedLogs);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-emerald-400 font-bold">
        Loading JC's Workshop ZA System...
      </div>
    );
  }

  // Count active low stock alerts for notification badges
  const lowStockCount = inventory.filter(i => i.stockOnHand <= i.minStockLevel).length;
  const unpaidInvoicesCount = invoices.filter(i => i.status === 'UNPAID' || i.status === 'OVERDUE').length;

  const viewTitles: Record<NavigationTab, string> = {
    dashboard: 'Operational Overview',
    inventory: 'Inventory & Stock Management',
    payroll: 'Payroll & SARS PAYE/UIF',
    finances: 'Financial Reports & Ledger',
    quotes_invoices: 'Tax Invoices & Quotations',
    sars_tax: 'SARS Tax Compliance Center',
    client_portal: 'Client Accounts & Vehicle History',
    settings: 'Workshop Configuration & Settings',
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-600 selection:text-white">
      {/* Sidebar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
        unpaidInvoicesCount={unpaidInvoicesCount}
        settings={settings}
        onQuickNewInvoice={() => {
          setActiveTab('quotes_invoices');
          setTriggerInvoiceModal(true);
        }}
        onQuickNewQuote={() => {
          setActiveTab('quotes_invoices');
          setTriggerQuoteModal(true);
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-8 shrink-0 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-slate-800">
              {viewTitles[activeTab] || 'Operational Overview'}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            <button
              id="topbar-new-invoice-btn"
              onClick={() => {
                setActiveTab('quotes_invoices');
                setTriggerInvoiceModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Invoice</span>
            </button>

            <button
              id="topbar-new-quote-btn"
              onClick={() => {
                setActiveTab('quotes_invoices');
                setTriggerQuoteModal(true);
              }}
              className="hidden sm:flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded text-sm font-medium border border-slate-200 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Quote</span>
            </button>

            {/* JC User Avatar */}
            <div
              title={`${settings.workshopName} - Manager JC`}
              className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 cursor-default select-none ml-1"
            >
              JC
            </div>
          </div>
        </header>

        {/* Main Content View Container */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              inventory={inventory}
              invoices={invoices}
              quotes={quotes}
              employees={employees}
              payrolls={payrolls}
              finances={finances}
              customers={customers}
              settings={settings}
              onNavigate={setActiveTab}
              onOpenInvoiceModal={() => {
                setActiveTab('quotes_invoices');
                setTriggerInvoiceModal(true);
              }}
              onOpenQuoteModal={() => {
                setActiveTab('quotes_invoices');
                setTriggerQuoteModal(true);
              }}
              onOpenStockModal={() => setActiveTab('inventory')}
              onSaveFinancialTransaction={handleSaveFinancialTransaction}
              onDeleteFinancialTransaction={handleDeleteFinancialTransaction}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryModule
              inventory={inventory}
              stockMovements={stockMovements}
              onUpdateInventory={handleSaveInventory}
              onRecordStockMovement={handleSaveStockMovement}
            />
          )}

          {activeTab === 'quotes_invoices' && (
            <QuotesAndInvoicesModule
              invoices={invoices}
              quotes={quotes}
              customers={customers}
              inventory={inventory}
              settings={settings}
              onSaveInvoice={handleSaveInvoice}
              onSaveQuote={handleSaveQuote}
              onDeleteInvoice={handleDeleteInvoice}
              onDeleteQuote={handleDeleteQuote}
              onRecordPayment={handleRecordPayment}
              onConvertQuoteToInvoice={handleConvertQuoteToInvoice}
              triggerNewInvoice={triggerInvoiceModal}
              onResetTriggerInvoice={() => setTriggerInvoiceModal(false)}
              triggerNewQuote={triggerQuoteModal}
              onResetTriggerQuote={() => setTriggerQuoteModal(false)}
            />
          )}

          {activeTab === 'payroll' && (
            <PayrollModule
              employees={employees}
              payrolls={payrolls}
              settings={settings}
              onSaveEmployee={handleSaveEmployee}
              onRunMonthlyPayroll={handleRunMonthlyPayroll}
            />
          )}

          {activeTab === 'finances' && (
            <FinancesModule
              finances={finances}
              settings={settings}
              onSaveTransaction={handleSaveFinancialTransaction}
              onDeleteTransaction={handleDeleteFinancialTransaction}
            />
          )}

          {activeTab === 'sars_tax' && (
            <SarsTaxModule
              invoices={invoices}
              finances={finances}
              payrolls={payrolls}
              auditLogs={auditLogs}
              settings={settings}
            />
          )}

          {activeTab === 'client_portal' && (
            <ClientPortalModule
              customers={customers}
              invoices={invoices}
              quotes={quotes}
              settings={settings}
              onSaveCustomer={handleSaveCustomer}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsModule
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onResetData={handleResetData}
            />
          )}
        </main>

        {/* Professional Footer */}
        <footer className="bg-white text-slate-500 border-t border-slate-200 text-xs py-4 px-6 sm:px-8 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-800">JC's Workshop ZA</span>
              <span>•</span>
              <span>SARS Compliance Suite (15% VAT, PAYE, UIF, SDL, SBC)</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              VAT: {settings.vatNumber} | PAYE: {settings.sarsPayeNumber}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
