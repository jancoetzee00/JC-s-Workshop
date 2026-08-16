import {
  WorkshopSettings,
  InventoryItem,
  StockTransaction,
  Employee,
  Customer,
  Quotation,
  Invoice,
  FinancialTransaction,
} from '../types';

export const initialSettings: WorkshopSettings = {
  workshopName: "JC's Workshop ZA",
  tradingName: "JC's Auto & Mechanical Engineering (Pty) Ltd",
  registrationNumber: '2019/384721/07',
  vatNumber: '4980287162',
  sarsPayeNumber: '7980287162',
  uifNumber: 'U84920192',
  phone: '+27 (0)21 948 5520',
  email: 'service@jcworkshop.co.za',
  physicalAddress: '14 Voortrekker Road, Bellville, Cape Town',
  postalCode: '7530',
  bankName: 'First National Bank (FNB)',
  accountHolder: "JC's Auto & Mechanical (Pty) Ltd",
  accountNumber: '62849102948',
  accountType: 'Business Cheque Account',
  branchName: 'Bellville Main Branch',
  branchCode: '250655',
  invoicePrefix: 'JCW-INV',
  quotePrefix: 'JCW-QT',
  defaultLaborRateExVat: 550, // R550 / hour
  vatRate: 0.15,
  sbcTaxRegime: true,
  currency: 'ZAR',
};

// Clean zero-base initial datasets (no mockups)
export const initialInventory: InventoryItem[] = [];
export const initialStockTransactions: StockTransaction[] = [];
export const initialEmployees: Employee[] = [];
export const initialCustomers: Customer[] = [];
export const initialQuotations: Quotation[] = [];
export const initialInvoices: Invoice[] = [];
export const initialFinancialTransactions: FinancialTransaction[] = [];
