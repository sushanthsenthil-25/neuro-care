import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Stethoscope } from 'lucide-react';
import { pharmacyStore } from '../services/pharmacyStore';
import { formatINR } from '../utils/currency';
import type { Patient, MedicineItem, Prescription } from '../types/icu';

interface PrescriptionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  currentDoctorName?: string;
  onPrescriptionCreated?: (rx: Prescription) => void;
}

export const PrescriptionFormModal: React.FC<PrescriptionFormModalProps> = ({
  isOpen,
  onClose,
  patient,
  currentDoctorName = 'Dr. Marcus Vance, MD',
  onPrescriptionCreated,
}) => {
  const [inventory, setInventory] = useState<MedicineItem[]>([]);
  const [selectedMedId, setSelectedMedId] = useState<string>('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState<Prescription['route']>('IV');
  const [frequency, setFrequency] = useState<Prescription['frequency']>('Q8H');
  const [scheduledTime, setScheduledTime] = useState('14:00');
  const [quantity, setQuantity] = useState<number>(1);
  const [urgency, setUrgency] = useState<Prescription['urgency']>('Urgent');
  const [instructions, setInstructions] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const inv = pharmacyStore.getInventory();
    setInventory(inv);
    if (inv.length > 0 && !selectedMedId) {
      setSelectedMedId(inv[0].id);
      setDose(inv[0].strength);
    }
  }, [isOpen, selectedMedId]);

  if (!isOpen) return null;

  const selectedMed = inventory.find((m) => m.id === selectedMedId);

  const handleMedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const medId = e.target.value;
    setSelectedMedId(medId);
    const m = inventory.find((item) => item.id === medId);
    if (m) {
      setDose(m.strength);
      if (m.dosageForm.includes('IV') || m.dosageForm === 'Vial' || m.dosageForm === 'Ampoule') {
        setRoute('IV');
      } else {
        setRoute('Oral');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed) {
      setFeedback({ type: 'error', text: 'Please select a valid medicine from inventory.' });
      return;
    }

    // Check if total stock is 0
    if (selectedMed.totalAvailableQuantity === 0) {
      setFeedback({
        type: 'error',
        text: `Inventory Alert: ${selectedMed.name} is currently OUT OF STOCK. Cannot dispense without stock replenishment!`,
      });
      return;
    }

    const res = pharmacyStore.createPrescriptionAndOrder(
      {
        patientId: patient.id,
        patientName: patient.name,
        room: patient.room,
        bedNumber: patient.bedNumber || 'Bed 01',
        medicineId: selectedMed.id,
        medicineName: selectedMed.name,
        genericName: selectedMed.genericName,
        strength: selectedMed.strength,
        dose,
        route,
        frequency,
        scheduledTime,
        quantity: Number(quantity),
        prescribedBy: currentDoctorName,
        urgency,
        instructions: instructions.trim() || 'Administer as per clinical ICU protocol.',
      },
      currentDoctorName
    );

    setFeedback({
      type: 'success',
      text: `Prescription ${res.prescription.id} submitted! Created connected Pharmacy Order ${res.order.id}.`,
    });

    if (onPrescriptionCreated) {
      onPrescriptionCreated(res.prescription);
    }

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Authorised Clinical Prescription Order
                </h3>
                <span className="text-[10px] font-mono font-bold bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-0.5 rounded border border-red-200 dark:border-red-900">
                  CONNECTED TO PHARMACY
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Patient: <span className="font-bold text-slate-900 dark:text-slate-200">{patient.name}</span> (#{patient.id}) • {patient.room} • Prescriber: {currentDoctorName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div
            className={`mx-5 mt-4 p-3 rounded-xl text-xs font-mono flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-mono text-xs">
          {/* Medicine selector from inventory */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Select Medicine from Active Formulary Inventory *
            </label>
            <select
              value={selectedMedId}
              onChange={handleMedChange}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              required
            >
              {inventory.map((med) => (
                <option key={med.id} value={med.id}>
                  {med.name} ({med.genericName}) — {med.strength} [{med.dosageForm}] — Available Stock: {med.totalAvailableQuantity}
                </option>
              ))}
            </select>
          </div>

          {selectedMed && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">{selectedMed.name}</span>
                <span className="text-[11px] text-slate-400">
                  {selectedMed.category} • Supplier: {selectedMed.supplier.name} • Unit Charge: {formatINR(selectedMed.unitPrice)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Formulary Stock</span>
                <span
                  className={`font-black ${
                    selectedMed.totalAvailableQuantity <= selectedMed.minimumStockThreshold
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {selectedMed.totalAvailableQuantity} units
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Dosage *</label>
              <input
                type="text"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="e.g. 1 g, 500 mg, 4 mg"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Route</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value as Prescription['route'])}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="IV">IV (Intravenous)</option>
                <option value="Oral">Oral</option>
                <option value="SC">SC (Subcutaneous)</option>
                <option value="IM">IM (Intramuscular)</option>
                <option value="Inhalation">Inhalation</option>
                <option value="Topical">Topical</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Prescription['frequency'])}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="STAT">STAT (Immediate Once)</option>
                <option value="Q4H">Q4H (Every 4 Hours)</option>
                <option value="Q6H">Q6H (Every 6 Hours)</option>
                <option value="Q8H">Q8H (Every 8 Hours)</option>
                <option value="Q12H">Q12H (Every 12 Hours)</option>
                <option value="OD">OD (Once Daily)</option>
                <option value="BD">BD (Twice Daily)</option>
                <option value="TDS">TDS (Thrice Daily)</option>
                <option value="PRN">PRN (As Needed)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Scheduled Time</label>
              <input
                type="text"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                placeholder="e.g. Immediate, 14:00, 22:00"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Dispense Quantity *</label>
              <input
                type="number"
                min="1"
                max="20"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Clinical Priority</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as Prescription['urgency'])}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
              >
                <option value="STAT">STAT / Emergency</option>
                <option value="Urgent">Urgent</option>
                <option value="Routine">Routine</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Administration Instructions & Clinical Notes
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Infuse over 30 minutes in 100ml NS. Monitor blood pressure every 15 minutes."
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Prescriber Digital Stamp: <span className="font-bold text-slate-700 dark:text-slate-300">{currentDoctorName}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Authorize & Submit Order
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
