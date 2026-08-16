export type ViewMode =
  | 'dashboard'
  | 'inventory'
  | 'quotes_invoices'
  | 'payroll'
  | 'finances'
  | 'client_portal'
  | 'sars_tax'
  | 'settings';

export type NavigationTab = ViewMode;

export interface Vehicle {
  id?: string;
  regNumber: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  mileage?: number;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Brakes' | 'Engine & Filters' | 'Suspension & Steering' | 'Electrical & Lighting' | 'Fluids & Lubricants' | 'Exhaust & Cooling' | 'Tools & Consumables' | 'General Spares';
  description: string;
  stockOnHand: number;
  minStockLevel: number; // Reorder alert threshold
  costPrice: number; // ZAR excluding VAT or including depending on preference
  sellingPrice: number; // ZAR excluding VAT
  supplier: string;
  binLocation: string; // e.g. Shelf A-03
  unit: string; // e.g. each, litre, set, pair
  lastRestocked: string;
  compatibleVehicles?: string;
  oemNumber?: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemName?: string;
  partName?: string;
  sku: string;
  type: 'RECEIVE' | 'JOB_USE' | 'ADJUSTMENT' | 'WRITE_OFF' | 'RETURN' | 'INVOICE_SALE';
  quantity: number; // positive or negative
  unitCost?: number;
  previousStockOnHand?: number;
  newStockOnHand?: number;
  reason?: string;
  date: string;
  referenceNo?: string; // invoice or supplier PO
  notes?: string;
  recordedBy?: string;
}

export type StockTransaction = StockMovement;

export interface Employee {
  id: string;
  employeeNumber: string;
  fullName: string;
  idNumber: string; // South African 13-digit ID or Passport
  taxNumber: string; // SARS Income Tax Reference Number
  position: 'Senior Master Technician' | 'Diagnostic Specialist' | 'Auto Electrician' | 'Service Mechanic' | 'Apprentice / Assistant' | 'Workshop Manager' | 'Admin & Accounts';
  email: string;
  phone: string;
  hireDate: string;
  basicSalary: number; // Monthly gross in ZAR
  standardHoursPerWeek: number;
  age: number; // For SARS tax threshold rebate (Under 65, 65-74, 75+)
  medicalAidMembers: number; // Main member + dependents for medical tax credits
  bankName: string;
  accountNumber: string;
  branchCode: string;
  accountType: 'Cheque/Current' | 'Savings' | 'Transmission';
  isActive: boolean;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  idNumber: string;
  taxNumber: string;
  position: string;
  monthYear: string; // YYYY-MM e.g. "2026-08"
  
  // Earnings
  basicSalary: number;
  overtimeHours: number;
  overtimeRatePerHour: number;
  overtimePay: number;
  bonus: number;
  allowances: number;
  grossIncome: number;
  
  // SARS Statutory Deductions
  taxableIncome: number;
  annualizedIncome: number;
  grossAnnualTax: number;
  primaryRebate: number;
  secondaryRebate: number;
  tertiaryRebate: number;
  medicalTaxCreditsAnnual: number;
  netAnnualTax: number;
  sarsPayeMonthly: number;
  
  uifEmployee: number; // 1% capped at R177.12
  uifEmployer: number; // 1% capped at R177.12
  sdlEmployer: number; // 1% of gross for SDL levy
  
  otherDeductions: number; // Staff loans, uniform, etc.
  totalEmployeeDeductions: number;
  netPay: number;
  
  totalEmployerCost: number; // Gross + UIF Employer + SDL
  
  paymentStatus: 'PENDING' | 'PAID';
  paymentDate?: string;
  paymentMethod: 'EFT' | 'Cash';
  notes?: string;
  generatedAt: string;
}

export interface LineItem {
  id: string;
  type: 'PART' | 'LABOR' | 'DIAGNOSTIC' | 'OUTSOURCED';
  partId?: string; // Linked inventory item
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: number; // ZAR ex VAT
  discountPercent: number;
  totalExVat: number;
}

