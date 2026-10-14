import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ChevronRight
} from 'lucide-react';
import { queueStore } from '../services/queueStore';
import type { PatientQueueEntry, TriagePriority, QueueStatus } from '../types/icu';

interface PatientQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPatient?: (patientId: string) => void;
}

export const PatientQueueDrawer: React.FC<PatientQueueDrawerProps> = ({
  isOpen,
  onClose,
  onSelectPatient,
}) => {
  const [queue, setQueue] = useState<PatientQueueEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // New queue entry form
  const [name, setName] = useState('');
  const age = 45;
  const gender = 'Male';
  const [department, setDepartment] = useState<PatientQueueEntry['department']>('ICU Triage');
  const [priority, setPriority] = useState<TriagePriority>('URGENT');
  const [complaint, setComplaint] = useState('');
  const [clinician, setClinician] = useState('Dr. Marcus Vance, MD');

  useEffect(() => {
    if (!isOpen) return;
    setQueue(queueStore.getSortedQueue());

    // Live update timer every 10 seconds for elapsed waiting time calculation
    const timer = setInterval(() => {
      setQueue(queueStore.getSortedQueue());
    }, 10000);

    const unsubscribe = queueStore.subscribe(() => {
      setQueue(queueStore.getSortedQueue());
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const emergencyCount = queue.filter((q) => q.triagePriority === 'EMERGENCY' && q.status !== 'Completed').length;
  const urgentCount = queue.filter((q) => q.triagePriority === 'URGENT' && q.status !== 'Completed').length;
  const reassessmentCount = queue.filter((q) => q.reassessmentRequired && q.status !== 'Completed').length;

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !complaint.trim()) return;

    queueStore.addQueueEntry({
      patientName: name.trim(),
      age: Number(age),
      gender,
      arrivalTime: new Date().toISOString(),
      department,
      triagePriority: priority,
      chiefComplaint: complaint.trim(),
      assignedClinician: clinician,
      status: 'Waiting',
      estimatedWaitMinutes: priority === 'EMERGENCY' ? 0 : priority === 'URGENT' ? 15 : 45,
    });

    setName('');
    setComplaint('');
    setIsAdding(false);
  };

  const handleAdvanceStatus = (id: string, current: QueueStatus) => {
    const next: Record<QueueStatus, QueueStatus> = {
      Waiting: 'Triage',
      Triage: 'In-Consult',
      'In-Consult': 'Admitted',
      Admitted: 'Completed',
      Completed: 'Completed',
    };
    queueStore.updateQueueStatus(id, next[current]);
  };

  const handleReassess = (id: string) => {
    queueStore.recordReassessment(id, 'Vitals re-checked by Triage RN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Patient Queue & Clinical Triage
                </h3>
                <span className="text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                  EMERGENCY-FIRST FIFO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Calculated from arrival timestamps • Urgent triage prioritization
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

        {/* Top KPI chips */}
        <div className="p-3 bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block">Emergency (STAT)</span>
            <span className="text-base font-black text-red-600 dark:text-red-400">{emergencyCount}</span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">Urgent Review</span>
            <span className="text-base font-black text-amber-600 dark:text-amber-400">{urgentCount}</span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold block">Reassessment Due</span>
            <span className="text-base font-black text-orange-600 dark:text-orange-400">{reassessmentCount}</span>
          </div>
        </div>

        {/* Action bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="font-bold text-slate-700 dark:text-slate-300">Live Active Queue ({queue.length})</span>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Triage New Patient
          </button>
        </div>

        {/* Add Patient Drawer Form */}
        {isAdding && (
          <form onSubmit={handleCreateEntry} className="p-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="font-black text-slate-900 dark:text-slate-100 text-xs uppercase tracking-tight">
              Triage Intake Entry
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block font-bold">Patient Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Suman Sen"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block font-bold">Triage Urgency *</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TriagePriority)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold"
                >
                  <option value="EMERGENCY">EMERGENCY (Immediate Triage)</option>
                  <option value="URGENT">URGENT (Within 15-30m)</option>
                  <option value="ROUTINE">ROUTINE (Standard Queue)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block font-bold">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as PatientQueueEntry['department'])}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                >
                  <option value="ICU Triage">ICU Triage</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Neuro-Trauma">Neuro-Trauma</option>
                  <option value="Step-down">Step-down</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block font-bold">Assigned Clinician</label>
                <input
                  type="text"
                  value={clinician}
                  onChange={(e) => setClinician(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block font-bold">Chief Clinical Complaint *</label>
              <textarea
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder="e.g. Altered mental status, sudden drop in BP, post-ictal confusion"
                rows={2}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1 text-slate-400 hover:text-slate-600 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs"
              >
                Insert into Queue
              </button>
            </div>
          </form>
        )}

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {queue.map((item, idx) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                item.triagePriority === 'EMERGENCY'
                  ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800 shadow-xs'
                  : item.triagePriority === 'URGENT'
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                      #{idx + 1} {item.patientName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({item.age}yo {item.gender})
                    </span>
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                        item.triagePriority === 'EMERGENCY'
                          ? 'bg-red-600 text-white animate-pulse'
                          : item.triagePriority === 'URGENT'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.triagePriority}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Dept: <span className="font-bold">{item.department}</span> • Assigned: {item.assignedClinician}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Elapsed Waiting</span>
                  <span
                    className={`font-black text-sm ${
                      item.elapsedWaitingMinutes > 30 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {item.elapsedWaitingMinutes} mins
                  </span>
                  {item.estimatedWaitMinutes !== undefined && (
                    <span className="text-[10px] text-slate-400 block">
                      Est. Wait: {item.estimatedWaitMinutes === 0 ? 'Immediate' : `~${item.estimatedWaitMinutes}m`}
                    </span>
                  )}
                </div>
              </div>

              {/* Chief complaint */}
              <div className="p-2 bg-white/80 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-slate-100">Complaint: </span>
                {item.chiefComplaint}
              </div>

              {/* Reassessment Banner */}
              {item.reassessmentRequired && item.status !== 'Completed' && (
                <div className="p-2 bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 rounded-lg flex items-center justify-between text-[10px] text-orange-900 dark:text-orange-200">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-600" /> Clinical Reassessment Alert Overdue!
                  </span>
                  <button
                    onClick={() => handleReassess(item.id)}
                    className="px-2 py-0.5 bg-orange-600 text-white font-bold rounded hover:bg-orange-700"
                  >
                    Log Reassessment
                  </button>
                </div>
              )}

              {/* Progress and status control */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    Status: <span className="text-slate-900 dark:text-slate-100 uppercase">{item.status}</span>
                  </span>
                  {item.patientId && onSelectPatient && (
                    <button
                      onClick={() => onSelectPatient(item.patientId!)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-[9.5px] font-bold text-slate-800 dark:text-slate-200"
                    >
                      Bed Profile
                    </button>
                  )}
                </div>

                {item.status !== 'Completed' ? (
                  <button
                    onClick={() => handleAdvanceStatus(item.id, item.status)}
                    className="px-2.5 py-1 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded font-bold text-[10px] transition-colors flex items-center gap-1"
                  >
                    Advance to{' '}
                    {item.status === 'Waiting'
                      ? 'Triage'
                      : item.status === 'Triage'
                      ? 'In-Consult'
                      : item.status === 'In-Consult'
                      ? 'Admit'
                      : 'Complete'}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Consultation Completed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
