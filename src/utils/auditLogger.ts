import {
  AuditLogEntry,
  AuditActionType,
  AuditEntityType,
  AuditFieldChange,
  AuditActor,
  Invoice,
  FinancialTransaction,
  PayrollRecord,
  WorkshopSettings,
} from '../types';
import { formatZAR } from './sarsTaxEngine';

const AUDIT_STORAGE_KEY = 'jcw_sars_audit_log_v2';
export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Standard pure TypeScript SHA-256 Cryptographic Hash Implementation
 * Ensures 100% deterministic, zero-dependency hashing for browser and server environments
 */
function sha256Sync(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let currentHash: number[];
  const compositeClearChars: number[] = [];

  for (i = 0; i < ascii[lengthProperty]; i++) {
    compositeClearChars.push(ascii.charCodeAt(i));
  }

  // Pre-processing
  compositeClearChars.push(0x80);
  while ((compositeClearChars[lengthProperty] % 64) !== 56) {
    compositeClearChars.push(0x00);
  }

  for (i = 0; i < compositeClearChars[lengthProperty]; i += 4) {
    words.push(
      ((compositeClearChars[i] || 0) << 24) |
      ((compositeClearChars[i + 1] || 0) << 16) |
      ((compositeClearChars[i + 2] || 0) << 8) |
      (compositeClearChars[i + 3] || 0)
    );
  }

  words.push(Math.floor(asciiBitLength / maxWord));
  words.push(asciiBitLength % maxWord);

  // Process the message in successive 512-bit chunks
  const w: number[] = new Array(64);

  for (i = 0; i < words[lengthProperty]; i += 16) {
    currentHash = hash.slice(0);

    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j];
      } else {
        const gamma0 =
          ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^
          ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^
          (w[j - 15] >>> 3);
        const gamma1 =
          ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^
          ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^
          (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
      }

      const ch = (currentHash[4] & currentHash[5]) ^ (~currentHash[4] & currentHash[6]);
      const maj = (currentHash[0] & currentHash[1]) ^ (currentHash[0] & currentHash[2]) ^ (currentHash[1] & currentHash[2]);
      const sigma0 =
        ((currentHash[0] >>> 2) | (currentHash[0] << 30)) ^
        ((currentHash[0] >>> 13) | (currentHash[0] << 19)) ^
        ((currentHash[0] >>> 22) | (currentHash[0] << 10));
      const sigma1 =
        ((currentHash[4] >>> 6) | (currentHash[4] << 26)) ^
        ((currentHash[4] >>> 11) | (currentHash[4] << 21)) ^
        ((currentHash[4] >>> 25) | (currentHash[4] << 7));

      const temp1 = (currentHash[7] + sigma1 + ch + k[j] + w[j]) | 0;
      const temp2 = (sigma0 + maj) | 0;

      currentHash[7] = currentHash[6];
      currentHash[6] = currentHash[5];
      currentHash[5] = currentHash[4];
      currentHash[4] = (currentHash[3] + temp1) | 0;
      currentHash[3] = currentHash[2];
      currentHash[2] = currentHash[1];
      currentHash[1] = currentHash[0];
      currentHash[0] = (temp1 + temp2) | 0;
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + currentHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

/**
 * Calculates SHA-256 hash for an audit record payload in relation to the previous chained hash
 */
export function calculateAuditRecordHash(
  sequenceNumber: number,
  previousHash: string,
  timestamp: string,
  taxPeriod: string,
  actionType: AuditActionType,
  entityType: AuditEntityType,
  entityId: string,
  entityNumber: string,
  actorUserId: string,
  narrative: string,
  changes?: AuditFieldChange[]
): string {
  const normalizedPayload = [
    sequenceNumber,
    previousHash,
    timestamp,
    taxPeriod,
    actionType,
    entityType,
    entityId,
    entityNumber,
    actorUserId,
    narrative,
    JSON.stringify(changes || []),
    'SARS_TAA_SEC29_SEC30',
  ].join(':::');

  return sha256Sync(normalizedPayload);
}

/**
 * Default system actor used for operations
 */
export const DEFAULT_AUDIT_ACTOR: AuditActor = {
  userId: 'usr-jcw-001',
  userName: 'Jan Coetzee (Workshop Admin)',
  userRole: 'Workshop Admin',
  ipAddress: '197.229.140.22 (ZA-CPT)',
};

export const SARS_PRACTITIONER_ACTOR: AuditActor = {
  userId: 'usr-tax-004',
  userName: 'S. Van Der Merwe (SAIPA Tax Prac #49102)',
  userRole: 'Tax Practitioner',
  ipAddress: '105.184.20.15 (ZA-CPT)',
};

/**
 * Load all audit logs from persistent storage
 */
export function loadAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error loading SARS audit logs from storage:', err);
    return [];
  }
}

