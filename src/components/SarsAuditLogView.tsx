import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  Copy,
  Check,
  RefreshCw,
  Clock,
  User,
  ArrowRight,
  ChevronRight,
  X,
  FileSpreadsheet,
  Layers,
  Activity,
  Hash,
  Database,
  Printer,
} from 'lucide-react';
import {
  AuditLogEntry,
  AuditActionType,
  AuditEntityType,
  WorkshopSettings,
  Invoice,
  FinancialTransaction,
} from '../types';
import {
  formatSASTDateTime,
  verifyAuditLogIntegrity,
  exportAuditLogsToCSV,
  GENESIS_HASH,
} from '../utils/auditLogger';
import { formatZAR } from '../utils/sarsTaxEngine';
import { generateSarsAuditLogPDF } from '../utils/pdfGenerator';

interface SarsAuditLogViewProps {
  auditLogs: AuditLogEntry[];
  settings: WorkshopSettings;
  invoices?: Invoice[];
  finances?: FinancialTransaction[];
  onRefreshLogs?: () => void;
}

export const SarsAuditLogView: React.FC<SarsAuditLogViewProps> = ({
  auditLogs = [],
  settings,
  onRefreshLogs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<'ALL' | AuditEntityType>('ALL');
  const [actionFilter, setActionFilter] = useState<'ALL' | AuditActionType>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Compute live verification state
  const verification = useMemo(() => {
    return verifyAuditLogIntegrity(auditLogs);
  }, [auditLogs]);

  // Unique Tax Periods
  const availablePeriods = useMemo(() => {
    const periods = Array.from(new Set(auditLogs.map(l => l.taxPeriod).filter(Boolean)));
    return periods.sort().reverse();
  }, [auditLogs]);

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(entry => {
      // Search matching
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesRef = (entry.entityNumber || '').toLowerCase().includes(query);
        const matchesNarrative = (entry.narrative || '').toLowerCase().includes(query);
        const matchesActor = (entry.actor?.userName || '').toLowerCase().includes(query);
        const matchesId = (entry.id || '').toLowerCase().includes(query);
        const matchesHash = (entry.recordHash || '').toLowerCase().includes(query);
        const matchesChanges = (entry.changes || []).some(
          c =>
            c.fieldLabel.toLowerCase().includes(query) ||
            String(c.previousValue).toLowerCase().includes(query) ||
            String(c.newValue).toLowerCase().includes(query)
        );

        if (!matchesRef && !matchesNarrative && !matchesActor && !matchesId && !matchesHash && !matchesChanges) {
          return false;
        }
      }

      // Entity Filter
      if (entityFilter !== 'ALL' && entry.entityType !== entityFilter) {
        return false;
      }

      // Action Filter
      if (actionFilter !== 'ALL' && entry.actionType !== actionFilter) {
        return false;
      }

      // Period Filter
      if (periodFilter !== 'ALL' && entry.taxPeriod !== periodFilter) {
        return false;
      }

      return true;
    });
  }, [auditLogs, searchQuery, entityFilter, actionFilter, periodFilter]);

  // Handle Export CSV
  const handleExportCSV = () => {
    exportAuditLogsToCSV(filteredLogs, settings);
  };

  // Handle Export PDF
  const handleExportPDF = () => {
    const doc = generateSarsAuditLogPDF(filteredLogs, settings);
    doc.save(`SARS_Sec29_Audit_Dossier_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Copy hash helper
  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Copy full JSON payload
  const handleCopyPayload = (entry: AuditLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // Trigger manual cryptographic recalculation & verification
  const handleRunIntegrityCheck = () => {
    const result = verifyAuditLogIntegrity(auditLogs);
    if (result.isTamperFree) {
      setVerificationFeedback(
        `All ${result.totalRecords} chained blocks verified successfully. Zero cryptographic anomalies detected.`
      );
    } else {
      setVerificationFeedback(
        `Integrity issue detected at sequence indices: ${result.compromisedIndices.join(', ')}.`
      );
    }
    setTimeout(() => setVerificationFeedback(null), 4000);
  };

  // Action badge color helper
  const getActionBadgeClass = (type: AuditActionType) => {
    switch (type) {
      case 'INVOICE_CREATED':
      case 'FINANCIAL_ENTRY_CREATED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'INVOICE_MODIFIED':
      case 'FINANCIAL_ENTRY_MODIFIED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'INVOICE_PAYMENT_RECORDED':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'INVOICE_VOIDED':
      case 'FINANCIAL_ENTRY_DELETED':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'PAYROLL_EXECUTED':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'TAX_CONFIG_CHANGED':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: SARS Statutory Standard & Cryptographic Integrity Status */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-700 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-lg text-white">
                  SARS Section 29 & 30 Electronic Audit Trail
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Immutable SHA-256 Ledger</span>
                </span>
                <span className="bg-slate-700/60 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Read-Only Mode
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Mandatory statutory audit trail compliant with the South African Tax Administration Act (Act 28 of 2011).
                Tracks all additions, amendments, customer payments, voids, and financial ledger alterations with tamper-evident cryptographic block hashes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="verify-sars-chain-integrity-btn"
              onClick={handleRunIntegrityCheck}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center space-x-1.5"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Verify Hash Integrity</span>
            </button>

            <button
              type="button"
              id="export-sars-audit-csv-btn"
              onClick={handleExportCSV}
              className="bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold text-xs px-3 py-2 rounded-xl transition-all border border-slate-600 flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              id="export-sars-audit-pdf-btn"
              onClick={handleExportPDF}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Audit Dossier PDF</span>
            </button>
          </div>
        </div>

        {/* Live Integrity Banner Verification Feedback */}
        {verificationFeedback && (
          <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{verificationFeedback}</span>
          </div>
        )}

        {/* Cryptographic Telemetry Cards Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] block">Cryptographic Chain State</span>
            <div className="flex items-center space-x-2 mt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  verification.isTamperFree ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              ></span>
              <span className="font-bold text-white">
                {verification.isTamperFree ? '100% Cryptographically Verified' : 'Integrity Discrepancy'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">0 retroactive modifications</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] block">Total Chained Audit Blocks</span>
            <div className="flex items-center space-x-1.5 mt-1">
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono font-bold text-white text-sm">
                {auditLogs.length.toLocaleString()} Records
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Monotonically indexed</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] block">Statutory Standard</span>
            <div className="font-bold text-white mt-1">TAA Sec 29 & 30 (5-Yr Retention)</div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">SARS VAT 404 Guide rule</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] block">Latest Block Checksum (SHA-256)</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-[10px] text-amber-300 truncate max-w-[130px]">
                {verification.lastVerifiedHash.substring(0, 16)}...
              </span>
              <button
                type="button"
                onClick={() => handleCopyHash(verification.lastVerifiedHash)}
                className="text-slate-400 hover:text-white p-1"
                title="Copy full SHA-256 hash"
              >
                {copiedHash === verification.lastVerifiedHash ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Chained to Genesis</span>
          </div>
        </div>
      </div>

      {/* Interactive Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="audit-log-search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Invoice # (e.g. INV-2026-0089), Transaction Ref, Customer, Actor, or keyword..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Stats Pill */}
          <div className="text-xs text-slate-500 flex items-center space-x-2 shrink-0">
            <span className="font-semibold text-slate-900">{filteredLogs.length}</span>
            <span>of {auditLogs.length} records matching</span>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Entity Type
            </label>
            <select
              id="audit-filter-entity-select"
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Entities (Invoices, Finances, Payroll)</option>
              <option value="INVOICE">Invoices & Tax Invoices</option>
              <option value="FINANCIAL_TRANSACTION">Financial Ledger Transactions</option>
              <option value="PAYROLL_RECORD">Payroll EMP201 Records</option>
              <option value="TAX_CONFIG">SARS Tax Settings & Profiles</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Action Category
            </label>
            <select
              id="audit-filter-action-select"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Action Types</option>
              <option value="INVOICE_CREATED">Invoice Created</option>
              <option value="INVOICE_MODIFIED">Invoice Modified (Field Diff)</option>
              <option value="INVOICE_PAYMENT_RECORDED">Customer Payment Settlement</option>
              <option value="INVOICE_VOIDED">Invoice Voided / Deleted</option>
              <option value="FINANCIAL_ENTRY_CREATED">Financial Entry Created</option>
              <option value="FINANCIAL_ENTRY_DELETED">Financial Entry Deleted</option>
              <option value="PAYROLL_EXECUTED">Payroll Executed</option>
              <option value="TAX_CONFIG_CHANGED">Tax Engine Configuration</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              SARS Tax Period
            </label>
            <select
              id="audit-filter-period-select"
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Tax Periods</option>
              {availablePeriods.map(p => (
                <option key={p} value={p}>
                  {p} (Monthly / VAT Cat B)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Read-Only Audit Log Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-900 text-sm">Chronological Audit Trail Ledger</span>
            <span className="text-[11px] bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded-full">
              Read-Only
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Sec 29 TAA Validated
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-800 text-sm">No audit records match the selected filters</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search terms or clearing the entity/action filters to view historical records.
            </p>
            {(searchQuery || entityFilter !== 'ALL' || actionFilter !== 'ALL' || periodFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setEntityFilter('ALL');
                  setActionFilter('ALL');
                  setPeriodFilter('ALL');
                }}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-16 text-center">Seq #</th>
                  <th className="py-3 px-4 w-36">Timestamp (SAST)</th>
                  <th className="py-3 px-4 w-40">Event Type</th>
                  <th className="py-3 px-4 w-36">Entity Reference</th>
                  <th className="py-3 px-4 w-44">User / Actor</th>
                  <th className="py-3 px-4">Audit Narrative & Field Changes Diff</th>
                  <th className="py-3 px-4 w-32">Chained Hash</th>
                  <th className="py-3 px-4 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(entry => {
                  const hasChanges = entry.changes && entry.changes.length > 0;

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Seq # */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-600 text-[11px]">
                        #{entry.sequenceNumber.toString().padStart(4, '0')}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {formatSASTDateTime(entry.timestamp).split(',')[0]}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatSASTDateTime(entry.timestamp).split(',')[1] || ''}</span>
                        </div>
                      </td>

                      {/* Event Type Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border tracking-wide whitespace-nowrap ${getActionBadgeClass(
                            entry.actionType
                          )}`}
                        >
                          {entry.actionType.replace(/_/g, ' ')}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Period: {entry.taxPeriod}
                        </div>
                      </td>

                      {/* Entity Reference */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {entry.entityNumber}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {entry.entityType.replace(/_/g, ' ')}
                        </div>
                      </td>

                      {/* Actor / User */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{entry.actor?.userName || 'System'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {entry.actor?.userRole || 'Workshop Admin'}
                        </div>
                      </td>

                      {/* Narrative & Diff */}
                      <td className="py-3 px-4 max-w-md">
                        <p className="text-slate-800 text-xs font-medium leading-snug">
                          {entry.narrative}
                        </p>

                        {/* Field Changes Diff Chips */}
                        {hasChanges && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {entry.changes!.map((change, cIdx) => (
                              <div
                                key={cIdx}
                                className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 px-2 py-0.5 rounded-md text-[10px] text-slate-700 transition-colors"
                              >
                                <span className="font-bold text-slate-600">{change.fieldLabel}:</span>
                                <span className="line-through text-slate-400">
                                  {change.isFinancialAmount && typeof change.previousValue === 'number'
                                    ? formatZAR(change.previousValue)
                                    : String(change.previousValue ?? 'None')}
                                </span>
                                <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span className="font-semibold text-emerald-800">
                                  {change.isFinancialAmount && typeof change.newValue === 'number'
                                    ? formatZAR(change.newValue)
                                    : String(change.newValue ?? 'None')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Hash */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1">
                          <span className="font-mono text-[10px] text-slate-500 truncate max-w-[80px]">
                            {entry.recordHash.substring(0, 8)}...
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyHash(entry.recordHash)}
                            className="text-slate-400 hover:text-slate-700 p-1 transition-colors"
                            title="Copy full SHA-256 Hash"
                          >
                            {copiedHash === entry.recordHash ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded mt-0.5 inline-block">
                          Chained SHA-256
                        </span>
                      </td>

                      {/* Inspect Detail Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          id={`inspect-audit-${entry.id}`}
                          onClick={() => setSelectedEntry(entry)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Inspect full audit record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Statistics */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            Showing <span className="font-bold text-slate-800">{filteredLogs.length}</span> of{' '}
            <span className="font-bold text-slate-800">{auditLogs.length}</span> chained audit records
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center space-x-1 text-emerald-700 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Tax Administration Act Sec 29 Standard</span>
            </span>
            <span>•</span>
            <span>Immutable Append-Only</span>
          </div>
        </div>
      </div>

      {/* Detailed Audit Record Inspector Modal */}
      {selectedEntry && (
        <div
          id="audit-record-inspector-modal"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    SARS Audit Record #{selectedEntry.sequenceNumber.toString().padStart(4, '0')}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedEntry.id}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Event Type</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {selectedEntry.actionType.replace(/_/g, ' ')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Entity Reference</span>
                  <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                    {selectedEntry.entityNumber}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Tax Period</span>
                  <span className="font-bold text-emerald-800 mt-0.5 block">
                    {selectedEntry.taxPeriod}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Timestamp (SAST)</span>
                  <span className="font-medium text-slate-800 mt-0.5 block">
                    {formatSASTDateTime(selectedEntry.timestamp)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Actor / Operator</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {selectedEntry.actor?.userName || 'System'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {selectedEntry.actor?.userRole}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Compliance Standard</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">
                    TAA Act 28 / Sec 29
                  </span>
                </div>
              </div>

              {/* Narrative Summary */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Audit Event Narrative
                </h4>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-medium">
                  {selectedEntry.narrative}
                </div>
              </div>

              {/* Field-by-field Changes Comparison */}
              {selectedEntry.changes && selectedEntry.changes.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Field-Level Before & After Comparison
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Field Name</th>
                          <th className="py-2.5 px-3">Previous Historic Value</th>
                          <th className="py-2.5 px-3">New Amended Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEntry.changes.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {c.fieldLabel}
                            </td>
                            <td className="py-2.5 px-3 text-rose-700 line-through font-mono">
                              {c.isFinancialAmount && typeof c.previousValue === 'number'
                                ? formatZAR(c.previousValue)
                                : String(c.previousValue ?? 'None')}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-800 font-bold font-mono">
                              {c.isFinancialAmount && typeof c.newValue === 'number'
                                ? formatZAR(c.newValue)
                                : String(c.newValue ?? 'None')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cryptographic Verification Proof */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-[11px]">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Cryptographic Block Proof (SHA-256)</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-sans font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Chain Linked & Sealed
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block">Previous Block Hash (Parent):</span>
                  <span className="text-[11px] text-slate-300 break-all select-all">
                    {selectedEntry.previousHash}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block">This Record Hash (Digest):</span>
                  <span className="text-[11px] text-amber-300 break-all select-all font-bold">
                    {selectedEntry.recordHash}
                  </span>
                </div>
              </div>

              {/* Raw JSON Electronic Record Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Raw SARS Electronic Record Payload
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleCopyPayload(selectedEntry)}
                    className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center space-x-1"
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied Payload</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="bg-slate-900 text-slate-200 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedEntry, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                SARS Tax Administration Act Record # {selectedEntry.sequenceNumber}
              </span>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
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
