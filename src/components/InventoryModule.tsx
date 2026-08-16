import React, { useState } from 'react';
import {
  Package,
  AlertTriangle,
  Search,
  Plus,
  ArrowUpDown,
  History,
  TrendingDown,
  TrendingUp,
  Download,
  Filter,
  CheckCircle2,
  X,
  Edit2,
  Boxes,
  Truck,
  FileSpreadsheet,
} from 'lucide-react';
import { InventoryItem, StockTransaction, WorkshopSettings } from '../types';
import { formatZAR } from '../utils/sarsTaxEngine';

interface InventoryModuleProps {
  inventory: InventoryItem[];
  stockTransactions: StockTransaction[];
  settings: WorkshopSettings;
  onSaveItem: (item: InventoryItem) => void;
  onRecordStockAdjustment: (
    itemId: string,
    type: 'RECEIVE' | 'JOB_USE' | 'ADJUSTMENT' | 'WRITE_OFF',
    quantity: number,
    reason: string,
    unitCost?: number,
    referenceNo?: string
  ) => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  inventory = [],
  stockTransactions = [],
  settings,
  onSaveItem,
  onRecordStockAdjustment,
}) => {
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const safeStockTransactions = Array.isArray(stockTransactions) ? stockTransactions : [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'HEALTHY'>('ALL');
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');

  // Modals state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);

  // Adjustment Form State
  const [adjustType, setAdjustType] = useState<'RECEIVE' | 'JOB_USE' | 'ADJUSTMENT' | 'WRITE_OFF'>('RECEIVE');
  const [adjustQty, setAdjustQty] = useState<number>(5);
  const [adjustReason, setAdjustReason] = useState<string>('Supplier Delivery Restock');
  const [adjustUnitCost, setAdjustUnitCost] = useState<number>(0);
  const [adjustRef, setAdjustRef] = useState<string>('');

  // Item Form State
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    sku: '',
    name: '',
    category: 'Engine & Filters',
    description: '',
    stockOnHand: 10,
    minStockLevel: 5,
    costPrice: 150,
    sellingPrice: 300,
    supplier: 'Masterparts Bellville',
    binLocation: 'Shelf A-01',
    unit: 'each',
    compatibleVehicles: '',
    oemNumber: '',
  });

  // Calculate metrics
  const lowStockItems = safeInventory.filter(i => i && i.stockOnHand <= i.minStockLevel && i.stockOnHand > 0);
  const outOfStockItems = safeInventory.filter(i => i && i.stockOnHand === 0);
  const totalCostValuation = safeInventory.reduce((sum, i) => sum + (i?.stockOnHand || 0) * (i?.costPrice || 0), 0);
  const totalRetailValuation = safeInventory.reduce((sum, i) => sum + (i?.stockOnHand || 0) * (i?.sellingPrice || 0), 0);
  const totalPotentialProfit = totalRetailValuation - totalCostValuation;

  // Filtered list
  const filteredInventory = safeInventory.filter(item => {
    if (!item) return false;
    const matchesSearch =
      (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.compatibleVehicles && item.compatibleVehicles.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.oemNumber && item.oemNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

    let matchesStock = true;
    if (stockFilter === 'LOW') {
      matchesStock = item.stockOnHand <= item.minStockLevel && item.stockOnHand > 0;
    } else if (stockFilter === 'OUT') {
      matchesStock = item.stockOnHand === 0;
    } else if (stockFilter === 'HEALTHY') {
      matchesStock = item.stockOnHand > item.minStockLevel;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  const categories = [
    'ALL',
    'Brakes',
    'Engine & Filters',
    'Suspension & Steering',
    'Electrical & Lighting',
    'Fluids & Lubricants',
    'Exhaust & Cooling',
    'Tools & Consumables',
    'General Spares',
  ];

  const handleOpenNewItemModal = () => {
    setEditingItem(null);
    setFormData({
      sku: `JCW-SKU-${Date.now().toString().slice(-4)}`,
      name: '',
      category: 'Engine & Filters',
      description: '',
      stockOnHand: 5,
      minStockLevel: 3,
      costPrice: 200,
      sellingPrice: 400,
      supplier: 'Masterparts Bellville',
      binLocation: 'Shelf A-01',
      unit: 'each',
      compatibleVehicles: '',
      oemNumber: '',
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItemModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsItemModalOpen(true);
  };

  const handleSaveItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) return;

    const itemToSave: InventoryItem = {
      id: editingItem ? editingItem.id : `INV-${Date.now().toString().slice(-4)}`,
      sku: formData.sku || `SKU-${Date.now().toString().slice(-4)}`,
      name: formData.name || '',
      category: (formData.category as any) || 'General Spares',
      description: formData.description || '',
      stockOnHand: Number(formData.stockOnHand) || 0,
      minStockLevel: Number(formData.minStockLevel) || 1,
      costPrice: Number(formData.costPrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      supplier: formData.supplier || 'Masterparts Bellville',
      binLocation: formData.binLocation || 'General Bin',
      unit: formData.unit || 'each',
      lastRestocked: editingItem ? editingItem.lastRestocked : new Date().toISOString().split('T')[0],
      compatibleVehicles: formData.compatibleVehicles,
      oemNumber: formData.oemNumber,
    };

    onSaveItem(itemToSave);
    setIsItemModalOpen(false);
  };

  const handleOpenAdjustModal = (item: InventoryItem) => {
    setAdjustingItem(item);
    setAdjustType('RECEIVE');
    setAdjustQty(5);
    setAdjustUnitCost(item.costPrice);
    setAdjustReason('Stock replenishment from supplier');
    setAdjustRef('');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem || adjustQty <= 0) return;

    onRecordStockAdjustment(
      adjustingItem.id,
      adjustType,
      adjustType === 'RECEIVE' ? adjustQty : -adjustQty,
      adjustReason,
      adjustUnitCost,
      adjustRef
    );

    setIsAdjustModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & KPI Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Inventory & Real-Time Stock Management</span>
          </h1>
          <p className="text-slate-500 text-sm">
            Live auto parts catalog, stock level monitoring, supplier tracking, and valuation
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="view-reorder-po-btn"
            onClick={() => setShowReorderModal(true)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold px-3.5 py-2 rounded-xl text-sm border border-slate-700 transition-colors"
          >
            <Truck className="w-4 h-4" />
            <span>Supplier Reorder List</span>
            {lowStockItems.length + outOfStockItems.length > 0 && (
              <span className="bg-red-500 text-white font-bold text-xs px-1.5 py-0.2 rounded-full">
                {lowStockItems.length + outOfStockItems.length}
              </span>
            )}
          </button>

          <button
            id="add-new-inventory-part-btn"
            onClick={handleOpenNewItemModal}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Part</span>
          </button>
        </div>
      </div>

      {/* Stock Health Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Total Catalog SKUs</span>
            <Boxes className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{inventory.length} Parts</p>
          <span className="text-xs text-slate-500 mt-1 block">Active across {categories.length - 1} categories</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Stock Valuation (Cost)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{formatZAR(totalCostValuation)}</p>
          <span className="text-xs text-emerald-600 font-semibold mt-1 block">
            Retail potential: {formatZAR(totalRetailValuation)}
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase">
            <span>Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{lowStockItems.length} SKUs</p>
          <span className="text-xs text-slate-500 mt-1 block">Below safety thresholds</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase">
            <span>Out of Stock</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">{outOfStockItems.length} SKUs</p>
          <span className="text-xs text-slate-500 mt-1 block">Zero inventory remaining</span>
        </div>
      </div>

      {/* Main Content: Tabs & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs (Catalog vs History) */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'inventory'
                ? 'border-emerald-600 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Stock Catalog ({inventory.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'history'
                ? 'border-emerald-600 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Movement Audit History ({stockTransactions.length})</span>
          </button>
        </div>

        {activeTab === 'inventory' && (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search input */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search SKU, part name, vehicle, OEM..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Status filter pills */}
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => setStockFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    stockFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({inventory.length})
                </button>
                <button
                  onClick={() => setStockFilter('LOW')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1 ${
                    stockFilter === 'LOW'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Low Stock ({lowStockItems.length})</span>
                </button>
                <button
                  onClick={() => setStockFilter('OUT')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    stockFilter === 'OUT'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  Out of Stock ({outOfStockItems.length})
                </button>
                <button
                  onClick={() => setStockFilter('HEALTHY')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    stockFilter === 'HEALTHY'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  Healthy ({inventory.length - lowStockItems.length - outOfStockItems.length})
                </button>
              </div>
            </div>

            {/* Category horizontal selector */}
            <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Inventory Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Part Name & SKU</th>
                    <th className="py-3 px-3">Category & Location</th>
                    <th className="py-3 px-3 text-center">Stock Level</th>
                    <th className="py-3 px-3 text-right">Cost Price (ex VAT)</th>
                    <th className="py-3 px-3 text-right">Selling Price (ex VAT)</th>
                    <th className="py-3 px-3 text-right">Supplier</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInventory.map(item => {
                    const isOut = item.stockOnHand === 0;
                    const isLow = item.stockOnHand <= item.minStockLevel;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 max-w-xs">
                          <p className="font-bold text-slate-900 text-xs">{item.name}</p>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.sku}
                            </span>
                            {item.oemNumber && (
                              <span className="text-[10px] text-slate-400">OEM: {item.oemNumber}</span>
                            )}
                          </div>
                          {item.compatibleVehicles && (
                            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                              Fit: {item.compatibleVehicles}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                            {item.category}
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-1">Bin: {item.binLocation}</span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-black text-sm text-slate-900">
                              {item.stockOnHand} <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
                            </span>
                            <span className="text-[10px] text-slate-400">Min safety: {item.minStockLevel}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          {formatZAR(item.costPrice)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatZAR(item.sellingPrice)}
                          <span className="text-[10px] text-emerald-600 font-normal block">
                            +{Math.round(((item.sellingPrice - item.costPrice) / item.costPrice) * 100)}% margin
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right text-slate-600">
                          <p className="font-medium text-[11px]">{item.supplier}</p>
                          <span className="text-[10px] text-slate-400">Restocked: {item.lastRestocked}</span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          {isOut ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Healthy
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              id={`adjust-stock-${item.id}`}
                              onClick={() => handleOpenAdjustModal(item)}
                              title="Receive or Adjust Stock"
                              className="bg-amber-50 hover:bg-amber-500 hover:text-slate-950 text-amber-800 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors"
                            >
                              Receive / Adjust
                            </button>
                            <button
                              id={`edit-item-${item.id}`}
                              onClick={() => handleOpenEditItemModal(item)}
                              title="Edit Part Details"
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredInventory.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-sm">No inventory items matched your filter.</p>
                  <p className="text-xs mt-1">Try clearing search or changing the category filter.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Stock Movement Audit History */}
        {activeTab === 'history' && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Stock Movement & Usage History</h3>
                <p className="text-xs text-slate-500">Comprehensive ledger of received deliveries, job usages, and write-offs</p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Part / SKU</th>
                    <th className="py-3 px-3 text-center">Type</th>
                    <th className="py-3 px-3 text-center">Qty Change</th>
                    <th className="py-3 px-3">Reason / Details</th>
                    <th className="py-3 px-3">Reference / Order #</th>
                    <th className="py-3 px-3 text-right">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockTransactions.map(txn => (
                    <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-600">{txn.date}</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{txn.itemName}</p>
                        <span className="font-mono text-[10px] text-slate-400">{txn.sku}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            txn.type === 'RECEIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : txn.type === 'JOB_USE'
                              ? 'bg-blue-100 text-blue-800'
                              : txn.type === 'WRITE_OFF'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {txn.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        <span
                          className={txn.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}
                        >
                          {txn.quantity > 0 ? `+${txn.quantity}` : txn.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{txn.reason}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{txn.referenceNo || '-'}</td>
                      <td className="py-3 px-3 text-right text-slate-600 font-medium">{txn.recordedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Add/Edit Inventory Item */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Edit Inventory Part' : 'Add New Inventory Part'}
              </h2>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemSubmit} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Part SKU / Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="e.g. BRK-FER-020"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {categories.filter(c => c !== 'ALL').map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Part Name & Specification *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="e.g. Ferodo Front Ceramic Brake Pads (Golf 7 GTI)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Compatible Vehicles</label>
                  <input
                    type="text"
                    value={formData.compatibleVehicles}
                    onChange={e => setFormData({ ...formData, compatibleVehicles: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="e.g. Toyota Hilux 2.8 GD-6, Fortuner"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">OEM / Manufacturer Part #</label>
                  <input
                    type="text"
                    value={formData.oemNumber}
                    onChange={e => setFormData({ ...formData, oemNumber: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="e.g. 04152-YZZA6"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stock on Hand</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stockOnHand}
                    onChange={e => setFormData({ ...formData, stockOnHand: Number(e.target.value) })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Reorder Alert</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minStockLevel}
                    onChange={e => setFormData({ ...formData, minStockLevel: Number(e.target.value) })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price (ZAR ex VAT)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPrice}
                    onChange={e => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Selling (ZAR ex VAT)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sellingPrice}
                    onChange={e => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Supplier</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="e.g. Masterparts / Goldwagen"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bin / Shelf Location</label>
                  <input
                    type="text"
                    value={formData.binLocation}
                    onChange={e => setFormData({ ...formData, binLocation: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="e.g. Rack B-04"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Packaging Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="e.g. each, set, 5L"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-sm"
                >
                  {editingItem ? 'Save Part Updates' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Stock Receive & Adjustment */}
      {isAdjustModalOpen && adjustingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Stock Adjustment & Receipt</h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {adjustingItem.name} ({adjustingItem.sku})
                </p>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500">Current Stock on Hand:</span>
                  <p className="text-lg font-black text-slate-900">
                    {adjustingItem.stockOnHand} {adjustingItem.unit}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Min Level Alert:</span>
                  <p className="text-lg font-bold text-amber-600">
                    {adjustingItem.minStockLevel} {adjustingItem.unit}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('RECEIVE');
                      setAdjustReason('Stock replenishment delivery from supplier');
                    }}
                    className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-1.5 ${
                      adjustType === 'RECEIVE'
                        ? 'bg-emerald-500 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Receive / Add Stock (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('JOB_USE');
                      setAdjustReason('Direct job usage or walk-in service');
                    }}
                    className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-1.5 ${
                      adjustType === 'JOB_USE'
                        ? 'bg-blue-600 text-white border-blue-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Job Usage / Issue (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('ADJUSTMENT');
                      setAdjustReason('Stock take count audit adjustment');
                    }}
                    className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-1.5 ${
                      adjustType === 'ADJUSTMENT'
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Audit Adjustment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('WRITE_OFF');
                      setAdjustReason('Damaged / defective component write-off');
                    }}
                    className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-1.5 ${
                      adjustType === 'WRITE_OFF'
                        ? 'bg-rose-600 text-white border-rose-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Damage / Write-Off (-)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity ({adjustingItem.unit})</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustQty}
                    onChange={e => setAdjustQty(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-black text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Cost Price (ex VAT)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustUnitCost}
                    onChange={e => setAdjustUnitCost(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  placeholder="e.g. Masterparts Invoice #84920"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier PO / Ref Number</label>
                <input
                  type="text"
                  value={adjustRef}
                  onChange={e => setAdjustRef(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  placeholder="e.g. GW-DEL-9842"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-sm"
                >
                  Record Stock Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Supplier Reorder List / Purchase Order Generator */}
      {showReorderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Supplier Parts Reorder Sheet</h2>
                <p className="text-xs text-slate-500">
                  Auto-calculated order quantities based on minimum workshop safety thresholds
                </p>
              </div>
              <button
                onClick={() => setShowReorderModal(false)}
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
                      <th className="py-2.5 px-3">Part / SKU</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3 text-center">On Hand</th>
                      <th className="py-2.5 px-3 text-center">Min Level</th>
                      <th className="py-2.5 px-3 text-center">Suggested Order</th>
                      <th className="py-2.5 px-3 text-right">Est. Cost (ex VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lowStockItems.concat(outOfStockItems).map(item => {
                      const suggestedOrder = Math.max(item.minStockLevel * 2 - item.stockOnHand, 5);
                      const estimatedCost = suggestedOrder * item.costPrice;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-slate-900">{item.name}</p>
                            <span className="font-mono text-[10px] text-slate-400">{item.sku}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{item.supplier}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                            {item.stockOnHand} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500">{item.minStockLevel}</td>
                          <td className="py-2.5 px-3 text-center font-black text-amber-600 bg-amber-50 rounded">
                            {suggestedOrder} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {formatZAR(estimatedCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 font-medium">Estimated Purchase Total:</span>
                  <p className="text-lg font-black text-slate-900">
                    {formatZAR(
                      lowStockItems
                        .concat(outOfStockItems)
                        .reduce(
                          (sum, item) =>
                            sum + Math.max(item.minStockLevel * 2 - item.stockOnHand, 5) * item.costPrice,
                          0
                        )
                    )}{' '}
                    <span className="text-xs text-slate-400 font-normal">(ex VAT)</span>
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Print Reorder List</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
