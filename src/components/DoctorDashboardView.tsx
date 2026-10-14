import React, { useState, useEffect } from 'react';
import type { Patient, Alert, ShiftSummary, PharmacyOrder, PatientQueueEntry, BloodRequest } from '../types/icu';
import {
  Stethoscope,
  Moon,
  ArrowRight,
  Users,
  ShieldAlert,
  Bell,
  Package,
  Truck,
  Droplet,
  Clock,
  Plus
} from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { fetchActiveAlertsOverview } from '../services/aiEngine';
import type { ClinicalAlert } from '../services/aiEngine';
import { MedicineInventoryModal } from './MedicineInventoryModal';
import { PharmacyOrdersModal } from './PharmacyOrdersModal';
import { BloodDonorModal } from './BloodDonorModal';
import { PatientQueueDrawer } from './PatientQueueDrawer';
import { queueStore } from '../services/queueStore';
import { pharmacyStore } from '../services/pharmacyStore';
import { bloodStore } from '../services/bloodStore';

interface DoctorDashboardViewProps {
  patients: Patient[];
  alerts: Alert[];
  shiftSummaries: Record<string, ShiftSummary>;
  onSelectPatient: (patientId: string) => void;
  onOpenInventory?: () => void;
  onOpenOrders?: () => void;
  onOpenQueue?: () => void;
  onOpenBlood?: () => void;
}