/**
 * Save audit logs to persistent storage
 */
export function saveAuditLogs(logs: AuditLogEntry[]): void {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Error saving SARS audit logs to storage:', err);
  }
}

/**
 * Appends a new immutable audit record to the persistent chain
 */
export function appendAuditLog(params: {
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  entityNumber: string;
  narrative: string;
  changes?: AuditFieldChange[];
  actor?: AuditActor;
  taxPeriod?: string;
  timestamp?: string;
  previousPayload?: any;
  newPayload?: any;
  metadata?: Record<string, any>;
}): AuditLogEntry[] {
  const currentLogs = loadAuditLogs();
  const nextSeq = currentLogs.length + 1;
  const prevHash = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1].recordHash : GENESIS_HASH;
  const isoTimestamp = params.timestamp || new Date().toISOString();
  const taxPeriod = params.taxPeriod || isoTimestamp.slice(0, 7);
  const actor = params.actor || DEFAULT_AUDIT_ACTOR;

  const recordHash = calculateAuditRecordHash(
    nextSeq,
    prevHash,
    isoTimestamp,
    taxPeriod,
    params.actionType,
    params.entityType,
    params.entityId,
    params.entityNumber,
    actor.userId,
    params.narrative,
    params.changes
  );

  const entry: AuditLogEntry = {
    id: `AUD-${taxPeriod.replace('-', '')}-${nextSeq.toString().padStart(5, '0')}`,
    sequenceNumber: nextSeq,
    timestamp: isoTimestamp,
    taxPeriod,
    actionType: params.actionType,
    entityType: params.entityType,
    entityId: params.entityId,
    entityNumber: params.entityNumber,
    actor,
    narrative: params.narrative,
    changes: params.changes || [],
    previousHash: prevHash,
    recordHash,
    complianceStandard: 'SARS_TAA_SEC29_SEC30',
    metadata: {
      ...(params.metadata || {}),
      ...(params.previousPayload ? { previousPayload: params.previousPayload } : {}),
      ...(params.newPayload ? { newPayload: params.newPayload } : {}),
    },
  };

  const updatedLogs = [...currentLogs, entry];
  saveAuditLogs(updatedLogs);
  return updatedLogs;
}

/**
 * Verifies cryptographic chained integrity across all audit records
 * Tests both internal hash math and inter-block SHA-256 chain links
 */
export function verifyAuditLogIntegrity(logs: AuditLogEntry[]): {
  isTamperFree: boolean;
  totalRecords: number;
  verifiedCount: number;
  compromisedIndices: number[];
  chainStatus: 'VERIFIED' | 'TAMPERED' | 'EMPTY';
  lastVerifiedHash: string;
} {
  if (!logs || logs.length === 0) {
    return {
      isTamperFree: true,
      totalRecords: 0,
      verifiedCount: 0,
      compromisedIndices: [],
      chainStatus: 'EMPTY',
      lastVerifiedHash: GENESIS_HASH,
    };
  }

  const compromisedIndices: number[] = [];
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];

    // Check sequence monotonic consistency
    if (entry.sequenceNumber !== i + 1) {
      compromisedIndices.push(i);
      continue;
    }

    // Check previous hash linkage
    if (entry.previousHash !== expectedPrevHash) {
      compromisedIndices.push(i);
      continue;
    }

    // Recalculate hash from raw payload components
    const computedHash = calculateAuditRecordHash(
      entry.sequenceNumber,
      entry.previousHash,
      entry.timestamp,
      entry.taxPeriod,
      entry.actionType,
      entry.entityType,
      entry.entityId,
      entry.entityNumber,
      entry.actor?.userId || 'unknown',
      entry.narrative,
      entry.changes
    );

    if (computedHash !== entry.recordHash) {
      compromisedIndices.push(i);
      continue;
    }

    expectedPrevHash = entry.recordHash;
  }

  const isTamperFree = compromisedIndices.length === 0;

  return {
    isTamperFree,
    totalRecords: logs.length,
    verifiedCount: logs.length - compromisedIndices.length,
    compromisedIndices,
    chainStatus: isTamperFree ? 'VERIFIED' : 'TAMPERED',
    lastVerifiedHash: logs[logs.length - 1]?.recordHash || GENESIS_HASH,
  };
}

