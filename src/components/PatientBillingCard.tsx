import React, { useState, useEffect } from 'react';
import { Receipt, Edit3 } from 'lucide-react';
import { pharmacyStore } from '../services/pharmacyStore';
import { formatINR } from '../utils/currency';
import type { PatientBillingItem } from '../types/icu';

interface PatientBillingCardProps {
  patientId: string;
  patientName: string;
}

export const PatientBillingCard: React.FC<PatientBillingCardProps> = ({ patientId, patientName }) => {
  const [items, setItems] = useState<PatientBillingItem[]>([]);
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState<string>('');

  useEffect(() => {
    setItems(pharmacyStore.getBillingItems(patientId));
    const unsubscribe = pharmacyStore.subscribe(() => {
      setItems(pharmacyStore.getBillingItems(patientId));
    });
    return unsubscribe;
  }, [patientId]);

  const totalBill = items
    .filter((i) => !i.isCorrected)
    .reduce((sum, item) => sum + item.totalAmount, 0);

  const handleApplyCorrection = (itemId: string) => {
    if (!correctionReason.trim()) return;
    pharmacyStore.correctBillingItem(itemId, correctionReason.trim(), 'Dr. Marcus Vance, MD');
    setCorrectionTarget(null);
    setCorrectionReason('');
  };

  return (
    <div className="clinical-card p-5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm tracking-tight">
              Hospital Itemized Patient Billing & Medicine Charges
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Audit-verified ledger for {patientName} (#{patientId}) • Automated duplicate-charge prevention
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Total Bill</span>
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {formatINR(totalBill)}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-slate-400">
          No billing items recorded for this patient admission.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-2 transition-all ${
                item.isCorrected
                  ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 line-through'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{item.description}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {item.category}
                  </span>
                  {item.orderId && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Ref: {item.orderId}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatINR(item.unitPrice)} × {item.quantity} units • {item.timestamp}
                </div>
                {item.isCorrected && (
                  <div className="text-[10px] text-red-600 dark:text-red-400 font-bold no-underline">
                    Corrected / Voided: {item.correctionReason} (by {item.correctedBy})
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                  {formatINR(item.totalAmount)}
                </span>

                {!item.isCorrected && (
                  <button
                    onClick={() => setCorrectionTarget(correctionTarget === item.id ? null : item.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Authorized Charge Correction"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Inline correction input */}
              {correctionTarget === item.id && (
                <div className="w-full mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                  <input
                    type="text"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Enter reason for charge reversal / correction..."
                    className="flex-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-xs"
                  />
                  <button
                    onClick={() => handleApplyCorrection(item.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold"
                  >
                    Confirm Void
                  </button>
                  <button
                    onClick={() => setCorrectionTarget(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