export interface PaymentEntry {
  id: string;
  date: string;
  amount: number;
  method: 'EFT' | 'CARD' | 'CASH' | 'SNAPSCAN' | 'YOCO';
  reference: string;
  notes?: string;
}

export interface Quotation {
  id: string;
  quoteNumber: string; // e.g. QT-2026-0104
  date: string;
  expiryDate: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerVatNumber?: string;
  
  vehicleReg: string;
  vehicleMakeModel: string;
  vehicleMileage: number;
  vehicleVin?: string;
  jobDescription: string;
  
  items: LineItem[];
  subtotalExVat: number;
  vatRate: number; // 0.15
  vatAmount: number;
  totalIncVat: number;
  
  notes?: string;
  termsAndConditions?: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'CONVERTED';
  convertedInvoiceId?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-0089 (SARS compliant sequential numbering)
  quoteId?: string;
  date: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerVatNumber?: string;
  
  vehicleReg: string;
  vehicleMakeModel: string;
  vehicleMileage: number;
  vehicleVin?: string;
  jobDescription: string;
  
  items: LineItem[];
  subtotalExVat: number;
  vatRate: number; // 0.15
  vatAmount: number;
  totalIncVat: number;
  
  amountPaid: number;
  balanceDue: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  payments: PaymentEntry[];
  
  notes?: string;
  bankDetailsOverride?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  phone: string;
  address: string;
  vatNumber?: string;
  vehicles: {
    regNumber: string;
    make: string;
    model: string;
    year: number;
    vin?: string;
    mileage?: number;
  }[];
  totalSpend: number;
  outstandingBalance: number;
  createdAt: string;
}

export type FinancialCategory =
  | 'Workshop Labor'
  | 'Parts & Spares Sales'
  | 'Diagnostic & Testing'
  | 'Supplier Parts Purchases'
  | 'Salaries & Wages'
  | 'SARS PAYE / UIF / SDL'
  | 'SARS VAT Payments'
  | 'Rent & Property Rates'
  | 'Electricity & Utilities (Eskom/Municipal)'
  | 'Workshop Consumables & Tools'
  | 'Equipment Lease & Maintenance'
  | 'Fuel & Vehicle Running Costs'
  | 'Insurance (Workshop & Public Liability)'
  | 'Telephone & Internet'
  | 'Software & Subscriptions'
  | 'Banking & Card Machine Fees'
  | 'Accounting & Legal'
  | 'Marketing & Advertising'
  | 'Waste Disposal & Oil Recycling'
  | 'Miscellaneous Expense';

export interface FinancialTransaction {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  category: FinancialCategory;
  amountExVat: number;
  vatAmount: number; // 15% input or output
  amountIncVat: number;
  isVatClaimable: boolean; // SARS VAT rule for input claims
  description: string;
  referenceNo: string; // Invoice number, slip number, supplier reference
  paymentMethod: 'EFT' | 'CARD' | 'CASH' | 'DEBIT_ORDER';
  relatedInvoiceId?: string;
  relatedPayrollId?: string;
  taxDeductible: boolean;
}

export interface WorkshopSettings {
  workshopName: string;
  tradingName: string;
  registrationNumber: string; // CIPC reg e.g. 2019/123456/07
  vatNumber: string; // SARS VAT 10-digit number e.g. 4980287162
  sarsPayeNumber: string; // e.g. 7980287162
  uifNumber: string; // e.g. U12345678
  phone: string;
  email: string;
  physicalAddress: string;
  postalCode: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string;
  branchName: string;
  branchCode: string;
  invoicePrefix: string;
  quotePrefix: string;
  defaultLaborRateExVat: number; // e.g. R550.00 / hour
  vatRate: number; // 0.15
  sbcTaxRegime: boolean; // Small Business Corporation tax status
  currency: string; // ZAR (R)
}