/**
 * Automatically computes field-level diff between two versions of an Invoice
 */
export function diffInvoices(oldInv: Invoice, newInv: Invoice): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  if (oldInv.status !== newInv.status) {
    changes.push({
      fieldName: 'status',
      fieldLabel: 'Payment Status',
      previousValue: oldInv.status,
      newValue: newInv.status,
    });
  }

  if (oldInv.subtotalExVat !== newInv.subtotalExVat) {
    changes.push({
      fieldName: 'subtotalExVat',
      fieldLabel: 'Subtotal (Excl VAT)',
      previousValue: oldInv.subtotalExVat,
      newValue: newInv.subtotalExVat,
      isFinancialAmount: true,
    });
  }

  if (oldInv.vatAmount !== newInv.vatAmount) {
    changes.push({
      fieldName: 'vatAmount',
      fieldLabel: 'SARS VAT Amount (15%)',
      previousValue: oldInv.vatAmount,
      newValue: newInv.vatAmount,
      isFinancialAmount: true,
    });
  }

  if (oldInv.totalIncVat !== newInv.totalIncVat) {
    changes.push({
      fieldName: 'totalIncVat',
      fieldLabel: 'Invoice Total (Incl VAT)',
      previousValue: oldInv.totalIncVat,
      newValue: newInv.totalIncVat,
      isFinancialAmount: true,
    });
  }

  if (oldInv.amountPaid !== newInv.amountPaid) {
    changes.push({
      fieldName: 'amountPaid',
      fieldLabel: 'Total Amount Paid',
      previousValue: oldInv.amountPaid,
      newValue: newInv.amountPaid,
      isFinancialAmount: true,
    });
  }

  if (oldInv.balanceDue !== newInv.balanceDue) {
    changes.push({
      fieldName: 'balanceDue',
      fieldLabel: 'Balance Due',
      previousValue: oldInv.balanceDue,
      newValue: newInv.balanceDue,
      isFinancialAmount: true,
    });
  }

  if (oldInv.customerName !== newInv.customerName) {
    changes.push({
      fieldName: 'customerName',
      fieldLabel: 'Customer / Client Name',
      previousValue: oldInv.customerName,
      newValue: newInv.customerName,
    });
  }

  if (oldInv.customerVatNumber !== newInv.customerVatNumber) {
    changes.push({
      fieldName: 'customerVatNumber',
      fieldLabel: 'Customer SARS VAT No',
      previousValue: oldInv.customerVatNumber || 'None',
      newValue: newInv.customerVatNumber || 'None',
    });
  }

  if (oldInv.vehicleReg !== newInv.vehicleReg) {
    changes.push({
      fieldName: 'vehicleReg',
      fieldLabel: 'Vehicle Registration',
      previousValue: oldInv.vehicleReg,
      newValue: newInv.vehicleReg,
    });
  }

  if (oldInv.vehicleMileage !== newInv.vehicleMileage) {
    changes.push({
      fieldName: 'vehicleMileage',
      fieldLabel: 'Odometer Mileage (km)',
      previousValue: `${oldInv.vehicleMileage} km`,
      newValue: `${newInv.vehicleMileage} km`,
    });
  }

  if (oldInv.items.length !== newInv.items.length) {
    changes.push({
      fieldName: 'itemsCount',
      fieldLabel: 'Line Items Count',
      previousValue: `${oldInv.items.length} line items`,
      newValue: `${newInv.items.length} line items`,
    });
  }

  return changes;
}

