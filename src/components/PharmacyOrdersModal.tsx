import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Filter,
  Send
} from 'lucide-react';
import { pharmacyStore } from '../services/pharmacyStore';
import type { PharmacyOrder, DeliveryStatus } from '../types/icu';

interface PharmacyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPatientId?: string;
  onOpenInventory?: () => void;
}

export const PharmacyOrdersModal: React.FC<PharmacyOrdersModalProps> = ({
  isOpen,
  onClose,
  selectedPatientId,
  onOpenInventory,
}) => {
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPatientOnly, setFilterPatientOnly] = useState<boolean>(!!selectedPatientId);
  const [selectedOrder, setSelectedOrder] = useState<PharmacyOrder | null>(null);

  // Dispensing batch selector
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setOrders(pharmacyStore.getOrders());

    const unsubscribe = pharmacyStore.subscribe(() => {
      const freshOrders = pharmacyStore.getOrders();
      setOrders(freshOrders);
      if (selectedOrder) {
        const updated = freshOrders.find((o) => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    });
    return unsubscribe;
  }, [isOpen, selectedOrder]);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    const matchesPatient = !filterPatientOnly || !selectedPatientId || o.patientId === selectedPatientId;
    const matchesPriority = filterPriority === 'ALL' || o.priority === filterPriority;
    const matchesStatus = filterStatus === 'ALL' || o.status === filterStatus;
    return matchesPatient && matchesPriority && matchesStatus;
  });

  const activeOrder = selectedOrder || filteredOrders[0] || null;
  const activeMed = activeOrder ? pharmacyStore.getMedicineById(activeOrder.medicineId) : null;
  const validBatches = activeMed ? activeMed.batches.filter((b) => !b.isExpired && b.quantity > 0) : [];

  const handleDispense = () => {
    if (!activeOrder || !selectedBatch) {
      setActionFeedback({ type: 'error', text: 'Please select an unexpired batch to dispense.' });
      return;
    }

    const res = pharmacyStore.dispenseOrder(activeOrder.id, selectedBatch, 'Pharm. Rajesh Rao');
    if (res.success) {
      setActionFeedback({ type: 'success', text: res.message });
      setSelectedBatch('');
    } else {
      setActionFeedback({ type: 'error', text: res.message });
    }
  };

  const handleStatusAdvance = (nextStatus: DeliveryStatus, actor: string, note?: string) => {
    if (!activeOrder) return;
    pharmacyStore.updateOrderStatus(activeOrder.id, nextStatus, actor, note);
    setActionFeedback({ type: 'success', text: `Order advanced to ${nextStatus}.` });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Hospital Pharmacy Orders & Delivery Tracking
                </h3>
                <span className="text-[10px] font-mono font-bold bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-0.5 rounded border border-red-200 dark:border-red-900">
                  REAL-TIME PROGRESS ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connected Prescriptions, Batch Validation, Carrier Logistics, and Bedside Receipt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenInventory && (
              <button
                onClick={onOpenInventory}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors font-mono"
              >
                Open Stock Inventory
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

        {/* Filters */}
        <div className="p-3 sm:px-5 bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="STAT">STAT / Emergency Only</option>
              <option value="Urgent">Urgent Only</option>
              <option value="Routine">Routine Only</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
            >
              <option value="ALL">All Delivery Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Pharmacy Review">Pharmacy Review</option>
              <option value="Preparing">Preparing</option>
              <option value="Ready">Ready</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Delivered">Delivered</option>
            </select>

            {selectedPatientId && (
              <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterPatientOnly}
                  onChange={(e) => setFilterPatientOnly(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span className="text-slate-600 dark:text-slate-300">Filter Patient #{selectedPatientId} only</span>
              </label>
            )}
          </div>

          <div className="text-slate-500 dark:text-slate-400">
            Showing <span className="font-bold text-slate-900 dark:text-slate-100">{filteredOrders.length}</span> connected orders
          </div>
        </div>

        {actionFeedback && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl text-xs font-mono flex items-center justify-between ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            <span>{actionFeedback.text}</span>
            <button onClick={() => setActionFeedback(null)} className="text-xs font-bold underline ml-2">
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body: Master-Detail Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Order list column */}
          <div className="w-full md:w-5/12 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-3 space-y-2">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-mono text-xs">
                No pharmacy orders match the current filter.
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = activeOrder?.id === order.id;
                return (
                  <div
                    key={order.id}
                    onClick={() => {
                      setSelectedOrder(order);
                      setSelectedBatch(order.allocatedBatchNumber || '');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all font-mono text-xs ${
                      isSelected
                        ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800 shadow-xs'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900 dark:text-slate-100">{order.medicineName}</span>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                              order.priority === 'STAT'
                                ? 'bg-red-600 text-white animate-pulse'
                                : order.priority === 'Urgent'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {order.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Pt: <span className="font-bold">{order.patientName}</span> ({order.room} • {order.bedNumber})
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">Qty: {order.quantity}</span>
                        <span className="text-[10px] text-slate-400">{order.orderedAt}</span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px]">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : order.status === 'Out for Delivery'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 animate-pulse'
                            : order.status === 'Ready'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="text-slate-400">{order.estimatedDeliveryTime}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detailed order view & Dispensing terminal */}
          {activeOrder ? (
            <div className="w-full md:w-7/12 overflow-y-auto p-4 sm:p-6 space-y-5 font-mono text-xs">
              {/* Order summary card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900 dark:text-slate-100">{activeOrder.medicineName}</span>
                      <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-bold">
                        {activeOrder.id}
                      </span>
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded ${
                          activeOrder.priority === 'STAT' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                        }`}
                      >
                        {activeOrder.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      Patient: <span className="font-bold">{activeOrder.patientName}</span> (#{activeOrder.patientId}) • Room: {activeOrder.room} • {activeOrder.bedNumber}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Prescription Ref: {activeOrder.prescriptionId} • Total Charge: ${activeOrder.totalCost.toFixed(2)} (Billed: {activeOrder.billedToPatient ? 'Yes' : 'On Delivery'})
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Current Status</span>
                    <span className="text-sm font-black text-slate-900 dark:text-slate-100 block">{activeOrder.status}</span>
                    <span className="text-[10px] text-slate-400">{activeOrder.estimatedDeliveryTime}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Progress Bar Stepper (Workflow Event Driven) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-red-600" /> Bedside Delivery Stepper & Audit Log
                  </span>
                  <span className="text-[11px] text-slate-400">Last updated: {activeOrder.lastUpdated}</span>
                </div>

                <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                  {/* Progress track */}
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 dark:bg-slate-700 z-0" />
                    {activeOrder.timeline.map((step, idx) => {
                      const isCompleted = step.completed;
                      const isCurrent = activeOrder.status === step.step;
                      return (
                        <div key={step.step} className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                              isCompleted
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : isCurrent
                                ? 'bg-red-600 text-white ring-4 ring-red-200 dark:ring-red-950 animate-pulse'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                            }`}
                          >
                            {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>
                          <span
                            className={`text-[10px] font-bold mt-1 text-center max-w-[70px] ${
                              isCurrent
                                ? 'text-red-600 dark:text-red-400 font-black'
                                : isCompleted
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {step.step}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Step detail history */}
                  <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3 space-y-2">
                    {activeOrder.timeline.map((t) => (
                      <div key={t.step} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.completed ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {t.label}
                        </span>
                        <div className="text-right">
                          <span className="text-slate-900 dark:text-slate-100 font-bold">{t.timestamp || 'Pending'}</span>
                          {t.actor && <span className="text-slate-400 text-[10px] block">By: {t.actor}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pharmacist Action / Dispensing Console */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-black text-slate-900 dark:text-slate-100 text-xs uppercase tracking-tight flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Authorised Pharmacist Action Terminal
                </h4>

                {/* Step 1: Pre-dispensing batch check */}
                {activeOrder.status === 'Pending' || activeOrder.status === 'Pharmacy Review' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Select an active, unexpired batch for <span className="font-bold">{activeOrder.medicineName}</span> (Required: {activeOrder.quantity} units):
                    </p>

                    {validBatches.length === 0 ? (
                      <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>STOCK ALERT: No valid unexpired batches available in formulary! Please restock before dispensing.</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={selectedBatch}
                          onChange={(e) => setSelectedBatch(e.target.value)}
                          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono"
                        >
                          <option value="">-- Choose Valid Batch --</option>
                          {validBatches.map((b) => (
                            <option key={b.batchNumber} value={b.batchNumber}>
                              Batch {b.batchNumber} (Avail: {b.quantity} | Exp: {b.expiryDate})
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={handleDispense}
                          disabled={!selectedBatch}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Verify & Dispense Stock
                        </button>
                      </div>
                    )}
                  </div>
                ) : activeOrder.status === 'Ready' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Medicine verified and packaged from Batch <span className="font-bold text-slate-900 dark:text-slate-100">{activeOrder.allocatedBatchNumber}</span>. Ready for courier or nurse porter dispatch.
                    </p>
                    <button
                      onClick={() => handleStatusAdvance('Out for Delivery', 'Porter Ramesh (ICU Runner)', 'Dispatched via pneumatic/porter runner')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Send className="w-4 h-4" /> Dispatch — Out for Delivery
                    </button>
                  </div>
                ) : activeOrder.status === 'Out for Delivery' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      In transit to <span className="font-bold">{activeOrder.room}</span> ({activeOrder.bedNumber}). Nurse bedside confirmation required.
                    </p>
                    <button
                      onClick={() => handleStatusAdvance('Delivered', 'Nurse Chloe Evans, RN', 'Received and barcode verified at bedside')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Confirm Bedside Receipt & Administration
                    </button>
                  </div>
                ) : activeOrder.status === 'Delivered' ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
                    <span className="font-bold">✓ Successfully delivered and verified at patient bedside. Charged to patient billing ledger.</span>
                  </div>
                ) : null}

                {/* Exception / Cancellation */}
                {activeOrder.status !== 'Delivered' && activeOrder.status !== 'Cancelled' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <button
                      onClick={() => handleStatusAdvance('Delayed', 'Dr. Marcus Vance, MD', 'Physician requested clinical review before infusion')}
                      className="text-amber-600 hover:underline text-[11px]"
                    >
                      Flag Delayed / On Hold
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      onClick={() => handleStatusAdvance('Cancelled', 'Dr. Marcus Vance, MD', 'Cancelled by prescriber')}
                      className="text-red-600 hover:underline text-[11px]"
                    >
                      Cancel Order
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full md:w-7/12 p-8 text-center text-slate-400 font-mono text-xs flex items-center justify-center">
              Select an order from the list to view timeline details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