export interface SarsVat201Summary {
  periodMonth: string; // e.g. "2026-08" (or bi-monthly e.g. "Jul/Aug 2026")
  
  // Output Tax (Box 1, 1A, 4)
  standardRatedSuppliesExVat: number; // Box 1
  outputTaxOnSales: number; // Box 4 (15%)
  otherOutputAdjustments: number;
  totalOutputTax: number;
  
  // Input Tax (Box 14, 15, 19)
  capitalGoodsExVat: number; // Box 14
  capitalGoodsInputTax: number;
  otherGoodsServicesExVat: number; // Box 15 (Stock purchases, tools, rent, utilities)
  otherGoodsServicesInputTax: number; // Box 15 tax
  totalInputTax: number; // Box 19
  
  // Net VAT (Box 20)
  netVatPayableOrRefund: number; // Positive = Payable to SARS, Negative = Refund due
  dueDate: string; // 25th of month (manual) or last business day of month (eFiling)
}

export interface SarsEmp201Summary {
  periodMonth: string;
  totalGrossRemuneration: number;
  totalPayeWithheld: number;
  totalUifRemuneration: number;
  totalUifContribution: number; // 2% (1% employee + 1% employer)
  totalSdlRemuneration: number;
  totalSdlLevy: number; // 1% employer
  totalEmp201Payable: number;
  dueDate: string; // 7th of following month
}

export interface SarsIncomeTaxEstimate {
  taxYear: string; // e.g. "2026/2027"
  totalRevenueExVat: number;
  costOfSales: number; // Parts and direct materials
  grossProfit: number;
  operatingExpenses: number; // Rent, salaries, utilities, consumables
  taxableNetProfit: number;
  
  // Corporate Standard (27%) vs SBC (Small Business Corporation)
  corporateTaxAt27: number;
  sbcTaxAmount: number;
  sbcTaxSavings: number;
  
  provisionalPeriod1Estimate: number; // Due end of Aug
  provisionalPeriod2Estimate: number; // Due end of Feb
}

export type AuditActionType =
  | 'INVOICE_CREATED'
  | 'INVOICE_MODIFIED'
  | 'INVOICE_PAYMENT_RECORDED'
  | 'INVOICE_STATUS_CHANGED'
  | 'INVOICE_VOIDED'
  | 'FINANCIAL_ENTRY_CREATED'
  | 'FINANCIAL_ENTRY_MODIFIED'
  | 'FINANCIAL_ENTRY_DELETED'
  | 'PAYROLL_EXECUTED'
  | 'TAX_CONFIG_CHANGED';

export type AuditEntityType = 'INVOICE' | 'FINANCIAL_TRANSACTION' | 'PAYROLL_RECORD' | 'TAX_CONFIG';

export interface AuditFieldChange {
  fieldName: string;
  fieldLabel: string;
  previousValue: string | number | boolean | null | undefined;
  newValue: string | number | boolean | null | undefined;
  isFinancialAmount?: boolean;
}

export interface AuditActor {
  userId: string;
  userName: string;
  userRole: 'Workshop Admin' | 'Billing Clerk' | 'Tax Practitioner' | 'System Auditor';
  ipAddress?: string;
}

export interface AuditLogEntry {
  id: string; // e.g. "AUD-2026-0001"
  sequenceNumber: number; // Monotonically increasing counter for chain verification
  timestamp: string; // ISO 8601 string e.g. "2026-08-15T14:10:05.120Z"
  taxPeriod: string; // e.g. "2026-08"
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  entityNumber: string; // e.g. "JCW-INV-2026-0089" or "TXN-PAY-1002"
  actor: AuditActor;
  narrative: string;
  changes?: AuditFieldChange[];
  previousHash: string; // Cryptographic chained hash of previous entry
  recordHash: string; // Cryptographic hash of this entry
  complianceStandard: 'SARS_TAA_SEC29_SEC30'; // South African Tax Administration Act standard
  metadata?: Record<string, any>;
}
