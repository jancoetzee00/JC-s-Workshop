import React, { useState } from 'react';
import {
  Users,
  DollarSign,
  Download,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Eye,
  FileText,
  Edit2,
  X,
  Printer,
  ChevronRight,
  TrendingUp,
  Percent,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Employee, PayrollRecord, WorkshopSettings } from '../types';
import {
  formatZAR,
  calculateMonthlyEmployeePayroll,
  generateSarsEmp201,
  UIF_MONTHLY_CEILING,
  UIF_MAX_CONTRIBUTION,
  SARS_REBATES_2025_2026,
} from '../utils/sarsTaxEngine';
import { generatePayslipPDF } from '../utils/pdfGenerator';

interface PayrollModuleProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  settings: WorkshopSettings;
  onSaveEmployee: (employee: Employee) => void;
  onRunMonthlyPayroll: (records: PayrollRecord[]) => void;
}

export const PayrollModule: React.FC<PayrollModuleProps> = ({
  employees = [],
  payrolls = [],
  settings,
  onSaveEmployee,
  onRunMonthlyPayroll,
}) => {
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];

  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [activeTab, setActiveTab] = useState<'payroll_runs' | 'employees'>('payroll_runs');

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isRunPayrollModalOpen, setIsRunPayrollModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  // Employee Form State
  const [empFormData, setEmpFormData] = useState<Partial<Employee>>({
    fullName: '',
    employeeNumber: '',
    idNumber: '',
    taxNumber: '',
    position: 'Service Mechanic',
    email: '',
    phone: '',
    basicSalary: 20000,
    age: 35,
    medicalAidMembers: 2,
    bankName: 'First National Bank',
    accountNumber: '',
    branchCode: '250655',
    accountType: 'Cheque/Current',
    isActive: true,
  });

  // Monthly Payroll Run Form State (Custom Overtime / Bonus per staff)
  const [payrollAdjustments, setPayrollAdjustments] = useState<
    Record<string, { overtimeHours: number; bonus: number; allowances: number; notes: string }>
  >({});

  // Current Month Payrolls
  const currentMonthPayrolls = safePayrolls.filter(p => p && p.monthYear === selectedMonth);
  const emp201Summary = generateSarsEmp201(selectedMonth, safePayrolls);

  // Totals for this month
  const totalGrossSalaries = currentMonthPayrolls.reduce((sum, p) => sum + (p?.grossIncome || 0), 0);
  const totalNetTakeHome = currentMonthPayrolls.reduce((sum, p) => sum + (p?.netPay || 0), 0);
  const totalSarsPaye = currentMonthPayrolls.reduce((sum, p) => sum + (p?.sarsPayeMonthly || 0), 0);
  const totalUif = currentMonthPayrolls.reduce((sum, p) => sum + (p?.uifEmployee || 0) + (p?.uifEmployer || 0), 0);
  const totalSdl = currentMonthPayrolls.reduce((sum, p) => sum + (p?.sdlEmployer || 0), 0);
  const totalEmployerEmploymentCost = currentMonthPayrolls.reduce((sum, p) => sum + (p?.totalEmployerCost || 0), 0);

  // Handlers
  const handleOpenAddEmployee = () => {
    setEditingEmployee(null);
    setEmpFormData({
      fullName: '',
      employeeNumber: `JCW-${(safeEmployees.length + 1).toString().padStart(2, '0')}`,
      idNumber: '',
      taxNumber: '',
      position: 'Service Mechanic',
      email: '',
      phone: '',
      basicSalary: 18000,
      age: 30,
      medicalAidMembers: 1,
      bankName: 'Capitec Bank',
      accountNumber: '',
      branchCode: '470010',
      accountType: 'Savings',
      isActive: true,
    });
    setIsEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpFormData({ ...emp });
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empFormData.fullName || !empFormData.idNumber) return;

    const empToSave: Employee = {
      id: editingEmployee ? editingEmployee.id : `EMP-${Date.now().toString().slice(-4)}`,
      fullName: empFormData.fullName || '',
      employeeNumber: empFormData.employeeNumber || `JCW-0${employees.length + 1}`,
      idNumber: empFormData.idNumber || '',
      taxNumber: empFormData.taxNumber || '',
      position: (empFormData.position as any) || 'Service Mechanic',
      email: empFormData.email || '',
      phone: empFormData.phone || '',
      hireDate: editingEmployee ? editingEmployee.hireDate : new Date().toISOString().split('T')[0],
      basicSalary: Number(empFormData.basicSalary) || 0,
      standardHoursPerWeek: 40,
      age: Number(empFormData.age) || 30,
      medicalAidMembers: Number(empFormData.medicalAidMembers) || 0,
      bankName: empFormData.bankName || 'FNB',
      accountNumber: empFormData.accountNumber || '',
      branchCode: empFormData.branchCode || '250655',
      accountType: (empFormData.accountType as any) || 'Cheque/Current',
      isActive: true,
    };

    onSaveEmployee(empToSave);
    setIsEmployeeModalOpen(false);
  };

  const handleOpenRunPayroll = () => {
    // Initialize adjustments map
    const initialAdj: Record<string, { overtimeHours: number; bonus: number; allowances: number; notes: string }> = {};
    employees.forEach(emp => {
      initialAdj[emp.id] = {
        overtimeHours: emp.position.includes('Technician') || emp.position.includes('Mechanic') ? 6 : 0,
        bonus: 0,
        allowances: emp.position.includes('Technician') ? 750 : 0,
        notes: 'Monthly workshop salary & statutory payroll',
      };
    });
    setPayrollAdjustments(initialAdj);
    setIsRunPayrollModalOpen(true);
  };

  const handleExecutePayrollRun = () => {
    const generated: PayrollRecord[] = [];

    employees.filter(e => e.isActive).forEach(emp => {
      const adj = payrollAdjustments[emp.id] || { overtimeHours: 0, bonus: 0, allowances: 0, notes: '' };
      const hourlyRate = (emp.basicSalary / 160) * 1.5; // 1.5x Overtime rate

      const record = calculateMonthlyEmployeePayroll(
        emp,
        selectedMonth,
        adj.overtimeHours,
        hourlyRate,
        adj.bonus,
        adj.allowances,
        0,
        adj.notes
      );
      generated.push(record);
    });

    onRunMonthlyPayroll(generated);
    setIsRunPayrollModalOpen(false);

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleDownloadPayslipPDF = (record: PayrollRecord) => {
    const doc = generatePayslipPDF(record, settings);
    doc.save(`Payslip_${record.employeeNumber}_${record.employeeName.replace(/\s+/g, '_')}_${record.monthYear}.pdf`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Monthly Workshop Payroll & SARS PAYE</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              SARS 2025/26 Engine
            </span>
          </h1>
          <p className="text-slate-500 text-sm">
            Accurate monthly remuneration, PAYE tax brackets, UIF ceiling, SDL, and confidential payslips
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Month Selector */}
          <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="font-bold text-slate-800 bg-transparent focus:outline-none"
            >
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
              <option value="2026-06">June 2026</option>
              <option value="2026-05">May 2026</option>
            </select>
          </div>

          <button
            id="run-monthly-payroll-btn"
            onClick={handleOpenRunPayroll}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-sm active:scale-95"
          >
            <Clock className="w-4 h-4" />
            <span>Process {selectedMonth} Payroll</span>
          </button>
        </div>
      </div>

      {/* Statutory SARS EMP201 Summary Highlight Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Monthly SARS EMP201 Statutory Return
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              SARS PAYE Reference: <span className="font-mono text-slate-200">{settings.sarsPayeNumber}</span> | Due by 7th of the following month
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Total Monthly EMP201 Payable to SARS:</span>
            <p className="text-2xl font-black text-emerald-400 font-mono">
              {formatZAR(emp201Summary.totalEmp201Payable)}
            </p>
          </div>
        </div>

        {/* Metric Cards inside banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[11px]">Total PAYE Withheld:</span>
            <p className="text-base font-mono font-bold text-white mt-1">
              {formatZAR(emp201Summary.totalPayeWithheld)}
            </p>
            <span className="text-[10px] text-slate-500">From employee taxable gross</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[11px]">Total UIF (2%):</span>
            <p className="text-base font-mono font-bold text-white mt-1">
              {formatZAR(emp201Summary.totalUifContribution)}
            </p>
            <span className="text-[10px] text-slate-500">1% employee + 1% employer</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[11px]">SDL Levy (1%):</span>
            <p className="text-base font-mono font-bold text-white mt-1">
              {formatZAR(emp201Summary.totalSdlLevy)}
            </p>
            <span className="text-[10px] text-slate-500">Skills development fund</span>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[11px]">Net Salaries Paid (EFT):</span>
            <p className="text-base font-mono font-bold text-emerald-400 mt-1">
              {formatZAR(totalNetTakeHome)}
            </p>
            <span className="text-[10px] text-slate-500">Take-home staff pay</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 justify-between items-center">
          <div className="flex">
            <button
              onClick={() => setActiveTab('payroll_runs')}
              className={`py-3 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
                activeTab === 'payroll_runs'
                  ? 'border-emerald-600 text-slate-900 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{selectedMonth} Payroll Runs ({currentMonthPayrolls.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`py-3 px-5 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
                activeTab === 'employees'
                  ? 'border-emerald-600 text-slate-900 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Workshop Staff Roster ({employees.length})</span>
            </button>
          </div>

          {activeTab === 'employees' && (
            <button
              onClick={handleOpenAddEmployee}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff Member</span>
            </button>
          )}
        </div>

        {/* Tab 1: Current Month Payroll Runs & Payslip Actions */}
        {activeTab === 'payroll_runs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-4 text-right">Basic Salary</th>
                  <th className="py-3 px-4 text-right">Gross Earnings</th>
                  <th className="py-3 px-4 text-right">SARS PAYE</th>
                  <th className="py-3 px-4 text-right">UIF (1%)</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900">Net Take-Home</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentMonthPayrolls.map(pay => (
                  <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 text-xs">{pay.employeeName}</p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>{pay.employeeNumber}</span>
                        <span>•</span>
                        <span>ID: {pay.idNumber.substring(0, 6)}...</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {pay.position}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatZAR(pay.basicSalary)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                      {formatZAR(pay.grossIncome)}
                      {pay.overtimePay > 0 && (
                        <span className="text-[10px] text-emerald-600 block">
                          +{formatZAR(pay.overtimePay)} OT
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-rose-700 font-semibold">
                      - {formatZAR(pay.sarsPayeMonthly)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      - {formatZAR(pay.uifEmployee)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-sm text-emerald-600">
                      {formatZAR(pay.netPay)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {pay.paymentStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          id={`download-payslip-pdf-${pay.id}`}
                          onClick={() => handleDownloadPayslipPDF(pay)}
                          title="Download SARS Compliant Payslip PDF"
                          className="bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>

                        <button
                          onClick={() => setSelectedPayslip(pay)}
                          title="View Itemized Payslip"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {currentMonthPayrolls.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold">No payroll records processed for {selectedMonth}.</p>
                <button
                  onClick={handleOpenRunPayroll}
                  className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Run {selectedMonth} Payroll Now
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Workshop Staff Roster */}
        {activeTab === 'employees' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Staff Member & Emp #</th>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-4">SA ID & Tax Ref</th>
                  <th className="py-3 px-4 text-right">Basic Monthly Salary</th>
                  <th className="py-3 px-4 text-center">Medical Aid Dep</th>
                  <th className="py-3 px-4">Banking Details</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 text-xs">{emp.fullName}</p>
                      <span className="font-mono text-[10px] text-slate-400">{emp.employeeNumber}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {emp.position}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      <p>ID: {emp.idNumber}</p>
                      <p className="text-[10px] text-slate-400">SARS Ref: {emp.taxNumber}</p>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatZAR(emp.basicSalary)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {emp.medicalAidMembers} Member(s)
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 text-[11px]">
                      <p className="font-semibold">{emp.bankName}</p>
                      <p className="font-mono text-slate-400">
                        {emp.accountNumber} ({emp.branchCode})
                      </p>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEditEmployee(emp)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {employees.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm">No workshop staff members registered yet.</p>
                <p className="text-xs text-slate-400 mt-1 mb-3">Add mechanics, technicians, and apprentices to process SARS EMP201 payroll.</p>
                <button
                  onClick={handleOpenAddEmployee}
                  className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register First Employee</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal 1: Process Monthly Payroll Run Wizard */}
      {isRunPayrollModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Process Monthly Payroll Run: {selectedMonth}
                </h2>
                <p className="text-xs text-slate-500">
                  Review hours, overtime, and allowances before calculating SARS statutory deductions
                </p>
              </div>
              <button
                onClick={() => setIsRunPayrollModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Staff Member</th>
                      <th className="p-3 text-right">Basic Salary</th>
                      <th className="p-3 text-center">Overtime (Hrs)</th>
                      <th className="p-3 text-right">Bonus (ZAR)</th>
                      <th className="p-3 text-right">Allowances</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employees.filter(e => e.isActive).map(emp => {
                      const adj = payrollAdjustments[emp.id] || { overtimeHours: 0, bonus: 0, allowances: 0, notes: '' };

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{emp.fullName}</p>
                            <span className="text-[10px] text-slate-400">{emp.position}</span>
                          </td>

                          <td className="p-3 text-right font-mono font-semibold text-slate-800">
                            {formatZAR(emp.basicSalary)}
                          </td>

                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="0"
                              value={adj.overtimeHours}
                              onChange={e =>
                                setPayrollAdjustments({
                                  ...payrollAdjustments,
                                  [emp.id]: { ...adj, overtimeHours: Number(e.target.value) },
                                })
                              }
                              className="w-16 p-1.5 bg-slate-50 border border-slate-300 rounded text-center font-bold"
                            />
                          </td>

                          <td className="p-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={adj.bonus}
                              onChange={e =>
                                setPayrollAdjustments({
                                  ...payrollAdjustments,
                                  [emp.id]: { ...adj, bonus: Number(e.target.value) },
                                })
                              }
                              className="w-24 p-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-right"
                              placeholder="0.00"
                            />
                          </td>

                          <td className="p-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={adj.allowances}
                              onChange={e =>
                                setPayrollAdjustments({
                                  ...payrollAdjustments,
                                  [emp.id]: { ...adj, allowances: Number(e.target.value) },
                                })
                              }
                              className="w-24 p-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-right"
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-emerald-950 text-xs">SARS Calculation Engine Ready</h4>
                  <p className="text-[11px] text-emerald-700">
                    Will calculate SARS PAYE with primary rebate (R17,235), Medical credits, and 1% UIF ceiling (R177.12)
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsRunPayrollModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl font-semibold bg-white text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePayrollRun}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm"
                  >
                    Confirm & Run Monthly Payroll
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Add / Edit Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingEmployee ? 'Edit Staff Member' : 'Register New Employee'}
              </h2>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployeeSubmit} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={empFormData.fullName}
                    onChange={e => setEmpFormData({ ...empFormData, fullName: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="e.g. Sipho Ndlovu"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Number</label>
                  <input
                    type="text"
                    required
                    value={empFormData.employeeNumber}
                    onChange={e => setEmpFormData({ ...empFormData, employeeNumber: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                    placeholder="JCW-01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">South African ID Number *</label>
                  <input
                    type="text"
                    required
                    value={empFormData.idNumber}
                    onChange={e => setEmpFormData({ ...empFormData, idNumber: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    placeholder="13-digit ID"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SARS Tax Reference Number</label>
                  <input
                    type="text"
                    value={empFormData.taxNumber}
                    onChange={e => setEmpFormData({ ...empFormData, taxNumber: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    placeholder="10-digit Tax No"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Workshop Position *</label>
                  <select
                    value={empFormData.position}
                    onChange={e => setEmpFormData({ ...empFormData, position: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="Senior Master Technician">Senior Master Technician</option>
                    <option value="Diagnostic Specialist">Diagnostic Specialist</option>
                    <option value="Auto Electrician">Auto Electrician</option>
                    <option value="Service Mechanic">Service Mechanic</option>
                    <option value="Apprentice / Assistant">Apprentice / Assistant</option>
                    <option value="Workshop Manager">Workshop Manager</option>
                    <option value="Admin & Accounts">Admin & Accounts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Basic Monthly Salary (ZAR) *</label>
                  <input
                    type="number"
                    step="100"
                    min="1000"
                    required
                    value={empFormData.basicSalary}
                    onChange={e => setEmpFormData({ ...empFormData, basicSalary: Number(e.target.value) })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Medical Aid Members</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={empFormData.medicalAidMembers}
                    onChange={e => setEmpFormData({ ...empFormData, medicalAidMembers: Number(e.target.value) })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Banking Details */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Salary Banking Details (EFT)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Bank Name</label>
                    <input
                      type="text"
                      value={empFormData.bankName}
                      onChange={e => setEmpFormData({ ...empFormData, bankName: e.target.value })}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Account Number</label>
                    <input
                      type="text"
                      value={empFormData.accountNumber}
                      onChange={e => setEmpFormData({ ...empFormData, accountNumber: e.target.value })}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Branch Code</label>
                    <input
                      type="text"
                      value={empFormData.branchCode}
                      onChange={e => setEmpFormData({ ...empFormData, branchCode: e.target.value })}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-sm"
                >
                  {editingEmployee ? 'Save Staff Updates' : 'Register Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Itemized Payslip Viewer */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900">Confidential Employee Payslip</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadPayslipPDF(selectedPayslip)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Payslip Document Box */}
            <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 space-y-5 text-xs">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-base font-black text-slate-900 uppercase">{settings.workshopName}</h1>
                  <p className="text-slate-500">PAYE Ref: {settings.sarsPayeNumber} | UIF Ref: {settings.uifNumber}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-emerald-700 block">MONTHLY PAYSLIP</span>
                  <p className="font-bold text-slate-900">{selectedPayslip.monthYear}</p>
                </div>
              </div>

              {/* Staff Details */}
              <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-200 text-slate-700">
                <div>
                  <p><span className="font-semibold text-slate-500">Name:</span> {selectedPayslip.employeeName}</p>
                  <p><span className="font-semibold text-slate-500">Emp #:</span> {selectedPayslip.employeeNumber}</p>
                  <p><span className="font-semibold text-slate-500">Position:</span> {selectedPayslip.position}</p>
                </div>
                <div>
                  <p><span className="font-semibold text-slate-500">ID No:</span> {selectedPayslip.idNumber}</p>
                  <p><span className="font-semibold text-slate-500">SARS Tax #:</span> {selectedPayslip.taxNumber}</p>
                  <p><span className="font-semibold text-slate-500">Payment:</span> {selectedPayslip.paymentMethod} ({selectedPayslip.paymentDate})</p>
                </div>
              </div>

              {/* Earnings Table */}
              <div className="space-y-1">
                <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-700">Gross Earnings</h4>
                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                  <div className="p-2.5 flex justify-between">
                    <span>Basic Monthly Salary</span>
                    <span className="font-mono font-semibold">{formatZAR(selectedPayslip.basicSalary)}</span>
                  </div>
                  {selectedPayslip.overtimePay > 0 && (
                    <div className="p-2.5 flex justify-between text-emerald-700">
                      <span>Overtime ({selectedPayslip.overtimeHours} hrs @ {formatZAR(selectedPayslip.overtimeRatePerHour)}/hr)</span>
                      <span className="font-mono font-semibold">{formatZAR(selectedPayslip.overtimePay)}</span>
                    </div>
                  )}
                  {selectedPayslip.allowances > 0 && (
                    <div className="p-2.5 flex justify-between">
                      <span>Allowances (Tools / Travel)</span>
                      <span className="font-mono font-semibold">{formatZAR(selectedPayslip.allowances)}</span>
                    </div>
                  )}
                  <div className="p-2.5 flex justify-between bg-slate-50 font-bold text-slate-900">
                    <span>TOTAL GROSS REMUNERATION</span>
                    <span className="font-mono">{formatZAR(selectedPayslip.grossIncome)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Table */}
              <div className="space-y-1">
                <h4 className="font-bold text-[11px] uppercase tracking-wider text-rose-700">Statutory SARS Deductions</h4>
                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                  <div className="p-2.5 flex justify-between">
                    <span>SARS PAYE (Monthly Withholding)</span>
                    <span className="font-mono text-rose-700 font-semibold">- {formatZAR(selectedPayslip.sarsPayeMonthly)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>UIF (Employee 1% contribution)</span>
                    <span className="font-mono text-rose-700 font-semibold">- {formatZAR(selectedPayslip.uifEmployee)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between bg-rose-50/50 font-bold text-rose-800">
                    <span>TOTAL DEDUCTIONS</span>
                    <span className="font-mono">- {formatZAR(selectedPayslip.totalEmployeeDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Highlight */}
              <div className="bg-emerald-100/60 border-2 border-emerald-500 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm font-black text-emerald-950 uppercase">NET TAKE-HOME SALARY</span>
                <span className="text-xl font-black text-emerald-800 font-mono">
                  {formatZAR(selectedPayslip.netPay)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
