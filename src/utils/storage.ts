import {
  WorkshopSettings,
  InventoryItem,
  StockTransaction,
  Employee,
  PayrollRecord,
  Customer,
  Quotation,
  Invoice,
  FinancialTransaction,
} from '../types';
import {
  initialSettings,
  initialInventory,
  initialStockTransactions,
  initialEmployees,
  initialCustomers,
  initialQuotations,
  initialInvoices,
  initialFinancialTransactions,
} from '../data/sampleData';

const STORAGE_KEYS = {
  SETTINGS: 'jcw_settings_v2',
  INVENTORY: 'jcw_inventory_v2',
  STOCK_TRANSACTIONS: 'jcw_stock_txns_v2',
  EMPLOYEES: 'jcw_employees_v2',
  PAYROLLS: 'jcw_payrolls_v2',
  CUSTOMERS: 'jcw_customers_v2',
  QUOTES: 'jcw_quotes_v2',
  INVOICES: 'jcw_invoices_v2',
  FINANCES: 'jcw_finances_v2',
  CLEAN_INITIALIZED: 'jcw_zero_initialized_v2',
};

// Clean legacy mock keys if present
export function ensureZeroCleanState(): void {
  try {
    const isClean = localStorage.getItem(STORAGE_KEYS.CLEAN_INITIALIZED);
    if (!isClean) {
      // Clear legacy storage items containing mockups
      const legacyKeys = [
        'jcw_settings',
        'jcw_inventory',
        'jcw_stock_txns',
        'jcw_employees',
        'jcw_payrolls',
        'jcw_customers',
        'jcw_quotes',
        'jcw_invoices',
        'jcw_finances',
      ];
      legacyKeys.forEach(k => localStorage.removeItem(k));
      
      // Initialize with clean empty datasets
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(initialSettings));
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.STOCK_TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PAYROLLS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.CLEAN_INITIALIZED, 'true');
    }
  } catch (e) {
    console.error('Storage initialization check error:', e);
  }
}

// Auto-run cleanup on import
ensureZeroCleanState();

// Helper for local storage retrieval
function getStoredItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed = JSON.parse(item);
    if (parsed === null || parsed === undefined) return defaultValue;
    if (Array.isArray(defaultValue) && !Array.isArray(parsed)) return defaultValue;
    return parsed as T;
  } catch (err) {
    console.error(`Error loading ${key} from storage:`, err);
    return defaultValue;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to storage:`, err);
  }
}

export function loadSettings(): WorkshopSettings {
  return getStoredItem<WorkshopSettings>(STORAGE_KEYS.SETTINGS, initialSettings);
}

export function saveSettings(settings: WorkshopSettings): void {
  setStoredItem(STORAGE_KEYS.SETTINGS, settings);
}

export function loadInventory(): InventoryItem[] {
  return getStoredItem<InventoryItem[]>(STORAGE_KEYS.INVENTORY, initialInventory);
}

export function saveInventory(items: InventoryItem[]): void {
  setStoredItem(STORAGE_KEYS.INVENTORY, items);
}

export function loadStockTransactions(): StockTransaction[] {
  return getStoredItem<StockTransaction[]>(STORAGE_KEYS.STOCK_TRANSACTIONS, initialStockTransactions);
}

export function saveStockTransactions(txns: StockTransaction[]): void {
  setStoredItem(STORAGE_KEYS.STOCK_TRANSACTIONS, txns);
}

export function loadStockMovements(): StockTransaction[] {
  return loadStockTransactions();
}

export function saveStockMovements(txns: StockTransaction[]): void {
  saveStockTransactions(txns);
}

export function loadEmployees(): Employee[] {
  return getStoredItem<Employee[]>(STORAGE_KEYS.EMPLOYEES, initialEmployees);
}

export function saveEmployees(employees: Employee[]): void {
  setStoredItem(STORAGE_KEYS.EMPLOYEES, employees);
}

export function loadPayrolls(): PayrollRecord[] {
  return getStoredItem<PayrollRecord[]>(STORAGE_KEYS.PAYROLLS, []);
}

export function savePayrolls(payrolls: PayrollRecord[]): void {
  setStoredItem(STORAGE_KEYS.PAYROLLS, payrolls);
}

export function loadCustomers(): Customer[] {
  return getStoredItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
}

export function saveCustomers(customers: Customer[]): void {
  setStoredItem(STORAGE_KEYS.CUSTOMERS, customers);
}

export function loadQuotes(): Quotation[] {
  return getStoredItem<Quotation[]>(STORAGE_KEYS.QUOTES, initialQuotations);
}

export function saveQuotes(quotes: Quotation[]): void {
  setStoredItem(STORAGE_KEYS.QUOTES, quotes);
}

export function loadQuotations(): Quotation[] {
  return loadQuotes();
}

export function saveQuotations(quotes: Quotation[]): void {
  saveQuotes(quotes);
}

export function loadInvoices(): Invoice[] {
  return getStoredItem<Invoice[]>(STORAGE_KEYS.INVOICES, initialInvoices);
}

export function saveInvoices(invoices: Invoice[]): void {
  setStoredItem(STORAGE_KEYS.INVOICES, invoices);
}

export function loadFinances(): FinancialTransaction[] {
  return getStoredItem<FinancialTransaction[]>(STORAGE_KEYS.FINANCES, initialFinancialTransactions);
}

export function saveFinances(finances: FinancialTransaction[]): void {
  setStoredItem(STORAGE_KEYS.FINANCES, finances);
}

/**
 * Export full application database as JSON string
 */
export function exportAllDataAsJSON(): string {
  const data = {
    settings: loadSettings(),
    inventory: loadInventory(),
    stockMovements: loadStockMovements(),
    employees: loadEmployees(),
    payrolls: loadPayrolls(),
    customers: loadCustomers(),
    quotes: loadQuotes(),
    invoices: loadInvoices(),
    finances: loadFinances(),
    exportedAt: new Date().toISOString(),
    version: '2.0.0',
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Reset entire app to zero data
 */
export function resetAllDataToZero(): void {
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.STOCK_TRANSACTIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.PAYROLLS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CLEAN_INITIALIZED, 'true');
}

export function resetAllDataToDefault(): void {
  resetAllDataToZero();
}