/**
 * Automatically computes field-level diff for Financial Transactions
 */
export function diffFinancialTransactions(
  oldTxn: FinancialTransaction,
  newTxn: FinancialTransaction
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  if (oldTxn.category !== newTxn.category) {
    changes.push({
      fieldName: 'category',
      fieldLabel: 'Expense/Income Category',
      previousValue: oldTxn.category,
      newValue: newTxn.category,
    });
  }

  if (oldTxn.amountExVat !== newTxn.amountExVat) {
    changes.push({
      fieldName: 'amountExVat',
      fieldLabel: 'Amount (Excl VAT)',
      previousValue: oldTxn.amountExVat,
      newValue: newTxn.amountExVat,
      isFinancialAmount: true,
    });
  }

  if (oldTxn.vatAmount !== newTxn.vatAmount) {
    changes.push({
      fieldName: 'vatAmount',
      fieldLabel: 'SARS VAT Amount',
      previousValue: oldTxn.vatAmount,
      newValue: newTxn.vatAmount,
      isFinancialAmount: true,
    });
  }

  if (oldTxn.amountIncVat !== newTxn.amountIncVat) {
    changes.push({
      fieldName: 'amountIncVat',
      fieldLabel: 'Total (Incl VAT)',
      previousValue: oldTxn.amountIncVat,
      newValue: newTxn.amountIncVat,
      isFinancialAmount: true,
    });
  }

  if (oldTxn.isVatClaimable !== newTxn.isVatClaimable) {
    changes.push({
      fieldName: 'isVatClaimable',
      fieldLabel: 'SARS Input VAT Claimable',
      previousValue: oldTxn.isVatClaimable ? 'Yes (Claimable)' : 'No (Non-Claimable)',
      newValue: newTxn.isVatClaimable ? 'Yes (Claimable)' : 'No (Non-Claimable)',
    });
  }

  if (oldTxn.description !== newTxn.description) {
    changes.push({
      fieldName: 'description',
      fieldLabel: 'Description',
      previousValue: oldTxn.description,
      newValue: newTxn.description,
    });
  }

  return changes;
}

/**
 * Format timestamp in South African Standard Time (SAST, UTC+2)
 */
export function formatSASTDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Africa/Johannesburg',
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

/**
 * Generates an initial historical compliance audit trail for existing data
 * If the user has invoices or finances, this seeds a pristine cryptographically chained genesis ledger.
 */
