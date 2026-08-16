import { Employee, PayrollRecord, SarsVat201Summary, SarsEmp201Summary, SarsIncomeTaxEstimate, Invoice, FinancialTransaction, InventoryItem } from '../types';

/**
 * South African SARS Statutory Tax Calculation Engine (2025 / 2026 Tax Year)
 * Compliant with South African Revenue Service (SARS) PAYE, UIF, SDL, VAT201, and Income Tax rules.
 */

// SARS 2025/2026 Individual Income Tax Brackets
export const SARS_TAX_BRACKETS_2025_2026 = [
  { min: 0, max: 237100, baseTax: 0, rate: 0.18, threshold: 0 },
  { min: 237100, max: 370500, baseTax: 42678, rate: 0.26, threshold: 237100 },
  { min: 370500, max: 512800, baseTax: 77362, rate: 0.31, threshold: 370500 },
  { min: 512800, max: 673000, baseTax: 121475, rate: 0.36, threshold: 512800 },
  { min: 673000, max: 857900, baseTax: 179147, rate: 0.39, threshold: 673000 },
  { min: 857900, max: 1817000, baseTax: 251258, rate: 0.41, threshold: 857900 },
  { min: 1817000, max: Infinity, baseTax: 644489, rate: 0.45, threshold: 1817000 },
];

// SARS Tax Rebates
export const SARS_REBATES_2025_2026 = {
  primary: 17235, // Under 65
  secondary: 9444, // Age 65 to 74
  tertiary: 3145, // Age 75 and older
};

// SARS Medical Scheme Fees Tax Credits (Section 6A) monthly
export const SARS_MED_CREDITS_MONTHLY = {
  mainMember: 364,
  firstDependent: 364,
  eachAdditionalDependent: 246,
};

// UIF Ceiling: R17,712 per month (Max R177.12 employee + R177.12 employer)
export const UIF_MONTHLY_CEILING = 17712;
export const UIF_MAX_CONTRIBUTION = 177.12;

// Small Business Corporation (SBC) Tax Brackets for Companies (2025/2026)
export const SARS_SBC_TAX_BRACKETS = [
  { min: 0, max: 95750, baseTax: 0, rate: 0.00, threshold: 0 },
  { min: 95750, max: 365000, baseTax: 0, rate: 0.07, threshold: 95750 },
  { min: 365000, max: 550000, baseTax: 18848, rate: 0.21, threshold: 365000 },
  { min: 550000, max: Infinity, baseTax: 57698, rate: 0.27, threshold: 550000 },
];

/**
 * Calculate PAYE and monthly statutory deductions for a South African employee
 */
