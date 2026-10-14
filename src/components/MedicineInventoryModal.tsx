import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Package,
  AlertTriangle,
  Clock,
  Plus,
  History,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { pharmacyStore } from '../services/pharmacyStore';
import { formatINR } from '../utils/currency';
import type { MedicineItem, StockMovement, MedicineBatch } from '../types/icu';

interface MedicineInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOrders?: () => void;
}

export const MedicineInventoryModal: React.FC<MedicineInventoryModalProps> = ({
  isOpen,
  onClose,
  onOpenOrders,
}) => {
  const [inventory, setInventory] = useState<MedicineItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements' | 'add'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStockStatus, setFilterStockStatus] = useState<string>('ALL');

  // New batch form state
  const [selectedMedForBatch, setSelectedMedForBatch] = useState<string | null>(null);
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newBatchQty, setNewBatchQty] = useState<number>(50);
  const [newBatchExpiry, setNewBatchExpiry] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New medicine form state
  const [newMedName, setNewMedName] = useState('');
  const [newMedGeneric, setNewMedGeneric] = useState('');
  const [newMedStrength, setNewMedStrength] = useState('');
  const [newMedForm, setNewMedForm] = useState<MedicineItem['dosageForm']>('Tablet');
  const [newMedCategory, setNewMedCategory] = useState<MedicineItem['category']>('Analgesic');
  const [newMedThreshold, setNewMedThreshold] = useState<number>(50);
  const [newMedPrice, setNewMedPrice] = useState<number>(5.0);
  const [newMedSupplier, setNewMedSupplier] = useState('Standard Pharma Logistics Ltd');

  useEffect(() => {
    if (!isOpen) return;
    setInventory(pharmacyStore.getInventory());
    setMovements(pharmacyStore.getStockMovements());

    const unsubscribe = pharmacyStore.subscribe(() => {
      setInventory(pharmacyStore.getInventory());
      setMovements(pharmacyStore.getStockMovements());
    });
    return unsubscribe;
  }, [isOpen]);

  if (!isOpen) return null;

  // Filtered inventory
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.genericName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.batches.some((b) => b.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
    const matchesStatus =
      filterStockStatus === 'ALL' ||
      (filterStockStatus === 'LOW_STOCK' && (item.stockStatus === 'LOW_STOCK' || item.stockStatus === 'OUT_OF_STOCK')) ||
      (filterStockStatus === 'EXPIRING' && item.batches.some((b) => b.isExpiringSoon || b.isExpired));

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const lowStockCount = inventory.filter((m) => m.stockStatus === 'LOW_STOCK' || m.stockStatus === 'OUT_OF_STOCK').length;
  const expiringCount = inventory.flatMap((m) => m.batches).filter((b) => b.isExpiringSoon).length;
  const expiredCount = inventory.flatMap((m) => m.batches).filter((b) => b.isExpired).length;

  const handleAddBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedForBatch || !newBatchNumber.trim() || !newBatchExpiry) {
      setFeedbackMsg({ type: 'error', text: 'Please fill in Batch Number and Expiry Date.' });
      return;
    }

    const batchObj: MedicineBatch = {
      batchNumber: newBatchNumber.trim().toUpperCase(),
      quantity: Number(newBatchQty),
      initialQuantity: Number(newBatchQty),
      expiryDate: newBatchExpiry,
      receivedDate: new Date().toISOString().split('T')[0],
    };

    const success = pharmacyStore.addBatch(selectedMedForBatch, batchObj, 'Pharm. Rajesh Rao');
    if (success) {
      setFeedbackMsg({ type: 'success', text: `Successfully registered Batch ${batchObj.batchNumber} with ${batchObj.quantity} units.` });
      setSelectedMedForBatch(null);
      setNewBatchNumber('');
      setNewBatchExpiry('');
    } else {
      setFeedbackMsg({ type: 'error', text: 'Failed to add batch.' });
    }
  };

  const handleCreateMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim() || !newMedGeneric.trim() || !newMedStrength.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Please provide Medicine Name, Generic Name, and Strength.' });
      return;
    }

    const newMed = pharmacyStore.addMedicine({
      id: `MED-${newMedName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}`,
      name: newMedName.trim(),
      genericName: newMedGeneric.trim(),
      strength: newMedStrength.trim(),
      dosageForm: newMedForm,
      category: newMedCategory,
      minimumStockThreshold: Number(newMedThreshold),
      unitPrice: Number(newMedPrice),
      supplier: {
        name: newMedSupplier,
        contact: 'support@hospital-pharma.org',
        leadTimeDays: 2,
      },
      batches: [],
      isSyntheticDemo: true,
      notes: 'Added via Authorised Pharmacy Terminal',
    });

    setFeedbackMsg({ type: 'success', text: `Created ${newMed.name} (${newMed.strength}). You can now add inventory batches.` });
    setNewMedName('');
    setNewMedGeneric('');
    setNewMedStrength('');
    setActiveTab('inventory');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Hospital Medicine Inventory & Pharmacy Terminal
                </h3>
                <span className="text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
                  DEMO SYNTHETIC STOCK
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Authorised Formulary, Batch Expiry Tracking, and Dispensing Verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenOrders && (
              <button
                onClick={onOpenOrders}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors font-mono"
              >
                View Connected Orders
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-bar KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:px-5 bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 font-mono text-xs">
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Formulary Medicines</span>
            <span className="font-black text-slate-900 dark:text-slate-100 text-sm">{inventory.length} items</span>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
            </span>
            <span className="font-black text-amber-600 dark:text-amber-400 text-sm">{lowStockCount}</span>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Expiring &lt;30d
            </span>
            <span className="font-black text-orange-600 dark:text-orange-400 text-sm">{expiringCount}</span>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Blocked (Expired)
            </span>
            <span className="font-black text-red-600 dark:text-red-400 text-sm">{expiredCount} batches</span>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-2 gap-4 text-xs font-bold font-mono">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'inventory'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Package className="w-3.5 h-3.5" /> Medicine Stock & Batches
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'movements'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Stock Movement Audit ({movements.length})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'add'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Register New Medicine
          </button>
        </div>

        {feedbackMsg && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl text-xs font-mono flex items-center justify-between ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="text-xs font-bold underline ml-2">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 1: Inventory List */}
        {activeTab === 'inventory' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Search and filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search medicine, generic name, or batch # (e.g. Paracetamol, Ceftriaxone, PCM-2026)..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
              >
                <option value="ALL">All Categories</option>
                <option value="Antibiotic">Antibiotic</option>
                <option value="Analgesic">Analgesic</option>
                <option value="Antihistamine">Antihistamine</option>
                <option value="Electrolyte/Fluid">Electrolyte/Fluid</option>
                <option value="Cardiovascular">Cardiovascular</option>
                <option value="Gastrointestinal">Gastrointestinal</option>
                <option value="Diuretic">Diuretic</option>
              </select>

              <select
                value={filterStockStatus}
                onChange={(e) => setFilterStockStatus(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
              >
                <option value="ALL">All Stock Statuses</option>
                <option value="LOW_STOCK">Low / Out of Stock</option>
                <option value="EXPIRING">Expiring / Expired</option>
              </select>
            </div>

            {/* Inventory cards */}
            <div className="space-y-3">
              {filteredInventory.map((med) => (
                <div
                  key={med.id}
                  className="p-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 dark:text-slate-100 text-sm">{med.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">({med.genericName})</span>
                        <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 font-bold">
                          {med.strength} • {med.dosageForm}
                        </span>
                        <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                          {med.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Supplier: <span className="font-semibold">{med.supplier.name}</span> • Lead time: {med.supplier.leadTimeDays}d • Unit Price: {formatINR(med.unitPrice)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <span className="text-xs text-slate-400 block">Available Valid Stock</span>
                        <span
                          className={`text-base font-black ${
                            med.totalAvailableQuantity <= med.minimumStockThreshold
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {med.totalAvailableQuantity} units
                        </span>
                        <span className="text-[10px] text-slate-400 block">Min Threshold: {med.minimumStockThreshold}</span>
                      </div>

                      <button
                        onClick={() => setSelectedMedForBatch(selectedMedForBatch === med.id ? null : med.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold font-mono transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Batch
                      </button>
                    </div>
                  </div>

                  {/* Inline Add Batch drawer */}
                  {selectedMedForBatch === med.id && (
                    <form onSubmit={handleAddBatch} className="p-3 bg-slate-50 dark:bg-slate-900/90 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Add Restock Batch:</span>
                      <input
                        type="text"
                        value={newBatchNumber}
                        onChange={(e) => setNewBatchNumber(e.target.value)}
                        placeholder="Batch # (e.g. B26-102)"
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs"
                        required
                      />
                      <input
                        type="number"
                        value={newBatchQty}
                        onChange={(e) => setNewBatchQty(Number(e.target.value))}
                        placeholder="Qty"
                        min="1"
                        className="w-20 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs"
                        required
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Exp:</span>
                        <input
                          type="date"
                          value={newBatchExpiry}
                          onChange={(e) => setNewBatchExpiry(e.target.value)}
                          className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs transition-colors"
                      >
                        Confirm Restock
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMedForBatch(null)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                      >
                        Cancel
                      </button>
                    </form>
                  )}

                  {/* Batch breakdown table */}
                  <div className="border border-slate-100 dark:border-slate-700/60 rounded-lg overflow-hidden font-mono text-xs">
                    <div className="bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 grid grid-cols-5">
                      <span>Batch Identifier</span>
                      <span>Stock Quantity</span>
                      <span>Expiry Date</span>
                      <span>Batch Health / Warnings</span>
                      <span className="text-right">Dispense Status</span>
                    </div>

                    {med.batches.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">No batches registered yet. Click &quot;Add Batch&quot; above.</div>
                    ) : (
                      med.batches.map((b) => (
                        <div
                          key={b.batchNumber}
                          className={`px-3 py-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-5 items-center ${
                            b.isExpired ? 'bg-red-50/40 dark:bg-red-950/20' : b.isExpiringSoon ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                          }`}
                        >
                          <span className="font-bold text-slate-800 dark:text-slate-200">{b.batchNumber}</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{b.quantity} units</span>
                          <span className="text-slate-600 dark:text-slate-300">{b.expiryDate}</span>
                          <div>
                            {b.isExpired ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded border border-red-200 dark:border-red-900">
                                <ShieldAlert className="w-3 h-3" /> EXPIRED
                              </span>
                            ) : b.isExpiringSoon ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                                <Clock className="w-3 h-3" /> Expiring &lt;30d
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                                Valid
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            {b.isExpired ? (
                              <span className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-tight">
                                BLOCKED (Expired)
                              </span>
                            ) : b.quantity === 0 ? (
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Depleted</span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                                Available for Dispensing
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Stock Movements Audit */}
        {activeTab === 'movements' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300">Auditable Stock Movement Ledger</span>
              <span className="text-[11px] text-slate-400">Total Recorded Actions: {movements.length}</span>
            </div>

            {movements.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                No stock movements logged yet.
              </div>
            ) : (
              <div className="space-y-2">
                {movements.map((mov) => (
                  <div
                    key={mov.id}
                    className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          mov.type === 'RESTOCK'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {mov.type === 'RESTOCK' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-slate-100">{mov.medicineName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-bold">
                            Batch {mov.batchNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              mov.type === 'RESTOCK'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                            }`}
                          >
                            {mov.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {mov.notes} • Authorized: {mov.performedBy}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-sm font-black ${
                          mov.quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity} units
                      </span>
                      <span className="text-[10px] text-slate-400 block">{mov.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Register New Medicine */}
        {activeTab === 'add' && (
          <form onSubmit={handleCreateMedicine} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 max-w-2xl font-mono text-xs">
            <div className="space-y-1">
              <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm">Register New Formulary Medicine</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                Creates a new clinical entity in the hospital pharmacy database. Batches can be assigned after creation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Brand Name *</label>
                <input
                  type="text"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  placeholder="e.g. Ceftriaxone, Normal Saline"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Generic / Scientific Name *</label>
                <input
                  type="text"
                  value={newMedGeneric}
                  onChange={(e) => setNewMedGeneric(e.target.value)}
                  placeholder="e.g. Ceftriaxone Sodium, 0.9% NaCl"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Strength *</label>
                <input
                  type="text"
                  value={newMedStrength}
                  onChange={(e) => setNewMedStrength(e.target.value)}
                  placeholder="e.g. 1 g, 500 mg, 500 ml"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Dosage Form</label>
                <select
                  value={newMedForm}
                  onChange={(e) => setNewMedForm(e.target.value as MedicineItem['dosageForm'])}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="Tablet">Tablet</option>
                  <option value="Capsule">Capsule</option>
                  <option value="IV Infusion">IV Infusion</option>
                  <option value="IV Injection">IV Injection</option>
                  <option value="Vial">Vial</option>
                  <option value="Ampoule">Ampoule</option>
                  <option value="Sachet">Sachet</option>
                  <option value="Oral Solution">Oral Solution</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Therapeutic Category</label>
                <select
                  value={newMedCategory}
                  onChange={(e) => setNewMedCategory(e.target.value as MedicineItem['category'])}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="Antibiotic">Antibiotic</option>
                  <option value="Analgesic">Analgesic</option>
                  <option value="Antihistamine">Antihistamine</option>
                  <option value="Electrolyte/Fluid">Electrolyte/Fluid</option>
                  <option value="Cardiovascular">Cardiovascular</option>
                  <option value="Gastrointestinal">Gastrointestinal</option>
                  <option value="Diuretic">Diuretic</option>
                  <option value="Respiratory">Respiratory</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Min. Stock Alert Threshold</label>
                <input
                  type="number"
                  value={newMedThreshold}
                  onChange={(e) => setNewMedThreshold(Number(e.target.value))}
                  min="5"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Hospital Unit Charge (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newMedPrice}
                  onChange={(e) => setNewMedPrice(Number(e.target.value))}
                  min="0.1"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Supplier / Manufacturer</label>
                <input
                  type="text"
                  value={newMedSupplier}
                  onChange={(e) => setNewMedSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Register Medicine Entity
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
