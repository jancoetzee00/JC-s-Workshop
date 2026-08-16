import React, { useState } from 'react';
import {
  Wrench,
  LayoutDashboard,
  Package,
  FileText,
  Users,
  DollarSign,
  UserCheck,
  ShieldCheck,
  Settings,
  Plus,
  Menu,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { NavigationTab, WorkshopSettings } from '../types';
import { getNextSarsDeadline } from '../utils/sarsTaxEngine';

interface NavbarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  lowStockCount: number;
  unpaidInvoicesCount?: number;
  settings: WorkshopSettings;
  onQuickNewInvoice?: () => void;
  onQuickNewQuote?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  lowStockCount,
  unpaidInvoicesCount = 0,
  settings,
  onQuickNewInvoice,
  onQuickNewQuote,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Compute live next SARS filing deadline (VAT201 vs EMP201 vs IRP6)
  const nextDeadline = getNextSarsDeadline();

  // Determine badge color style depending on days remaining
  const sarsBadgeColor =
    nextDeadline.urgency === 'CRITICAL'
      ? 'bg-rose-500 text-white font-bold animate-pulse'
      : nextDeadline.urgency === 'WARNING'
      ? 'bg-amber-400 text-slate-950 font-bold'
      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';

  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'inventory' as NavigationTab,
      label: 'Inventory',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null,
      badgeColor: 'bg-red-500 text-white',
    },
    {
      id: 'payroll' as NavigationTab,
      label: 'Payroll & PAYE',
      icon: Users,
      badge: null,
    },
    {
      id: 'finances' as NavigationTab,
      label: 'Financial Reports',
      icon: DollarSign,
      badge: null,
    },
    {
      id: 'quotes_invoices' as NavigationTab,
      label: 'Quotes & Invoices',
      icon: FileText,
      badge: unpaidInvoicesCount > 0 ? `${unpaidInvoicesCount}` : null,
      badgeColor: 'bg-amber-500 text-slate-950',
    },
    {
      id: 'sars_tax' as NavigationTab,
      label: 'SARS Tax Center',
      icon: ShieldCheck,
      badge: nextDeadline.badgeText,
      badgeColor: sarsBadgeColor,
    },
    {
      id: 'client_portal' as NavigationTab,
      label: 'Client Portal',
      icon: UserCheck,
      badge: null,
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Top Navbar */}
      <div className="lg:hidden bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-2.5" onClick={() => setActiveTab('dashboard')}>
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-sm shadow-sm">
            JC
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-emerald-400 leading-tight">
              JC'S WORKSHOP
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
              Inventory & Payroll
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onQuickNewInvoice && (
            <button
              onClick={onQuickNewInvoice}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Invoice</span>
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 text-white border-b border-slate-800 p-4 space-y-1 z-30">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-md flex items-center space-x-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      item.badgeColor || 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-800">
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase font-semibold mb-1">
                SARS Compliance
              </p>
              <div className="flex items-center justify-between text-xs text-emerald-400">
                <span>VAT Status</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 rounded font-medium">Current (15%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-white flex-col shrink-0 min-h-screen border-r border-slate-800 select-none">
        {/* Brand Header */}
        <div
          className="p-6 border-b border-slate-800 cursor-pointer"
          onClick={() => setActiveTab('dashboard')}
        >
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-emerald-400">
              JC'S WORKSHOP
            </h1>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-medium">
            Inventory & Payroll
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2 rounded-md flex items-center space-x-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-auto ${
                      isActive ? 'bg-white text-emerald-800' : item.badgeColor || 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom SARS Compliance Status Widget */}
        <div 
          onClick={() => setActiveTab('sars_tax')}
          className="p-4 bg-slate-950/70 m-4 rounded-lg border border-slate-800 space-y-2.5 cursor-pointer hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              SARS Next Filing
            </p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                nextDeadline.urgency === 'CRITICAL'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : nextDeadline.urgency === 'WARNING'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}
            >
              {nextDeadline.daysRemaining >= 0
                ? `${nextDeadline.daysRemaining} days left`
                : 'Overdue'}
            </span>
          </div>

          <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">{nextDeadline.shortLabel}</span>
              <span className="text-emerald-400 font-mono font-semibold text-[11px]">
                {nextDeadline.formattedDueDate}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {nextDeadline.periodDescription}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>VAT 15% Registered</span>
            <span className="text-emerald-400 font-medium">Compliant</span>
          </div>
        </div>
      </aside>
    </>
  );
};
