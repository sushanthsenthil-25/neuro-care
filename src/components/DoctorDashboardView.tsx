import React, { useState, useEffect } from 'react';
import type { Patient, Alert, ShiftSummary } from '../types/icu';
import { Stethoscope, Moon, ArrowRight, Users, ShieldAlert, Bell } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { fetchActiveAlertsOverview } from '../services/aiEngine';
import type { ClinicalAlert } from '../services/aiEngine';

interface DoctorDashboardViewProps {
  patients: Patient[];
  alerts: Alert[];
  shiftSummaries: Record<string, ShiftSummary>;
  onSelectPatient: (patientId: string) => void;
}

export const DoctorDashboardView: React.FC<DoctorDashboardViewProps> = ({
  patients,
  alerts,
  shiftSummaries,
  onSelectPatient,
}) => {
  const [activeModelAlerts, setActiveModelAlerts] = useState<ClinicalAlert[]>([]);

  useEffect(() => {
    fetchActiveAlertsOverview().then((alertsData) => {
      if (alertsData) setActiveModelAlerts(alertsData);
    });
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

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">New Alerts</span>
            <span className="text-xl font-black font-mono text-red-600 block mt-0.5">{activeAlerts.length}</span>
            <span className="text-[9px] text-slate-500">Unresolved</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Assigned Patients Rounding Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="clinical-card p-5 space-y-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-800" /> Assigned Patient Clinical Priority Roster
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
                      ? 'bg-red-50/60 border-red-300 shadow-sm hover:border-red-400'
                      : p.status === 'WARNING'
                      ? 'bg-red-50/30 border-red-200 hover:border-red-300'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">Patient ID: {p.id}</span>
                      <span className="text-xs font-mono bg-slate-900 text-white px-2 py-0.5 rounded font-bold">
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

                    <div className="text-xs text-slate-600 font-mono">
                      Age: <strong className="text-slate-800">{p.age}Y</strong> • Gender:{' '}
                      <strong className="text-slate-800">{p.gender}</strong> • ICU Type:{' '}
                      <strong className="text-slate-800">{p.icuType}</strong> ({p.diagnosis})
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono pt-1 text-slate-800">
                      <span>HR: <strong className="font-extrabold text-slate-900">{p.vitals.heartRate.current} bpm</strong></span>
                      <span>BP: <strong className="font-extrabold text-slate-900">{p.vitals.bpSystolic.current}/{p.vitals.bpDiastolic.current}</strong></span>
                      <span>
                        SpO₂:{' '}
                        {p.hasSpo2 !== false && p.vitals.spo2.current > 0 ? (
                          <strong className="font-extrabold text-slate-900">{p.vitals.spo2.current}%</strong>
                        ) : (
                          <span className="text-slate-400 italic font-sans">Data unavailable</span>
                        )}
                      </span>
                      <span>GCS: <strong className="font-extrabold text-slate-900">{p.gcs ?? 15}</strong></span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-2 shrink-0 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">In-Hospital Mortality Risk (XGBoost-ICU-v1)</span>
                      <span className="text-xs font-bold text-red-600 block">
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
          <div className="clinical-card p-5 space-y-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Moon className="w-4 h-4 text-amber-500" /> Overnight Shift Summaries Ready for Review
            </h3>
            {Object.values(shiftSummaries).map((sum) => (
              <div key={sum.patientId} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">RecordID: {sum.patientId}</span>
                  <span className="text-red-600 font-bold">{sum.overallTrajectory}</span>
                </div>
                <p className="text-xs text-slate-600">{sum.recommendation}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Active Clinical Alerts */}
        <div className="space-y-4">
          <div className="clinical-card p-5 space-y-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" /> Active Unresolved Clinical Alerts ({activeAlerts.length})
              </h3>
            </div>

            <div className="space-y-3">
              {activeAlerts.map((alt) => (
                <div
                  key={alt.id}
                  onClick={() => onSelectPatient(alt.patientId)}
                  className="p-3.5 bg-red-50 rounded-xl border border-red-200 cursor-pointer hover:bg-red-100/70 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-red-950">
                    <span>{alt.title}</span>
                    <span className="text-[10px] font-mono text-slate-500">{alt.timestamp}</span>
                  </div>
                  <div className="text-xs text-slate-800 font-mono font-bold">
                    Patient ID {alt.patientId} ({alt.room})
                  </div>
                  <p className="text-xs text-slate-700 line-clamp-2">{alt.explanation[0]}</p>
                  <div className="pt-1 text-[10px] font-mono text-red-700 font-bold flex items-center justify-between">
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
            <div className="clinical-card p-5 space-y-3 bg-white rounded-xl border border-red-200 shadow-xs font-mono">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Bell className="w-4 h-4 text-red-600 animate-bounce" /> Model Risk Engine Alerts ({activeModelAlerts.length})
                </h3>
                <span className="text-[10px] text-slate-500">Live Backend Audit</span>
              </div>
              <div className="space-y-2">
                {activeModelAlerts.map((alt) => (
                  <div
                    key={alt.alert_id}
                    onClick={() => onSelectPatient(alt.patient_id)}
                    className="p-3 bg-red-50/80 rounded-lg border border-red-200 cursor-pointer hover:bg-red-100 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                      <span>{alt.title}</span>
                      <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded">{alt.risk_level}</span>
                    </div>
                    <div className="text-[11px] text-slate-700">Patient ID: {alt.patient_id} ({alt.room_id})</div>
                    <p className="text-[10px] text-slate-600 line-clamp-2">{alt.message}</p>
                    <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-200/60 pt-1">
                      <span>Cutoff: {alt.data_cutoff}</span>
                      <span className="text-red-700 font-bold flex items-center gap-0.5">Open Details <ArrowRight className="w-2.5 h-2.5" /></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