export function calculateMonthlyEmployeePayroll(
  employee: Employee,
  monthYear: string,
  overtimeHours = 0,
  overtimeRatePerHour = 0,
  bonus = 0,
  allowances = 0,
  otherDeductions = 0,
  notes = ''
): PayrollRecord {
  const overtimePay = overtimeHours * overtimeRatePerHour;
  const grossIncome = employee.basicSalary + overtimePay + bonus + allowances;
  const taxableIncome = grossIncome; // For standard monthly remuneration
  
  const annualizedIncome = taxableIncome * 12;

  // 1. Calculate Gross Annual Income Tax
  let grossAnnualTax = 0;
  for (const bracket of SARS_TAX_BRACKETS_2025_2026) {
    if (annualizedIncome > bracket.min) {
      const taxableInBracket = Math.min(annualizedIncome, bracket.max) - bracket.threshold;
      if (bracket.max === Infinity || annualizedIncome <= bracket.max) {
        grossAnnualTax = bracket.baseTax + (annualizedIncome - bracket.threshold) * bracket.rate;
        break;
      }
    }
  }

  // 2. Calculate Applicable Rebates based on Age
  const primaryRebate = SARS_REBATES_2025_2026.primary;
  let secondaryRebate = 0;
  let tertiaryRebate = 0;

  if (employee.age >= 65) {
    secondaryRebate = SARS_REBATES_2025_2026.secondary;
  }
  if (employee.age >= 75) {
    tertiaryRebate = SARS_REBATES_2025_2026.tertiary;
  }

  const totalAnnualRebates = primaryRebate + secondaryRebate + tertiaryRebate;

  // 3. Calculate Medical Scheme Tax Credits
  let monthlyMedCredit = 0;
  if (employee.medicalAidMembers > 0) {
    monthlyMedCredit += SARS_MED_CREDITS_MONTHLY.mainMember;
    if (employee.medicalAidMembers > 1) {
      monthlyMedCredit += SARS_MED_CREDITS_MONTHLY.firstDependent;
    }
    if (employee.medicalAidMembers > 2) {
      monthlyMedCredit += (employee.medicalAidMembers - 2) * SARS_MED_CREDITS_MONTHLY.eachAdditionalDependent;
    }
  }
  const medicalTaxCreditsAnnual = monthlyMedCredit * 12;

  // 4. Net Annual Tax & Monthly PAYE
  const netAnnualTax = Math.max(0, grossAnnualTax - totalAnnualRebates - medicalTaxCreditsAnnual);
  const sarsPayeMonthly = Math.round((netAnnualTax / 12) * 100) / 100;

  // 5. UIF Calculation (1% capped at R177.12)
  const uifSubjectRemuneration = Math.min(grossIncome, UIF_MONTHLY_CEILING);
  const uifEmployee = Math.round(uifSubjectRemuneration * 0.01 * 100) / 100;
  const uifEmployer = uifEmployee;

  // 6. SDL Calculation (1% of gross for employer)
  const sdlEmployer = Math.round(grossIncome * 0.01 * 100) / 100;

  // 7. Total employee deductions & Net Pay
  const totalEmployeeDeductions = sarsPayeMonthly + uifEmployee + otherDeductions;
  const netPay = Math.round((grossIncome - totalEmployeeDeductions) * 100) / 100;
  const totalEmployerCost = Math.round((grossIncome + uifEmployer + sdlEmployer) * 100) / 100;

  return {
    id: `PAY-${employee.id.substring(0, 5)}-${monthYear}-${Date.now().toString().slice(-4)}`,
    employeeId: employee.id,
    employeeName: employee.fullName,
    employeeNumber: employee.employeeNumber,
    idNumber: employee.idNumber,
    taxNumber: employee.taxNumber,
    position: employee.position,
    monthYear,
    basicSalary: employee.basicSalary,
    overtimeHours,
    overtimeRatePerHour,
    overtimePay,
    bonus,
    allowances,
    grossIncome,
    taxableIncome,
    annualizedIncome,
    grossAnnualTax: Math.round(grossAnnualTax * 100) / 100,
    primaryRebate,
    secondaryRebate,
    tertiaryRebate,
    medicalTaxCreditsAnnual,
    netAnnualTax: Math.round(netAnnualTax * 100) / 100,
    sarsPayeMonthly,
    uifEmployee,
    uifEmployer,
    sdlEmployer,
    otherDeductions,
    totalEmployeeDeductions: Math.round(totalEmployeeDeductions * 100) / 100,
    netPay,
    totalEmployerCost,
    paymentStatus: 'PAID',
    paymentDate: `${monthYear}-25`,
    paymentMethod: 'EFT',
    notes,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate monthly SARS EMP201 report
 */
export function generateSarsEmp201(monthYear: string, payrolls: PayrollRecord[]): SarsEmp201Summary {
  const monthPayrolls = payrolls.filter(p => p.monthYear === monthYear);
  
  const totalGross = monthPayrolls.reduce((sum, p) => sum + p.grossIncome, 0);
  const totalPaye = monthPayrolls.reduce((sum, p) => sum + p.sarsPayeMonthly, 0);
  const totalUifRemun = monthPayrolls.reduce((sum, p) => sum + Math.min(p.grossIncome, UIF_MONTHLY_CEILING), 0);
  const totalUif = monthPayrolls.reduce((sum, p) => sum + (p.uifEmployee + p.uifEmployer), 0);
  const totalSdlRemun = totalGross;
  const totalSdl = monthPayrolls.reduce((sum, p) => sum + p.sdlEmployer, 0);

  // Due date is the 7th of the following month
  const [year, month] = monthYear.split('-').map(Number);
  const nextMonthDate = new Date(year, month, 7);
  const formattedDueDate = nextMonthDate.toISOString().split('T')[0];

  return {
    periodMonth: monthYear,
    totalGrossRemuneration: Math.round(totalGross * 100) / 100,
    totalPayeWithheld: Math.round(totalPaye * 100) / 100,
    totalUifRemuneration: Math.round(totalUifRemun * 100) / 100,
    totalUifContribution: Math.round(totalUif * 100) / 100,
    totalSdlRemuneration: Math.round(totalSdlRemun * 100) / 100,
    totalSdlLevy: Math.round(totalSdl * 100) / 100,
    totalEmp201Payable: Math.round((totalPaye + totalUif + totalSdl) * 100) / 100,
    dueDate: formattedDueDate,
  };
}

/**
 * Generate monthly or bi-monthly SARS VAT201 calculation based on Tax Invoices and Expense records
 */
export function generateSarsVat201(
  periodMonth: string,
  invoices: Invoice[] = [],
  expenses: FinancialTransaction[] = []
): SarsVat201Summary {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeExpenses = Array.isArray(expenses) ? expenses : [];

  // Parse periodMonth: could be "2026-08" or "2026-07 to 2026-08"
  const months = periodMonth.includes(' to ')
    ? periodMonth.split(' to ').map(m => m.trim())
    : [periodMonth.trim()];

  // Output VAT from completed/issued Invoices in this period (SARS standard rated supplies @ 15%)
  const monthInvoices = safeInvoices.filter(inv =>
    inv && inv.date && months.some(m => inv.date.startsWith(m))
  );
  const standardRatedSuppliesExVat = monthInvoices.reduce((sum, inv) => sum + (inv.subtotalExVat || 0), 0);
  const outputTaxOnSales = monthInvoices.reduce((sum, inv) => sum + (inv.vatAmount || 0), 0);

  // Input VAT from claimable business expenses and supplier stock purchases in this period
  const monthExpenses = safeExpenses.filter(
    exp => exp && exp.date && months.some(m => exp.date.startsWith(m)) && exp.type === 'EXPENSE' && exp.isVatClaimable
  );

  // Separate Capital Goods (equipment/tools > R10,000) and Other Goods/Services
  let capitalGoodsExVat = 0;
  let capitalGoodsInputTax = 0;
  let otherGoodsServicesExVat = 0;
  let otherGoodsServicesInputTax = 0;

  monthExpenses.forEach(exp => {
    if (exp.category === 'Equipment Lease & Maintenance' && (exp.amountExVat || 0) >= 10000) {
      capitalGoodsExVat += exp.amountExVat || 0;
      capitalGoodsInputTax += exp.vatAmount || 0;
    } else {
      otherGoodsServicesExVat += exp.amountExVat || 0;
      otherGoodsServicesInputTax += exp.vatAmount || 0;
    }
  });

  const totalInputTax = capitalGoodsInputTax + otherGoodsServicesInputTax;
  const netVatPayableOrRefund = Math.round((outputTaxOnSales - totalInputTax) * 100) / 100;

  // Due date: 25th of following month (or last business day for eFiling)
  const lastMonth = months[months.length - 1] || '2026-08';
  const parts = lastMonth.split('-').map(Number);
  const year = parts[0] || 2026;
  const month = parts[1] || 8;
  const nextMonthDate = new Date(year, month, 25);
  const dueDate = nextMonthDate.toISOString().split('T')[0];

  return {
    periodMonth,
    standardRatedSuppliesExVat: Math.round(standardRatedSuppliesExVat * 100) / 100,
    outputTaxOnSales: Math.round(outputTaxOnSales * 100) / 100,
    otherOutputAdjustments: 0,
    totalOutputTax: Math.round(outputTaxOnSales * 100) / 100,
    capitalGoodsExVat: Math.round(capitalGoodsExVat * 100) / 100,
    capitalGoodsInputTax: Math.round(capitalGoodsInputTax * 100) / 100,
    otherGoodsServicesExVat: Math.round(otherGoodsServicesExVat * 100) / 100,
    otherGoodsServicesInputTax: Math.round(otherGoodsServicesInputTax * 100) / 100,
    totalInputTax: Math.round(totalInputTax * 100) / 100,
    netVatPayableOrRefund,
    dueDate,
  };
}

/**
 * Calculate SBC Progressive Income Tax for arbitrary taxable amount
 */
export function calculateSbcIncomeTax(taxableNetProfit: number): number {
  if (taxableNetProfit <= 0) return 0;
  let sbcTaxAmount = 0;
  for (const bracket of SARS_SBC_TAX_BRACKETS) {
    if (taxableNetProfit > bracket.min) {
      if (bracket.max === Infinity || taxableNetProfit <= bracket.max) {
        sbcTaxAmount = bracket.baseTax + (taxableNetProfit - bracket.threshold) * bracket.rate;
        break;
      }
    }
  }
  return Math.round(sbcTaxAmount * 100) / 100;
}

/**
 * Calculate Standard Corporate Tax (27%)
 */
export function calculateStandardCompanyTax(taxableNetProfit: number): number {
  if (taxableNetProfit <= 0) return 0;
  return Math.round(taxableNetProfit * 0.27 * 100) / 100;
}

/**
 * Calculate Annual / Provisional Corporate / SBC Income Tax Estimate
 */
export function calculateAnnualIncomeTax(
  invoices: Invoice[],
  expenses: FinancialTransaction[],
  taxYear = '2026/2027'
): SarsIncomeTaxEstimate {
  // Total Revenue Ex VAT
  const totalRevenueExVat = invoices
    .filter(inv => inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID')
    .reduce((sum, inv) => sum + inv.subtotalExVat, 0);

  // Cost of Sales (Supplier parts and direct job materials)
  const costOfSales = expenses
    .filter(exp => exp.type === 'EXPENSE' && exp.category === 'Supplier Parts Purchases')
    .reduce((sum, exp) => sum + exp.amountExVat, 0);

  const grossProfit = totalRevenueExVat - costOfSales;

  // Operating Expenses (Rent, electricity, salaries, consumables, insurance, etc.)
  const operatingExpenses = expenses
    .filter(exp => exp.type === 'EXPENSE' && exp.category !== 'Supplier Parts Purchases' && exp.taxDeductible)
    .reduce((sum, exp) => sum + exp.amountExVat, 0);

  const taxableNetProfit = Math.max(0, grossProfit - operatingExpenses);

  // Standard Corporate Rate (27%)
  const corporateTaxAt27 = Math.round(taxableNetProfit * 0.27 * 100) / 100;

  // SBC Tax calculation
  let sbcTaxAmount = 0;
  for (const bracket of SARS_SBC_TAX_BRACKETS) {
    if (taxableNetProfit > bracket.min) {
      if (bracket.max === Infinity || taxableNetProfit <= bracket.max) {
        sbcTaxAmount = bracket.baseTax + (taxableNetProfit - bracket.threshold) * bracket.rate;
        break;
      }
    }
  }
  sbcTaxAmount = Math.round(sbcTaxAmount * 100) / 100;

  const sbcTaxSavings = Math.max(0, corporateTaxAt27 - sbcTaxAmount);

  // Provisional Tax Payments (50% for 1st period, final for 2nd period)
  const provisionalPeriod1Estimate = Math.round((sbcTaxAmount / 2) * 100) / 100;
  const provisionalPeriod2Estimate = Math.round(sbcTaxAmount * 100) / 100;

  return {
    taxYear,
    totalRevenueExVat: Math.round(totalRevenueExVat * 100) / 100,
    costOfSales: Math.round(costOfSales * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    operatingExpenses: Math.round(operatingExpenses * 100) / 100,
    taxableNetProfit: Math.round(taxableNetProfit * 100) / 100,
    corporateTaxAt27,
    sbcTaxAmount,
    sbcTaxSavings: Math.round(sbcTaxSavings * 100) / 100,
    provisionalPeriod1Estimate,
    provisionalPeriod2Estimate,
  };
}

/**
 * SARS Compliance Deadline Tracker
 */
export interface SarsUpcomingDeadline {
  type: 'VAT201' | 'EMP201' | 'IRP6';
  title: string;
  shortLabel: string;
  dueDate: string; // "YYYY-MM-DD"
  formattedDueDate: string; // e.g. "31 Aug 2026"
  daysRemaining: number;
  isOverdue: boolean;
  urgency: 'CRITICAL' | 'WARNING' | 'NORMAL';
  badgeText: string;
  periodDescription: string;
  notes: string;
}

/**
 * Calculates the next upcoming SARS statutory filing deadline (VAT201 vs EMP201 vs IRP6)
 * based on the current date.
 */
export function getNextSarsDeadline(currentDate = new Date()): SarsUpcomingDeadline {
  const allUpcoming = getUpcomingSarsDeadlines(currentDate);
  return allUpcoming[0];
}

/**
 * Returns sorted list of all upcoming SARS deadlines for the next 3 months
 */
export function getUpcomingSarsDeadlines(currentDate = new Date()): SarsUpcomingDeadline[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const day = currentDate.getDate();

  const candidates: SarsUpcomingDeadline[] = [];

  // Helper to calculate days remaining
  const calcDays = (targetDate: Date) => {
    const startOfToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffMs = target.getTime() - startOfToday.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const formatDateStr = (d: Date) => d.toISOString().split('T')[0];
  const formatReadable = (d: Date) =>
    d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

  // 1. EMP201 Deadlines: Due on 7th of every month
  // Check this month's 7th (if today <= 7th) and next 2 months' 7th
  for (let offset = 0; offset <= 2; offset++) {
    const empTarget = new Date(year, month + offset, 7);
    const days = calcDays(empTarget);
    if (days >= 0 || (offset === 0 && days >= -3)) {
      const targetMonthPrev = new Date(year, month + offset - 1, 1);
      const prevMonthName = targetMonthPrev.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
      
      const urgency = days <= 3 ? 'CRITICAL' : days <= 7 ? 'WARNING' : 'NORMAL';
      const badgeText = days === 0 ? 'EMP201 Today!' : days === 1 ? 'EMP201 Tomorrow' : `EMP201 in ${days}d`;

      candidates.push({
        type: 'EMP201',
        title: 'SARS EMP201 Return (PAYE / UIF / SDL)',
        shortLabel: 'EMP201',
        dueDate: formatDateStr(empTarget),
        formattedDueDate: formatReadable(empTarget),
        daysRemaining: days,
        isOverdue: days < 0,
        urgency,
        badgeText,
        periodDescription: `Payroll for ${prevMonthName}`,
        notes: 'Monthly declaration & remittance of employee PAYE, UIF (2%), and SDL (1%) to SARS.',
      });
    }
  }

  // 2. VAT201 Deadlines: Due on the last business day of the month (eFiling) or 25th
  // Check this month's end and next 2 months' end
  for (let offset = 0; offset <= 2; offset++) {
    // Last day of month
    const vatTarget = new Date(year, month + offset + 1, 0); // Day 0 of next month is last day of this month
    const days = calcDays(vatTarget);
    if (days >= 0 || (offset === 0 && days >= -3)) {
      const currentPeriodMonth = new Date(year, month + offset, 1);
      const periodName = currentPeriodMonth.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
      
      const urgency = days <= 3 ? 'CRITICAL' : days <= 7 ? 'WARNING' : 'NORMAL';
      const badgeText = days === 0 ? 'VAT201 Today!' : days === 1 ? 'VAT201 Tomorrow' : `VAT201 in ${days}d`;

      candidates.push({
        type: 'VAT201',
        title: 'SARS VAT201 Return Declaration',
        shortLabel: 'VAT201',
        dueDate: formatDateStr(vatTarget),
        formattedDueDate: formatReadable(vatTarget),
        daysRemaining: days,
        isOverdue: days < 0,
        urgency,
        badgeText,
        periodDescription: `Tax Period: ${periodName}`,
        notes: 'Declaration of 15% Output VAT on workshop sales minus claimable Input VAT on spares and operating expenses.',
      });
    }
  }

  // 3. Provisional Tax (IRP6) Deadlines: 31 August & 28/29 February
  const augProvisional = new Date(year, 7, 31); // 31 August (month 7 is Aug)
  const febProvisional = new Date(year + (month > 1 ? 1 : 0), 1, new Date(year + (month > 1 ? 1 : 0), 2, 0).getDate()); // End of Feb
  
  [augProvisional, febProvisional].forEach(provTarget => {
    const days = calcDays(provTarget);
    if (days >= 0 && days <= 90) {
      const urgency = days <= 5 ? 'CRITICAL' : days <= 14 ? 'WARNING' : 'NORMAL';
      const isAug = provTarget.getMonth() === 7;
      candidates.push({
        type: 'IRP6',
        title: isAug ? 'SARS 1st Provisional Tax Return (IRP6)' : 'SARS 2nd Provisional Tax Return (IRP6)',
        shortLabel: 'IRP6',
        dueDate: formatDateStr(provTarget),
        formattedDueDate: formatReadable(provTarget),
        daysRemaining: days,
        isOverdue: days < 0,
        urgency,
        badgeText: `IRP6 in ${days}d`,
        periodDescription: isAug ? '1st Period Assessment' : '2nd Period Assessment',
        notes: 'Small Business Corporation provisional income tax payment on estimated taxable annual earnings.',
      });
    }
  });

  // Sort by daysRemaining ascending (earliest first)
  candidates.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return candidates;
}

/**
 * Currency Formatter for South African Rand (ZAR)
 */
export function formatZAR(amount: number): string {
  if (isNaN(amount)) return 'R 0.00';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace('ZAR', 'R');
}