export const DoctorDashboardView: React.FC<DoctorDashboardViewProps> = ({
  patients,
  alerts,
  shiftSummaries,
  onSelectPatient,
  onOpenInventory,
  onOpenOrders,
  onOpenQueue,
  onOpenBlood,
}) => {
  const [activeModelAlerts, setActiveModelAlerts] = useState<ClinicalAlert[]>([]);
  const [dashboardTab, setDashboardTab] = useState<'roster' | 'queue' | 'pharmacy' | 'blood'>('roster');

  // Modals state
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isBloodOpen, setIsBloodOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Live store records
  const [queueEntries, setQueueEntries] = useState<PatientQueueEntry[]>([]);
  const [allOrders, setAllOrders] = useState<PharmacyOrder[]>([]);
  const [allBloodReqs, setAllBloodReqs] = useState<BloodRequest[]>([]);

  useEffect(() => {
    fetchActiveAlertsOverview().then((alertsData) => {
      if (alertsData) setActiveModelAlerts(alertsData);
    });

    setQueueEntries(queueStore.getSortedQueue());
    setAllOrders(pharmacyStore.getOrders());
    setAllBloodReqs(bloodStore.getRequests());

    const unsubQ = queueStore.subscribe(() => setQueueEntries(queueStore.getSortedQueue()));
    const unsubP = pharmacyStore.subscribe(() => setAllOrders(pharmacyStore.getOrders()));
    const unsubB = bloodStore.subscribe(() => setAllBloodReqs(bloodStore.getRequests()));

    return () => {
      unsubQ();
      unsubP();
      unsubB();
    };
  }, []);

  // Assigned Patients for Attending Intensivist Dr. Marcus Vance MD (Application Metadata Layer)
  const currentDoctorName = 'Dr. Marcus Vance, MD';
  const assignedPatients = patients.filter((p) => p.assignedDoctor === currentDoctorName || p.id === '132543' || p.id === '132539');

  const criticalCount = assignedPatients.filter((p) => p.status === 'CRITICAL').length;
  const warningCount = assignedPatients.filter((p) => p.status === 'WARNING').length;
  const watchCount = assignedPatients.filter((p) => p.status === 'OBSERVATION').length;
  const stableCount = assignedPatients.filter((p) => p.status === 'STABLE').length;

  const activeAlerts = alerts.filter((a) => !a.resolved);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="clinical-card p-6 border-l-4 border-l-red-600 bg-white rounded-xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-200">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Doctor Attention Dashboard — Physician Rounding Intelligence
                </h2>
                <span className="text-[10px] bg-red-50 text-red-700 font-mono font-bold px-2 py-0.5 rounded border border-red-200 uppercase">
                  Which patients require my immediate attention?
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Displaying prioritized clinical alerts, deterioration risk trajectories, and dataset vital trends for assigned patients.
              </p>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-xs font-bold text-slate-900 block">{currentDoctorName}</span>
            <span className="text-[10px] text-slate-500">Attending Intensivist • Ward Unit A</span>
          </div>
        </div>

        {/* Doctor Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center pt-2">
          <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">My Assigned</span>
            <span className="text-xl font-black font-mono block mt-0.5">{assignedPatients.length}</span>
            <span className="text-[9px] text-slate-400">Patients</span>
          </div>

          <div className="p-3 bg-red-50 rounded-xl border border-red-200">
            <span className="text-[10px] text-red-600 font-bold uppercase block">Critical</span>
            <span className="text-xl font-black font-mono text-red-600 block mt-0.5">{criticalCount}</span>
            <span className="text-[9px] text-red-700 font-bold">Action Needed</span>
          </div>

          <div className="p-3 bg-red-50/70 rounded-xl border border-red-200">
            <span className="text-[10px] text-red-500 font-bold uppercase block">Elevated Risk</span>
            <span className="text-xl font-black font-mono text-red-500 block mt-0.5">{warningCount}</span>
            <span className="text-[9px] text-red-600">High Watch</span>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-[10px] text-amber-700 font-bold uppercase block">Watch</span>
            <span className="text-xl font-black font-mono text-amber-600 block mt-0.5">{watchCount}</span>
            <span className="text-[9px] text-amber-800">Monitoring</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-700 font-bold uppercase block">Stable</span>
            <span className="text-xl font-black font-mono text-emerald-600 block mt-0.5">{stableCount}</span>
            <span className="text-[9px] text-emerald-800">Normal Range</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">New Alerts</span>
            <span className="text-xl font-black font-mono text-red-600 block mt-0.5">{activeAlerts.length}</span>
            <span className="text-[9px] text-slate-500">Unresolved</span>
          </div>
        </div>

        {/* Doctor Operations Quick Access Buttons */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => (onOpenQueue ? onOpenQueue() : setIsQueueOpen(true))}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" /> Triage Queue ({queueEntries.length})
            </button>
            <button
              onClick={() => (onOpenInventory ? onOpenInventory() : setIsInventoryOpen(true))}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Package className="w-3.5 h-3.5 text-purple-600" /> Medicine Inventory
            </button>
            <button
              onClick={() => (onOpenOrders ? onOpenOrders() : setIsOrdersOpen(true))}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Truck className="w-3.5 h-3.5 text-blue-600" /> Pharmacy Orders ({allOrders.length})
            </button>
            <button
              onClick={() => (onOpenBlood ? onOpenBlood() : setIsBloodOpen(true))}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
            >
              <Droplet className="w-3.5 h-3.5 text-red-600 fill-current" /> Blood Donor Requests ({allBloodReqs.length})
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            Emergency Priority Queue: {queueEntries.filter(q => q.triagePriority === 'EMERGENCY').length} STAT
          </span>
        </div>
      </div>

      {/* SUB-TAB VIEW SWITCHER */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-6 font-mono text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setDashboardTab('roster')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
            dashboardTab === 'roster'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" /> Assigned Patient Roster ({assignedPatients.length})
        </button>

        <button
          onClick={() => setDashboardTab('queue')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
            dashboardTab === 'queue'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" /> Triage Queue ({queueEntries.length})
        </button>

        <button
          onClick={() => setDashboardTab('pharmacy')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
            dashboardTab === 'pharmacy'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Truck className="w-4 h-4 text-blue-500" /> Pharmacy Orders ({allOrders.length})
        </button>

        <button
          onClick={() => setDashboardTab('blood')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
            dashboardTab === 'blood'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Droplet className="w-4 h-4 text-red-500 fill-current" /> Blood Requests ({allBloodReqs.length})
        </button>
      </div>

      {/* SUB-VIEW TAB 1: ASSIGNED PATIENTS ROSTER */}
      {dashboardTab === 'roster' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Assigned Patients Rounding Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="clinical-card p-5 space-y-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-800 dark:text-slate-200" /> Assigned Patient Clinical Priority Roster
                </h3>
                <span className="text-xs font-mono text-slate-500">Filtered by Attending Physician</span>
              </div>

              <div className="space-y-3">
                {assignedPatients.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectPatient(p.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-wrap items-center justify-between gap-4 ${
                      p.status === 'CRITICAL'
                        ? 'bg-red-50/60 dark:bg-red-950/30 border-red-300 dark:border-red-900 shadow-sm hover:border-red-400'
                        : p.status === 'WARNING'
                        ? 'bg-red-50/30 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 hover:border-red-300'
                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100">Patient ID: {p.id}</span>
                        <span className="text-xs font-mono bg-slate-900 dark:bg-slate-700 text-white px-2 py-0.5 rounded font-bold">
                          {p.room}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase font-mono ${
                            p.status === 'CRITICAL'
                              ? 'bg-red-600 text-white'
                              : p.status === 'WARNING'
                              ? 'bg-red-500 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                        Age: <strong className="text-slate-800 dark:text-slate-100">{p.age}Y</strong> • Gender:{' '}
                        <strong className="text-slate-800 dark:text-slate-100">{p.gender}</strong> • ICU Type:{' '}
                        <strong className="text-slate-800 dark:text-slate-100">{p.icuType}</strong> ({p.diagnosis})
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono pt-1 text-slate-800 dark:text-slate-200">
                        <span>HR: <strong className="font-extrabold text-slate-900 dark:text-slate-100">{p.vitals.heartRate.current} bpm</strong></span>
                        <span>BP: <strong className="font-extrabold text-slate-900 dark:text-slate-100">{p.vitals.bpSystolic.current}/{p.vitals.bpDiastolic.current}</strong></span>
                        <span>
                          SpO₂:{' '}
                          {p.hasSpo2 !== false && p.vitals.spo2.current > 0 ? (
                            <strong className="font-extrabold text-slate-900 dark:text-slate-100">{p.vitals.spo2.current}%</strong>
                          ) : (
                            <span className="text-slate-400 italic font-sans">Data unavailable</span>
                          )}
                        </span>
                        <span>GCS: <strong className="font-extrabold text-slate-900 dark:text-slate-100">{p.gcs ?? 15}</strong></span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2 shrink-0 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">In-Hospital Mortality Risk (XGBoost-ICU-v1)</span>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 block">
                          Mortality Risk: <AnimatedNumber value={p.deteriorationRisk} unit="%" />
                        </span>
                        <span className="text-[10px] text-slate-500 block">Threshold: 12.0% • Target: inHospitalDeath</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPatient(p.id);
                        }}
                        className="px-3.5 py-1.5 bg-red-600 text-white font-extrabold text-xs rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1 shadow-xs"
                      >
                        Open Patient Details <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shift Summaries Ticker */}
            <div className="clinical-card p-5 space-y-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <Moon className="w-4 h-4 text-amber-500" /> Overnight Shift Summaries Ready for Review
              </h3>
              {Object.values(shiftSummaries).map((sum) => (
                <div key={sum.patientId} className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-100">RecordID: {sum.patientId}</span>
                    <span className="text-red-600 font-bold">{sum.overallTrajectory}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{sum.recommendation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Active Clinical Alerts */}
          <div className="space-y-4">
            <div className="clinical-card p-5 space-y-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600" /> Active Unresolved Clinical Alerts ({activeAlerts.length})
                </h3>
              </div>

              <div className="space-y-3">
                {activeAlerts.map((alt) => (
                  <div
                    key={alt.id}
                    onClick={() => onSelectPatient(alt.patientId)}
                    className="p-3.5 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900 cursor-pointer hover:bg-red-100/70 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-red-950 dark:text-red-200">
                      <span>{alt.title}</span>
                      <span className="text-[10px] font-mono text-slate-500">{alt.timestamp}</span>
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-300 font-mono font-bold">
                      Patient ID {alt.patientId} ({alt.room})
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">{alt.explanation[0]}</p>
                    <div className="pt-1 text-[10px] font-mono text-red-700 dark:text-red-300 font-bold flex items-center justify-between">
                      <span>Score: {alt.riskScore}%</span>
                      <span className="flex items-center gap-0.5 hover:underline">
                        Review <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Model Risk Engine Active Alerts */}
            {activeModelAlerts.length > 0 && (
              <div className="clinical-card p-5 space-y-3 bg-white dark:bg-slate-800/90 rounded-xl border border-red-200 dark:border-red-900/60 shadow-xs font-mono">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                    <Bell className="w-4 h-4 text-red-600 animate-bounce" /> Model Risk Engine Alerts ({activeModelAlerts.length})
                  </h3>
                  <span className="text-[10px] text-slate-500">Live Backend Audit</span>
                </div>
                <div className="space-y-2">
                  {activeModelAlerts.map((alt) => (
                    <div
                      key={alt.alert_id}
                      onClick={() => onSelectPatient(alt.patient_id)}
                      className="p-3 bg-red-50/80 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900 cursor-pointer hover:bg-red-100 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                        <span>{alt.title}</span>
                        <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded">{alt.risk_level}</span>
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300">Patient ID: {alt.patient_id} ({alt.room_id})</div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2">{alt.message}</p>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-200/60 dark:border-slate-700/60 pt-1">
                        <span>Cutoff: {alt.data_cutoff}</span>
                        <span className="text-red-700 dark:text-red-400 font-bold flex items-center gap-0.5">Open Details <ArrowRight className="w-2.5 h-2.5" /></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW TAB 2: TRIAGE QUEUE */}
      {dashboardTab === 'queue' && (
        <div className="clinical-card p-5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm">
                Patient Triage Queue (Prioritized by Clinical Urgency)
              </h3>
            </div>
            <button
              onClick={() => setIsQueueOpen(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Triage New Patient
            </button>
          </div>

          <div className="space-y-3">
            {queueEntries.map((item, idx) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                  item.triagePriority === 'EMERGENCY'
                    ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                    : item.triagePriority === 'URGENT'
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-slate-100 text-sm">#{idx + 1} {item.patientName}</span>
                    <span className="text-[10px] text-slate-500">({item.age}Y • {item.gender})</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white ${item.triagePriority === 'EMERGENCY' ? 'bg-red-600 animate-pulse' : 'bg-amber-500'}`}>
                      {item.triagePriority}
                    </span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-bold">{item.department}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{item.chiefComplaint}</p>
                </div>

                <div className="text-right flex items-center gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Elapsed Waiting</span>
                    <span className="text-sm font-black text-slate-900 dark:text-slate-100">{item.elapsedWaitingMinutes} mins</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 uppercase">
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-VIEW TAB 3: PHARMACY ORDERS */}
      {dashboardTab === 'pharmacy' && (
        <div className="clinical-card p-5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-500" />
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm">
                Active Hospital Pharmacy Medication Dispatches
              </h3>
            </div>
            <button
              onClick={() => setIsOrdersOpen(true)}
              className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-bold"
            >
              Open Pharmacy Fulfillment Terminal
            </button>
          </div>

          <div className="space-y-3">
            {allOrders.map((ord) => (
              <div
                key={ord.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-slate-100">{ord.medicineName}</span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-bold">Qty: {ord.quantity}</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white ${ord.priority === 'STAT' ? 'bg-red-600 animate-pulse' : 'bg-amber-500'}`}>
                      {ord.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pt: <span className="font-bold text-slate-800 dark:text-slate-200">{ord.patientName}</span> ({ord.room} • {ord.bedNumber}) • Ordered: {ord.orderedAt}
                  </p>
                </div>

                <div className="text-right">
                  <span className="font-bold text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 block">
                    {ord.status}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{ord.estimatedDeliveryTime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-VIEW TAB 4: BLOOD REQUESTS */}
      {dashboardTab === 'blood' && (
        <div className="clinical-card p-5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <Droplet className="w-4 h-4 text-red-600 fill-current" />
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm">
                Emergency Blood Bank Requests & Matched Donors
              </h3>
            </div>
            <button
              onClick={() => setIsBloodOpen(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
            >
              Open Blood Bank Terminal
            </button>
          </div>

          <div className="space-y-3">
            {allBloodReqs.map((req) => (
              <div
                key={req.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-red-600 dark:text-red-400 text-sm">{req.bloodGroup} {req.component}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">({req.quantityUnits} Units)</span>
                    <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded uppercase">{req.urgency}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pt: <span className="font-bold text-slate-800 dark:text-slate-200">{req.patientName}</span> ({req.room}) • Search Radius: {req.searchRadiusKm} km
                  </p>
                </div>

                <div className="text-right">
                  <span className="font-bold text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 block">
                    {req.requestStatus}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{req.matchedDonors.length} prospective donors</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      <MedicineInventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        onOpenOrders={() => {
          setIsInventoryOpen(false);
          setIsOrdersOpen(true);
        }}
      />

      <PharmacyOrdersModal
        isOpen={isOrdersOpen}
        onClose={() => setIsOrdersOpen(false)}
        onOpenInventory={() => {
          setIsOrdersOpen(false);
          setIsInventoryOpen(true);
        }}
      />

      <BloodDonorModal
        isOpen={isBloodOpen}
        onClose={() => setIsBloodOpen(false)}
      />

      <PatientQueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onSelectPatient={onSelectPatient}
      />
    </div>
  );
};
