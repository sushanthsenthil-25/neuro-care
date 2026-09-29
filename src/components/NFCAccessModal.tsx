import React, { useState } from 'react';
import type { Patient } from '../types/icu';
import { Radio, QrCode, Smartphone, Check, X, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface NFCAccessModalProps {
  patients: Patient[];
  onSelectPatient: (patientId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const NFCAccessModal: React.FC<NFCAccessModalProps> = ({
  patients,
  onSelectPatient,
  isOpen,
  onClose,
}) => {
  const [simulatedTapId, setSimulatedTapId] = useState<string>('NC-ICU-003');
  const [sequenceStep, setSequenceStep] = useState<'IDLE' | 'DETECTED' | 'IDENTIFIED' | 'LOADING' | 'COMPLETE'>('IDLE');

  if (!isOpen) return null;

  const handleSimulateTap = (id: string) => {
    setSimulatedTapId(id);
    setSequenceStep('DETECTED');

    setTimeout(() => {
      setSequenceStep('IDENTIFIED');
      setTimeout(() => {
        setSequenceStep('LOADING');
        setTimeout(() => {
          setSequenceStep('COMPLETE');
          setTimeout(() => {
            onSelectPatient(id);
            onClose();
            setSequenceStep('IDLE');
          }, 400);
        }, 500);
      }, 500);
    }, 400);
  };

  const targetPatient = patients.find((p) => p.id === simulatedTapId) || patients[2];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            <h3 className="font-bold text-sm tracking-wide">NFC PATIENT IDENTIFICATION PROTOCOL</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">Contactless Bedside Authentication</p>
            <p>Scanning wristband tag retrieves secure encrypted patient endpoint.</p>
          </div>

          {/* Sequence Progress Bar */}
          {sequenceStep !== 'IDLE' && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
                  {sequenceStep === 'DETECTED' && '1. NFC Tag Detected...'}
                  {sequenceStep === 'IDENTIFIED' && `2. Patient Identified: ${targetPatient.name}`}
                  {sequenceStep === 'LOADING' && '3. Loading Clinical Data & Telemetry...'}
                  {sequenceStep === 'COMPLETE' && '4. Routing to Patient Dashboard!'}
                </span>
              </div>

              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <motion.div
                  className="bg-red-600 h-full rounded-full"
                  initial={{ width: '0%' }}
                  animate={{
                    width:
                      sequenceStep === 'DETECTED'
                        ? '25%'
                        : sequenceStep === 'IDENTIFIED'
                        ? '50%'
                        : sequenceStep === 'LOADING'
                        ? '75%'
                        : '100%',
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Target Patient Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Bedside Target Tag</span>
              <div className="text-xs font-bold text-slate-900">{targetPatient.name}</div>
              <div className="text-[10px] font-mono text-slate-500">ID: {targetPatient.id} | Bed: {targetPatient.bedNumber}</div>
            </div>
            <span className="text-[10px] font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-700">
              {targetPatient.nfcTagId}
            </span>
          </div>

          {/* QR Visual */}
          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border border-dashed border-slate-300">
            <div className="w-28 h-28 bg-slate-900 rounded flex items-center justify-center text-white relative">
              <QrCode className="w-20 h-20 text-slate-100" />
              {sequenceStep === 'COMPLETE' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-emerald-600/95 rounded flex items-center justify-center text-white font-bold text-xs"
                >
                  <Check className="w-8 h-8" />
                </motion.div>
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-mono">https://neurocare.icu/patient/{targetPatient.id}</span>
          </div>

          {/* Bedside Tag Selectors */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 mb-1.5 block">
              Tap Bedside Patient Tag:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {patients.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSimulateTap(p.id)}
                  disabled={sequenceStep !== 'IDLE'}
                  className={`p-2 text-left rounded border text-xs font-medium transition-all ${
                    simulatedTapId === p.id ? 'border-red-600 bg-red-50 text-red-900 font-bold' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>{p.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{p.id}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" /> ISO/IEC 14443 Type A Compliant
          </span>
          <button
            onClick={() => handleSimulateTap(simulatedTapId)}
            disabled={sequenceStep !== 'IDLE'}
            className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Radio className="w-3.5 h-3.5" /> Tap NFC Tag Now
          </button>
        </div>
      </motion.div>
    </div>
  );
};