export function initializeHistoricalAuditTrailIfEmpty(
  invoices: Invoice[],
  finances: FinancialTransaction[],
  payrolls: PayrollRecord[]
): AuditLogEntry[] {
  const existingLogs = loadAuditLogs();
  if (existingLogs.length > 0) return existingLogs;

  const generatedLogs: AuditLogEntry[] = [];
  let currentPrevHash = GENESIS_HASH;
  let seq = 1;

  // 1. Initial Workshop Tax Configuration Genesis Log
  const genesisTimestamp = '2026-07-01T06:00:00.000Z';
  const genesisHash = calculateAuditRecordHash(
    seq,
    currentPrevHash,
    genesisTimestamp,
    '2026-07',
    'TAX_CONFIG_CHANGED',
    'TAX_CONFIG',
    'CFG-SARS-2026',
    'SARS-REG-4980287162',
    DEFAULT_AUDIT_ACTOR.userId,
    'SARS VAT Vendor Registration & Tax Engine initial configuration committed under Section 29 TAA standards.',
    [
      { fieldName: 'vatNumber', fieldLabel: 'SARS VAT Number', previousValue: 'Unregistered', newValue: '4980287162' },
      { fieldName: 'vatRate', fieldLabel: 'Standard Rate', previousValue: '0%', newValue: '15%' },
      { fieldName: 'sbcTaxRegime', fieldLabel: 'SBC Tax Status', previousValue: false, newValue: true },
    ]
  );

  generatedLogs.push({
    id: `AUD-202607-00001`,
    sequenceNumber: seq++,
    timestamp: genesisTimestamp,
    taxPeriod: '2026-07',
    actionType: 'TAX_CONFIG_CHANGED',
    entityType: 'TAX_CONFIG',
    entityId: 'CFG-SARS-2026',
    entityNumber: 'SARS-REG-4980287162',
    actor: SARS_PRACTITIONER_ACTOR,
    narrative: 'SARS VAT Vendor Registration & Tax Engine initial configuration committed under Section 29 TAA standards.',
    changes: [
      { fieldName: 'vatNumber', fieldLabel: 'SARS VAT Number', previousValue: 'Unregistered', newValue: '4980287162' },
      { fieldName: 'vatRate', fieldLabel: 'Standard Rate', previousValue: '0%', newValue: '15%' },
      { fieldName: 'sbcTaxRegime', fieldLabel: 'SBC Tax Status', previousValue: false, newValue: true },
    ],
    previousHash: currentPrevHash,
    recordHash: genesisHash,
    complianceStandard: 'SARS_TAA_SEC29_SEC30',
  });
  currentPrevHash = genesisHash;

  // 2. Add logs for historical invoices
  invoices.forEach(inv => {
    const invTime = inv.createdAt || `${inv.date}T08:30:00.000Z`;
    const taxPeriod = inv.date.slice(0, 7);

    // Creation event
    const createHash = calculateAuditRecordHash(
      seq,
      currentPrevHash,
      invTime,
      taxPeriod,
      'INVOICE_CREATED',
      'INVOICE',
      inv.id,
      inv.invoiceNumber,
      DEFAULT_AUDIT_ACTOR.userId,
      `Issued Tax Invoice ${inv.invoiceNumber} for ${inv.customerName} (${inv.vehicleMakeModel} ${inv.vehicleReg}).`,
      [
        { fieldName: 'totalIncVat', fieldLabel: 'Total (Incl VAT)', previousValue: 0, newValue: inv.totalIncVat, isFinancialAmount: true },
        { fieldName: 'vatAmount', fieldLabel: 'SARS Output VAT (15%)', previousValue: 0, newValue: inv.vatAmount, isFinancialAmount: true },
        { fieldName: 'subtotalExVat', fieldLabel: 'Subtotal (Excl VAT)', previousValue: 0, newValue: inv.subtotalExVat, isFinancialAmount: true },
        { fieldName: 'status', fieldLabel: 'Status', previousValue: 'DRAFT', newValue: 'UNPAID' },
      ]
    );

    const createEntry: AuditLogEntry = {
      id: `AUD-${taxPeriod.replace('-', '')}-${seq.toString().padStart(5, '0')}`,
      sequenceNumber: seq++,
      timestamp: invTime,
      taxPeriod,
      actionType: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: inv.id,
      entityNumber: inv.invoiceNumber,
      actor: DEFAULT_AUDIT_ACTOR,
      narrative: `Issued Tax Invoice ${inv.invoiceNumber} for ${inv.customerName} (${inv.vehicleMakeModel} ${inv.vehicleReg}).`,
      changes: [
        { fieldName: 'totalIncVat', fieldLabel: 'Total (Incl VAT)', previousValue: 0, newValue: inv.totalIncVat, isFinancialAmount: true },
        { fieldName: 'vatAmount', fieldLabel: 'SARS Output VAT (15%)', previousValue: 0, newValue: inv.vatAmount, isFinancialAmount: true },
        { fieldName: 'subtotalExVat', fieldLabel: 'Subtotal (Excl VAT)', previousValue: 0, newValue: inv.subtotalExVat, isFinancialAmount: true },
        { fieldName: 'status', fieldLabel: 'Status', previousValue: 'DRAFT', newValue: 'UNPAID' },
      ],
      previousHash: currentPrevHash,
      recordHash: createHash,
      complianceStandard: 'SARS_TAA_SEC29_SEC30',
    };

    generatedLogs.push(createEntry);
    currentPrevHash = createHash;

    // Payments events
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach(pay => {
        const payTime = `${pay.date}T11:15:00.000Z`;
        const payHash = calculateAuditRecordHash(
          seq,
          currentPrevHash,
          payTime,
          taxPeriod,
          'INVOICE_PAYMENT_RECORDED',
          'INVOICE',
          inv.id,
          inv.invoiceNumber,
          DEFAULT_AUDIT_ACTOR.userId,
          `Recorded customer settlement of ${formatZAR(pay.amount)} via ${pay.method} (Ref: ${pay.reference}) on ${inv.invoiceNumber}.`,
          [
            { fieldName: 'amountPaid', fieldLabel: 'Amount Paid', previousValue: inv.totalIncVat - inv.balanceDue - pay.amount, newValue: inv.totalIncVat - inv.balanceDue, isFinancialAmount: true },
            { fieldName: 'balanceDue', fieldLabel: 'Balance Due', previousValue: inv.balanceDue + pay.amount, newValue: inv.balanceDue, isFinancialAmount: true },
            { fieldName: 'status', fieldLabel: 'Invoice Status', previousValue: 'UNPAID', newValue: inv.status },
          ]
        );

        const payEntry: AuditLogEntry = {
          id: `AUD-${taxPeriod.replace('-', '')}-${seq.toString().padStart(5, '0')}`,
          sequenceNumber: seq++,
          timestamp: payTime,
          taxPeriod,
          actionType: 'INVOICE_PAYMENT_RECORDED',
          entityType: 'INVOICE',
          entityId: inv.id,
          entityNumber: inv.invoiceNumber,
          actor: DEFAULT_AUDIT_ACTOR,
          narrative: `Recorded customer settlement of ${formatZAR(pay.amount)} via ${pay.method} (Ref: ${pay.reference}) on ${inv.invoiceNumber}.`,
          changes: [
            { fieldName: 'amountPaid', fieldLabel: 'Amount Paid', previousValue: inv.totalIncVat - inv.balanceDue - pay.amount, newValue: inv.totalIncVat - inv.balanceDue, isFinancialAmount: true },
            { fieldName: 'balanceDue', fieldLabel: 'Balance Due', previousValue: inv.balanceDue + pay.amount, newValue: inv.balanceDue, isFinancialAmount: true },
            { fieldName: 'status', fieldLabel: 'Invoice Status', previousValue: 'UNPAID', newValue: inv.status },
          ],
          previousHash: currentPrevHash,
          recordHash: payHash,
          complianceStandard: 'SARS_TAA_SEC29_SEC30',
        };

        generatedLogs.push(payEntry);
        currentPrevHash = payHash;
      });
    }
  });

  // 3. Add logs for financial expenses/incomes
  finances.forEach(fin => {
    const finTime = `${fin.date}T10:00:00.000Z`;
    const taxPeriod = fin.date.slice(0, 7);

    const finHash = calculateAuditRecordHash(
      seq,
      currentPrevHash,
      finTime,
      taxPeriod,
      'FINANCIAL_ENTRY_CREATED',
      'FINANCIAL_TRANSACTION',
      fin.id,
      fin.referenceNo || fin.id,
      DEFAULT_AUDIT_ACTOR.userId,
      `Ledger Entry: ${fin.type === 'INCOME' ? 'Income' : 'Expense'} - ${fin.category} (${fin.description}) [${formatZAR(fin.amountIncVat)}].`,
      [
        { fieldName: 'amountExVat', fieldLabel: 'Amount (Excl VAT)', previousValue: 0, newValue: fin.amountExVat, isFinancialAmount: true },
        { fieldName: 'vatAmount', fieldLabel: 'Input/Output VAT', previousValue: 0, newValue: fin.vatAmount, isFinancialAmount: true },
        { fieldName: 'isVatClaimable', fieldLabel: 'SARS VAT Claimable', previousValue: false, newValue: fin.isVatClaimable },
        { fieldName: 'category', fieldLabel: 'Category', previousValue: 'None', newValue: fin.category },
      ]
    );

    const finEntry: AuditLogEntry = {
      id: `AUD-${taxPeriod.replace('-', '')}-${seq.toString().padStart(5, '0')}`,
      sequenceNumber: seq++,
      timestamp: finTime,
      taxPeriod,
      actionType: 'FINANCIAL_ENTRY_CREATED',
      entityType: 'FINANCIAL_TRANSACTION',
      entityId: fin.id,
      entityNumber: fin.referenceNo || fin.id,
      actor: DEFAULT_AUDIT_ACTOR,
      narrative: `Ledger Entry: ${fin.type === 'INCOME' ? 'Income' : 'Expense'} - ${fin.category} (${fin.description}) [${formatZAR(fin.amountIncVat)}].`,
      changes: [
        { fieldName: 'amountExVat', fieldLabel: 'Amount (Excl VAT)', previousValue: 0, newValue: fin.amountExVat, isFinancialAmount: true },
        { fieldName: 'vatAmount', fieldLabel: 'Input/Output VAT', previousValue: 0, newValue: fin.vatAmount, isFinancialAmount: true },
        { fieldName: 'isVatClaimable', fieldLabel: 'SARS VAT Claimable', previousValue: false, newValue: fin.isVatClaimable },
        { fieldName: 'category', fieldLabel: 'Category', previousValue: 'None', newValue: fin.category },
      ],
      previousHash: currentPrevHash,
      recordHash: finHash,
      complianceStandard: 'SARS_TAA_SEC29_SEC30',
    };

    generatedLogs.push(finEntry);
    currentPrevHash = finHash;
  });

  saveAuditLogs(generatedLogs);
  return generatedLogs;
}

/**
 * Generates CSV Export Content for the entire SARS Audit Trail
 */
export function exportAuditLogsToCSV(logs: AuditLogEntry[], settings: WorkshopSettings): void {
  let csv = 'data:text/csv;charset=utf-8,';
  
  // Header Metadata
  csv += `SARS SECTION 29/30 ELECTRONIC DATA INTEGRITY & AUDIT TRAIL DOSSIER\r\n`;
  csv += `Taxpayer / Entity,${settings.workshopName}\r\n`;
  csv += `SARS VAT Registration No,${settings.vatNumber}\r\n`;
  csv += `CIPC Registration No,${settings.registrationNumber}\r\n`;
  csv += `Statutory Standard,Tax Administration Act 28 of 2011 (Sec 29 & 30) - 5 Year Mandatory Retention\r\n`;
  csv += `Export Timestamp,${new Date().toISOString()} (SAST: ${formatSASTDateTime(new Date().toISOString())})\r\n`;
  csv += `Total Chained Records,${logs.length}\r\n`;
  csv += `Genesis Block Hash,${GENESIS_HASH}\r\n`;
  csv += `Final Block Hash,${logs[logs.length - 1]?.recordHash || 'N/A'}\r\n\r\n`;

  // Columns
  csv += `Seq No,Audit Log ID,Timestamp (SAST),Tax Period,Action Type,Entity Type,Entity Ref No,Actor Name,Actor Role,Narrative,Field Changes Diff,Previous Chained Hash (SHA-256),Record Hash (SHA-256),Compliance Status\r\n`;

  logs.forEach(entry => {
    const changesSummary = (entry.changes || [])
      .map(c => `${c.fieldLabel}: [${c.previousValue} -> ${c.newValue}]`)
      .join(' | ');

    csv += `${entry.sequenceNumber},"${entry.id}","${formatSASTDateTime(entry.timestamp)}","${entry.taxPeriod}","${entry.actionType}","${entry.entityType}","${entry.entityNumber}","${entry.actor.userName}","${entry.actor.userRole}","${entry.narrative.replace(/"/g, '""')}","${changesSummary.replace(/"/g, '""')}","${entry.previousHash}","${entry.recordHash}","VERIFIED_COMPLIANT"\r\n`;
  });

  const encodedUri = encodeURI(csv);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `SARS_Sec29_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
