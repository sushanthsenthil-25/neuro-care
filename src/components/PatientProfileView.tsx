import React, { useState, useEffect } from 'react';
import type { Patient, Alert, MedicalReport, Medication, IntakeOutputRecord, ClinicalNote, TimelineEvent, ShiftSummary } from '../types/icu';
import { PatientTimeline } from './PatientTimeline';
import { AnimatedNumber } from './AnimatedNumber';
import { ClinicalSkeleton } from './ClinicalSkeleton';
import { analyzePatientRisk } from '../utils/aiEngine';
import {
  Heart,
  Activity,
  AlertTriangle,
  ArrowLeft,
  Radio,
  Clock,
  ShieldCheck,
  TrendingUp,
  Database,
  Layers,
  Thermometer,
  Zap,
  Droplet,
  PieChart,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion } from 'framer-motion';

import { fetchPatientRiskScore, fetchEarlyWarningData, fetchPredictionHistory, fetchPatientAlerts, acknowledgeAlertBackend } from '../services/aiEngine';
import type { RiskPredictionResponse, EarlyWarningResponse, PredictionSnapshot, ClinicalAlert } from '../services/aiEngine';
import { RoomVisitingRecord } from './RoomVisitingRecord';

interface PatientProfileViewProps {
  patient: Patient;
  alerts: Alert[];
  reports: MedicalReport[];
  medications: Medication[];
  intakeOutput: IntakeOutputRecord[];
  notes: ClinicalNote[];
  timelineEvents: TimelineEvent[];
  shiftSummary?: ShiftSummary;
  onBackToOverview: () => void;
  onAcknowledgeAlert: (alertId: string, nurseNote: string) => void;
  onDoctorReviewAlert: (alertId: string, doctorAction: string) => void;
  onAddNote: (note: string, category: 'Progress' | 'Order' | 'Observation' | 'Handover') => void;
  currentUserRole: 'Doctor' | 'Nurse';
  currentUserName: string;
}

export const PatientProfileView: React.FC<PatientProfileViewProps> = ({
  patient,
  timelineEvents,
  onBackToOverview,
  currentUserRole = 'Doctor',
  currentUserName = 'Dr. Marcus Vance',
}) => {
  const [activeSectionAnchor, setActiveSectionAnchor] = useState<'vitals' | 'ai' | 'trends' | 'labs' | 'resp' | 'quality' | 'timeline' | 'outcomes'>('vitals');
  const [isLoading, setIsLoading] = useState(true);
  const [showAllParameters, setShowAllParameters] = useState(false);
  const [mlResult, setMlResult] = useState<RiskPredictionResponse | null>(null);
  const [ewResult, setEwResult] = useState<EarlyWarningResponse | null>(null);
  const [predHistory, setPredHistory] = useState<PredictionSnapshot[]>([]);
  const [alertsList, setAlertsList] = useState<ClinicalAlert[]>([]);

  useEffect(() => {
    setIsLoading(true);
    let isMounted = true;

    Promise.all([
      fetchPatientRiskScore(patient.id),
      fetchEarlyWarningData(patient.id),
      fetchPredictionHistory(patient.id),
      fetchPatientAlerts(patient.id)
    ]).then(([mortRes, ewRes, historyRes, alertsRes]) => {
      if (isMounted) {
        if (mortRes) setMlResult(mortRes);
        if (ewRes) setEwResult(ewRes);
        if (historyRes) setPredHistory(historyRes);
        if (alertsRes) setAlertsList(alertsRes);
      }
    }).finally(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [patient.id]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    const success = await acknowledgeAlertBackend(alertId, currentUserName || 'Dr. Marcus Vance', currentUserRole || 'Doctor');
    if (success) {
      setAlertsList((prev) =>
        prev.map((a) =>
          a.alert_id === alertId ? { ...a, status: 'ACKNOWLEDGED', acknowledged_by: `${currentUserName} (${currentUserRole})` } : a
        )
      );
    }
  };

  const patientTimeline = timelineEvents.filter((t) => t.patientId === patient.id);
  const aiResult = analyzePatientRisk(patient);

  const getStatusColor = (status: Patient['status']) => {
    switch (status) {
      case 'CRITICAL':
        return 'bg-red-600 text-white';
      case 'WARNING':
        return 'bg-red-500 text-white';
      case 'OBSERVATION':
        return 'bg-amber-500 text-white';
      case 'STABLE':
      default:
        return 'bg-emerald-600 text-white';
    }
  };

  const renderLabParam = (label: string, val: number | undefined, unit: string, normalRange?: string) => {
    return (
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
        <span className="text-[10px] text-slate-500 font-bold uppercase block">{label}</span>
        {val !== undefined ? (
          <div className="flex items-baseline justify-between">
            <span className="text-base font-black font-mono text-slate-900">{val}</span>
            <span className="text-[10px] text-slate-500 font-mono">{unit}</span>
          </div>
        ) : (
          <span className="text-xs font-bold font-mono text-slate-400 italic block py-0.5">
            Data unavailable
          </span>
        )}
        {normalRange && <span className="text-[9px] font-mono text-slate-400 block">Ref: {normalRange}</span>}
      </div>
    );
  };

  if (isLoading) {
    return <ClinicalSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={onBackToOverview}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 hover:text-red-600 transition-colors bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-lg border border-slate-300 shadow-xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> Return to 3D ICU Floor Overview
        </button>

        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            Route: /patient/{patient.id}
          </span>
          <span className="px-2.5 py-1 bg-slate-900 text-white font-mono rounded font-bold">
            NFC Tag: {patient.nfcTagId}
          </span>
        </div>
      </div>

      {/* SENSOR ARTIFACT VERIFICATION BANNER */}
      {aiResult.isArtifact && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-center justify-between text-xs text-amber-950 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-amber-600 animate-spin" />
            <span className="font-black uppercase">Sensor Anomaly Filtered</span> →
            <span className="font-semibold">Cross-Sensor Temporal Consistency Verified</span> →
            <span className="font-black bg-amber-200/80 px-2.5 py-1 rounded border border-amber-300">
              Isolated Spike Discarded (False Alarm Suppressed)
            </span>
          </div>
          <span className="text-[10px] font-mono text-amber-800 font-bold">Physiological Signals Consistent</span>
        </motion.div>
      )}

      {/* 1. PATIENT HEADER CARD (WITH CLEAR DATASET VS DEMO SOURCE DISTINCTION) */}
      <div className="clinical-card p-6 border-l-4 border-l-red-600 bg-white rounded-xl shadow-xs space-y-4">
        {/* Source Distinction Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100 rounded border border-slate-200 text-[10px] font-mono">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>CLINICAL DATA SOURCE: PhysioNet ICU Dataset 2 (RecordID {patient.id})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-extrabold border border-blue-200">
              DATASET DERIVED DATA
            </span>
            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-extrabold border border-amber-200">
              SYNTHETIC DEMO METADATA
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{patient.name}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${getStatusColor(patient.status)}`}>
                {patient.status}
              </span>
              <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2.5 py-1 rounded">
                RecordID: {patient.id}
              </span>
            </div>

            {/* Dataset Derived Patient Attributes */}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-mono text-slate-800">
              <span className="font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Age: {patient.age}Y</span>
              <span className="font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Gender: {patient.gender}</span>
              <span className="font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Height: {patient.height ?? 'Data unavailable'} cm</span>
              <span className="font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Weight: {patient.weight ?? 'Data unavailable'} kg</span>
              <span className="font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                ICU Type: {patient.icuType} ({patient.icuType === 1 ? 'CCU' : patient.icuType === 2 ? 'CSRU' : patient.icuType === 3 ? 'MICU' : 'SICU'})
              </span>
            </div>

            {/* Synthetic Metadata Context */}
            <p className="text-xs text-slate-500 mt-2">
              <span className="font-bold text-slate-800">Room: {patient.room}</span> ({patient.bedNumber}) • Diagnosis:{' '}
              <span className="font-semibold text-slate-800">{patient.diagnosis}</span>
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-red-50 rounded-xl border border-red-200">
              <span className="text-[10px] text-red-600 font-extrabold uppercase block">AI Deterioration Risk</span>
              <span className="text-xl font-black font-mono text-red-600 block mt-0.5">
                <AnimatedNumber value={aiResult.riskScore} unit="%" />
              </span>
              <span className="text-[9px] font-mono text-red-700 font-bold uppercase">{aiResult.riskLevel}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Telemetry Quality</span>
              <span className="text-base font-black text-slate-900 font-mono block mt-1">
                <AnimatedNumber value={patient.telemetryQuality.score} unit="%" />
              </span>
              <span className="text-[9px] text-slate-500 font-bold">{patient.telemetryQuality.status}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Assigned Physician</span>
              <span className="text-xs font-bold text-slate-800 block mt-1 truncate">{patient.assignedDoctor}</span>
              <span className="text-[9px] text-slate-400">Demo Assignment</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Last Updated</span>
              <span className="text-xs font-mono font-bold text-slate-800 block mt-1">10:42 AM</span>
              <span className="text-[9px] text-emerald-600 font-bold">Real-time Sync</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK JUMP SECTION ANCHORS */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex space-x-2 min-w-max text-xs font-bold font-mono">
          {[
            { id: 'vitals', label: '1. Current Vitals' },
            { id: 'ai', label: '2. AI Deterioration Engine' },
            { id: 'trends', label: '3. Vital Trends' },
            { id: 'labs', label: '4. 42 Lab Parameters' },
            { id: 'resp', label: '5. Ventilation & Gas' },
            { id: 'quality', label: '6. Data Quality' },
            { id: 'timeline', label: '7. Clinical Timeline' },
            { id: 'outcomes', label: '8. Severity & Outcomes' },
          ].map((item) => (
            <a
              key={item.id}
              href={`#section-${item.id}`}
              onClick={() => setActiveSectionAnchor(item.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeSectionAnchor === item.id
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* 2. SECTION: CURRENT VITALS */}
      <div id="section-vitals" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-600" /> 1. Current Bedside Vitals (Dataset Telemetry)
          </h3>
          <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Live Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Heart Rate */}
          <div className="clinical-card p-4 space-y-2 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-red-600" /> Heart Rate (HR)
              </span>
              <span className="text-xs font-mono text-slate-400">{patient.vitals.heartRate.timestamp}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono ${patient.vitals.heartRate.current > 100 ? 'text-red-600' : 'text-slate-900'}`}>
                <AnimatedNumber value={patient.vitals.heartRate.current} />
              </span>
              <span className="text-xs font-bold text-slate-500">bpm {patient.vitals.heartRate.trend === 'up' ? '↑' : '→'}</span>
            </div>
            <div className="text-[10px] space-y-0.5 border-t border-slate-100 pt-2 font-mono">
              <div className="text-slate-500">Expected: {patient.vitals.heartRate.expectedRange.join('-')} bpm</div>
              <div className="text-amber-600">Warning: {patient.vitals.heartRate.warningRange.join('-')} bpm</div>
            </div>
          </div>

          {/* SpO2 */}
          <div className="clinical-card p-4 space-y-2 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-600" /> SpO₂ Oxygen
              </span>
              <span className="text-xs font-mono text-slate-400">{patient.vitals.spo2.timestamp}</span>
            </div>
            <div className="flex items-baseline gap-2">
              {patient.hasSpo2 !== false && patient.vitals.spo2.current > 0 ? (
                <>
                  <span className={`text-3xl font-black font-mono ${patient.vitals.spo2.current < 92 ? 'text-red-600' : 'text-slate-900'}`}>
                    <AnimatedNumber value={patient.vitals.spo2.current} unit="%" />
                  </span>
                  <span className="text-xs font-bold text-slate-500">{patient.vitals.spo2.trend === 'down' ? '↓' : '→'}</span>
                </>
              ) : (
                <span className="text-sm font-bold font-mono text-slate-400 italic py-1.5">
                  Data unavailable
                </span>
              )}
            </div>
            <div className="text-[10px] space-y-0.5 border-t border-slate-100 pt-2 font-mono">
              <div className="text-slate-500">Expected: {patient.vitals.spo2.expectedRange.join('-')}%</div>
              <div className="text-amber-600">Warning: {patient.vitals.spo2.warningRange.join('-')}%</div>
            </div>
          </div>

          {/* Blood Pressure */}
          <div className="clinical-card p-4 space-y-2 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">Blood Pressure (BP)</span>
              <span className="text-xs font-mono text-slate-400">{patient.vitals.bpSystolic.timestamp}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-slate-900">
                <AnimatedNumber value={patient.vitals.bpSystolic.current} />/<AnimatedNumber value={patient.vitals.bpDiastolic.current} />
              </span>
              <span className="text-xs font-bold text-slate-500">mmHg</span>
            </div>
            <div className="text-[10px] space-y-0.5 border-t border-slate-100 pt-2 font-mono">
              <div className="text-slate-500">Expected Sys: {patient.vitals.bpSystolic.expectedRange.join('-')}</div>
              <div className="text-amber-600">Warning Sys: {patient.vitals.bpSystolic.warningRange.join('-')}</div>
            </div>
          </div>

          {/* Resp Rate */}
          <div className="clinical-card p-4 space-y-2 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">Resp Rate (RR)</span>
              <span className="text-xs font-mono text-slate-400">{patient.vitals.respRate.timestamp}</span>
            </div>
            <div className="flex items-baseline gap-2">
              {patient.hasRespRate !== false && patient.vitals.respRate.current > 0 ? (
                <>
                  <span className={`text-3xl font-black font-mono ${patient.vitals.respRate.current > 24 ? 'text-red-600' : 'text-slate-900'}`}>
                    <AnimatedNumber value={patient.vitals.respRate.current} />
                  </span>
                  <span className="text-xs font-bold text-slate-500">rpm {patient.vitals.respRate.trend === 'up' ? '↑' : '→'}</span>
                </>
              ) : (
                <span className="text-sm font-bold font-mono text-slate-400 italic py-1.5">
                  Data unavailable
                </span>
              )}
            </div>
            <div className="text-[10px] space-y-0.5 border-t border-slate-100 pt-2 font-mono">
              <div className="text-slate-500">Expected: {patient.vitals.respRate.expectedRange.join('-')} rpm</div>
              <div className="text-amber-600">Warning: {patient.vitals.respRate.warningRange.join('-')} rpm</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECTION: AI CLINICAL PREDICTION & EARLY WARNING ENGINE */}
      <div id="section-ai" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-600" /> 2. AI Clinical Prediction & Early Warning Engine
          </h3>
          <span className="text-xs font-mono font-bold text-red-700 bg-red-50 px-3 py-1 rounded border border-red-200">
            Predicted Mortality Risk: <AnimatedNumber value={mlResult ? mlResult.risk_percentage : patient.deteriorationRisk} unit="%" />
          </span>
        </div>

        <div className="clinical-card p-6 bg-white border-l-4 border-l-red-600 rounded-xl space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                <h4 className="text-sm font-extrabold text-slate-900 uppercase">AI Prediction & Early Warning Analysis</h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Model target: <strong className="text-slate-700">inHospitalDeath</strong> (Predicted In-Hospital Mortality Risk). Evaluated at decision threshold 0.120.
              </p>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs font-bold text-slate-600">Data Quality Rating:</span>{' '}
              <span className={`text-xs font-black px-2 py-0.5 rounded border ${
                (mlResult?.data_quality || ewResult?.data_quality) === 'DEGRADED' 
                  ? 'text-amber-700 bg-amber-50 border-amber-300'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-300'
              }`}>
                {mlResult?.data_quality || ewResult?.data_quality || 'GOOD'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-slate-700 uppercase">Contributing Telemetry Signals:</h5>
              <ul className="space-y-2">
                {aiResult.explanations.map((exp, idx) => (
                  <li key={idx} className="text-xs text-slate-800 flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono">
                    <span className="text-red-600 font-black">•</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 bg-slate-900 text-white p-4 rounded-xl font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="font-bold text-emerald-400">AI PREDICTION & AUDIT SNAPSHOT</span>
                <span className="text-[10px] text-slate-400">RecordID {patient.id}</span>
              </div>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between"><span>Model Target:</span> <span className="text-white font-bold">inHospitalDeath</span></div>
                <div className="flex justify-between"><span>Model Version:</span> <span className="text-emerald-400 font-bold">{mlResult?.model_version || 'XGBoost-ICU-v1'}</span></div>
                <div className="flex justify-between"><span>Data Cutoff Window:</span> <span className="text-white font-bold">{mlResult?.data_cutoff || '48.0 Hours ICU Window'}</span></div>
                <div className="flex justify-between"><span>Decision Threshold:</span> <span className="text-amber-400 font-bold">0.120 (12.0%)</span></div>
              </div>

              {mlResult && (
                <div className="mt-3 p-3 bg-slate-800 rounded-lg border border-slate-700 text-xs font-mono space-y-1 text-slate-200">
                  <div className="flex justify-between font-bold text-amber-400">
                    <span>A. PREDICTED MORTALITY RISK:</span>
                    <span>{mlResult.risk_percentage}% ({mlResult.risk_level})</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Model: {mlResult.model_version}</span>
                    <span>AUROC: {mlResult.evaluation_auroc}</span>
                  </div>
                  {mlResult.top_clinical_drivers.length > 0 && (
                    <div className="pt-2 border-t border-slate-700 text-[10px]">
                      <div className="font-bold text-slate-300 mb-1">Top Model SHAP Contributors:</div>
                      {mlResult.top_clinical_drivers.slice(0, 3).map((d, i) => (
                        <div key={i} className="text-slate-400 truncate">• {d.clinical_significance}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {ewResult && (
                <div className="mt-2 p-3 bg-slate-800 rounded-lg border border-slate-700 text-xs font-mono space-y-1 text-slate-200">
                  <div className="flex justify-between font-bold text-emerald-400">
                    <span>B. CURRENT TRAJECTORY / EARLY WARNING:</span>
                    <span>{ewResult.early_warning_level} ({ewResult.trajectory_score} pts)</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Engine: {ewResult.engine_name}</span>
                    <span>Trajectory: {ewResult.trend_direction}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Data Quality: {ewResult.data_quality}</span>
                    <span>Artifacts Filtered: {ewResult.artifacts_detected}</span>
                  </div>
                  {ewResult.supporting_signals.length > 0 && (
                    <div className="pt-2 border-t border-slate-700 text-[10px]">
                      <div className="font-bold text-slate-300 mb-1">Early-Warning Trajectory Signals:</div>
                      {ewResult.supporting_signals.slice(0, 3).map((sig, i) => (
                        <div key={i} className="text-amber-300 truncate">• {sig.description}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clinical Model Alerts Section */}
        {alertsList.length > 0 && (
          <div className="clinical-card p-5 bg-white border border-red-200 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" /> Active Clinical Model Alerts ({alertsList.length})
              </h4>
              <span className="text-[10px] font-mono text-slate-500">Real-Time Risk Engine Audit</span>
            </div>
            <div className="space-y-2">
              {alertsList.map((alt) => (
                <div key={alt.alert_id} className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-xs font-mono ${
                  alt.status === 'ACTIVE' ? 'bg-red-50/70 border-red-300' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{alt.title}</span>
                      <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded font-bold">{alt.type}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                        alt.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>{alt.status}</span>
                    </div>
                    <p className="text-slate-700 text-[11px]">{alt.message}</p>
                    <div className="text-[10px] text-slate-500 flex items-center gap-3">
                      <span>Cutoff: {alt.data_cutoff}</span>
                      <span>Created: {alt.created_at ? new Date(alt.created_at).toLocaleTimeString() : 'Recent'}</span>
                      {alt.acknowledged_by && <span className="text-emerald-700 font-bold">Ack by: {alt.acknowledged_by}</span>}
                    </div>
                  </div>

                  {alt.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleAcknowledgeAlert(alt.alert_id)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition-colors shadow-xs"
                    >
                      Acknowledge Alert
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chronological Prediction History Audit Trail */}
        <div className="clinical-card p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" /> Chronological Model Prediction History (RecordID {patient.id})
            </h4>
            <span className="text-[10px] font-mono text-slate-500">Patient-Isolated Audit Trail</span>
          </div>

          {predHistory.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {predHistory.map((snap, idx) => (
                <div key={snap.prediction_id || idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs font-mono">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{snap.generated_at ? new Date(snap.generated_at).toLocaleTimeString() : `Assessment #${idx+1}`}</span>
                    <span className="font-bold text-slate-700">{snap.data_quality} Quality</span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-lg font-black text-slate-900">{snap.percentage}%</span>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-slate-900 text-white rounded">{snap.risk_level}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 border-t border-slate-200/50 pt-1 flex justify-between">
                    <span>{snap.model_version}</span>
                    <span>Thresh: 12.0%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic font-mono p-2 bg-slate-50 rounded border border-slate-200">
              Prediction history will appear as new model assessments are generated.
            </p>
          )}
        </div>
      </div>

      {/* 4. SECTION: VITAL TRENDS */}
      <div id="section-trends" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-600" /> 3. Vital Trends & Chronological Trajectories
          </h3>
          <span className="text-xs font-mono text-slate-500">6H • 12H • 24H • 48H Timeline</span>
        </div>

        <PatientTimeline events={patientTimeline} vitals={patient.vitals} patientId={patient.id} />
      </div>

      {/* 5. SECTION: ALL 42 DATASET PARAMETERS ORGANIZED IN LOGICAL CLINICAL GROUPS */}
      <div id="section-labs" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-red-600" /> 4. Dataset 2 Laboratory & Clinical Parameters (42 Parameters)
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-blue-50 text-blue-900 px-2.5 py-1 rounded border border-blue-200 font-bold">
              PhysioNet Challenge 2012 Cohort
            </span>
            <button
              onClick={() => setShowAllParameters(!showAllParameters)}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold font-mono bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-700 shadow-xs transition-colors"
            >
              {showAllParameters ? (
                <>
                  <span>SHOW LESS</span>
                  <ChevronUp className="w-4 h-4 text-red-400" />
                </>
              ) : (
                <>
                  <span>SHOW MORE (42 Parameters)</span>
                  <ChevronDown className="w-4 h-4 text-emerald-400" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* PRIMARY LAB PARAMETERS OVERVIEW (DEFAULT VISIBLE) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* GROUP 1: RENAL / FLUID */}
          <div className="clinical-card p-4 space-y-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
              <Droplet className="w-4 h-4 text-blue-600" /> Renal & Fluid Parameters
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {renderLabParam('Urine Output', patient.vitals.urineOutput.current, 'ml/hr', '>30 ml/hr')}
              {renderLabParam('BUN', patient.labs?.bun, 'mg/dL', '7-20 mg/dL')}
              {renderLabParam('Creatinine', patient.labs?.creatinine, 'mg/dL', '0.6-1.2 mg/dL')}
            </div>
          </div>

          {/* GROUP 2: ELECTROLYTES / METABOLIC */}
          <div className="clinical-card p-4 space-y-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" /> Electrolytes & Metabolic
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {renderLabParam('Glucose', patient.labs?.glucose, 'mg/dL', '70-99 mg/dL')}
              {renderLabParam('Sodium (Na)', patient.labs?.na, 'mEq/L', '135-145 mEq/L')}
              {renderLabParam('Potassium (K)', patient.labs?.k, 'mEq/L', '3.5-5.0 mEq/L')}
              {renderLabParam('Magnesium (Mg)', patient.labs?.mg, 'mEq/L', '1.7-2.2 mEq/L')}
              {renderLabParam('HCO3', patient.labs?.hco3, 'mEq/L', '22-29 mEq/L')}
            </div>
          </div>

          {/* GROUP 3: BLOOD / HEMATOLOGY */}
          <div className="clinical-card p-4 space-y-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-600" /> Blood & Hematology
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {renderLabParam('Hematocrit (HCT)', patient.labs?.hct, '%', '38-50%')}
              {renderLabParam('WBC Count', patient.labs?.wbc, 'k/uL', '4.5-11.0 k/uL')}
              {renderLabParam('Platelets', patient.labs?.platelets, 'k/uL', '150-450 k/uL')}
              {renderLabParam('Albumin', patient.labs?.albumin, 'g/dL', '3.4-5.4 g/dL')}
            </div>
          </div>
        </div>

        {/* EXPANDED PARAMETERS (VISIBLE WHEN SHOW MORE IS CLICKED) */}
        {showAllParameters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2"
          >
            {/* GROUP 4: PERFUSION & CARDIAC */}
            <div className="clinical-card p-4 space-y-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" /> Perfusion & Cardiac Markers
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {renderLabParam('Lactate', patient.labs?.lactate, 'mmol/L', '<2.0 mmol/L')}
                {renderLabParam('Troponin I', patient.labs?.troponinI, 'ng/mL', '<0.04 ng/mL')}
                {renderLabParam('Troponin T', patient.labs?.troponinT, 'ng/mL', '<0.01 ng/mL')}
              </div>
            </div>

            {/* GROUP 5: LIVER FUNCTION */}
            <div className="clinical-card p-4 space-y-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-600" /> Hepatic Panel (Liver)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {renderLabParam('ALT', patient.labs?.alt, 'U/L', '7-56 U/L')}
                {renderLabParam('AST', patient.labs?.ast, 'U/L', '10-40 U/L')}
                {renderLabParam('ALP', patient.labs?.alp, 'U/L', '44-147 U/L')}
                {renderLabParam('Bilirubin', patient.labs?.bilirubin, 'mg/dL', '0.1-1.2 mg/dL')}
                {renderLabParam('Cholesterol', patient.labs?.cholesterol, 'mg/dL', '<200 mg/dL')}
              </div>
            </div>

            {/* GROUP 6: INVASIVE / NON-INVASIVE BP */}
            <div className="clinical-card p-4 space-y-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-700" /> Hemodynamic MAP & NIBP
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {renderLabParam('Invasive MAP', patient.labs?.map ?? Math.round((patient.vitals.bpSystolic.current + 2 * patient.vitals.bpDiastolic.current) / 3), 'mmHg', '70-100 mmHg')}
                {renderLabParam('Non-Invasive MAP', patient.labs?.niMap ?? Math.round((patient.vitals.bpSystolic.current + 2 * patient.vitals.bpDiastolic.current) / 3), 'mmHg', '70-100 mmHg')}
                {renderLabParam('SysABP (Invasive)', patient.labs?.sysABP ?? patient.vitals.bpSystolic.current, 'mmHg', '100-130')}
                {renderLabParam('DiasABP (Invasive)', patient.labs?.diasABP ?? patient.vitals.bpDiastolic.current, 'mmHg', '60-85')}
              </div>
            </div>
          </motion.div>
        )}

        {/* BOTTOM SHOW MORE / SHOW LESS TOGGLE BAR */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setShowAllParameters(!showAllParameters)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold font-mono border border-slate-300 shadow-xs transition-all active:scale-95"
          >
            {showAllParameters ? (
              <>
                <span>SHOW LESS (Collapse to Primary Parameters)</span>
                <ChevronUp className="w-4 h-4 text-red-600" />
              </>
            ) : (
              <>
                <span>SHOW MORE (Expand Remaining Clinical Parameters)</span>
                <ChevronDown className="w-4 h-4 text-emerald-600" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* 6. SECTION: RESPIRATORY & VENTILATION */}
      <div id="section-resp" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-red-600" /> 5. Respiratory & Ventilation Management
          </h3>
          {patient.mechVent ? (
            <span className="text-xs font-mono font-bold bg-blue-100 text-blue-900 px-3 py-1 rounded border border-blue-300">
              Mechanical Ventilation: YES
            </span>
          ) : (
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1 rounded border border-slate-200">
              Mechanical Ventilation: NO
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderLabParam('PaO2 (Arterial O2)', patient.labs?.pao2, 'mmHg', '75-100 mmHg')}
          {renderLabParam('PaCO2 (Arterial CO2)', patient.labs?.paco2, 'mmHg', '35-45 mmHg')}
          {renderLabParam('pH (Arterial)', patient.labs?.ph, '', '7.35-7.45')}
          {renderLabParam('FiO2 (Inspired O2 Fraction)', patient.labs?.fio2 ? Math.round(patient.labs.fio2 * 100) : undefined, '%', '21-100%')}
        </div>
      </div>

      {/* 7. SECTION: DATA QUALITY ENGINE */}
      <div id="section-quality" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" /> 6. Telemetry Data Quality Engine
          </h3>
          <span className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            Signal Score: {patient.telemetryQuality.score}% ({patient.telemetryQuality.status})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 uppercase font-bold block text-[10px]">Missing Signals Count</span>
            <span className="text-xl font-black text-slate-900 font-mono">{patient.telemetryQuality.missingReadings}</span>
            <span className="text-slate-500 block text-[10px]">Irregular observation gap detected</span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 uppercase font-bold block text-[10px]">Filtered Sensor Artifacts</span>
            <span className="text-xl font-black text-amber-600 font-mono">{patient.telemetryQuality.sensorAnomalies}</span>
            <span className="text-slate-500 block text-[10px]">Isolated spikes suppressed</span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-slate-500 uppercase font-bold block text-[10px]">Sampling Interval</span>
            <span className="text-xl font-black text-slate-900 font-mono">Irregular (ICU Telemetry)</span>
            <span className="text-slate-500 block text-[10px]">Chronological timestamp aligned</span>
          </div>
        </div>
      </div>

      {/* 8. SECTION: CLINICAL TIMELINE */}
      <div id="section-timeline" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-600" /> 7. Chronological Clinical Timeline
          </h3>
          <span className="text-xs font-mono text-slate-500">RecordID {patient.id} Observations</span>
        </div>

        <div className="clinical-card p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
          {patientTimeline.length > 0 ? (
            <div className="space-y-3">
              {patientTimeline.map((evt) => (
                <div key={evt.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{evt.title}</div>
                    <div className="text-slate-600 mt-0.5">{evt.description}</div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    {evt.timestamp}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs font-mono text-slate-500 text-center py-6">
              Chronological observation events recorded up to current timestamp.
            </div>
          )}
        </div>
      </div>

      {/* 9. SECTION: OUTCOME & SEVERITY CONTEXT (OUTCOMES-TRAIN.TXT DATASET SOURCE) */}
      <div id="section-outcomes" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" /> 8. Dataset Severity Scores & Hospital Outcomes
          </h3>
          <span className="text-xs font-mono bg-blue-50 text-blue-900 px-2.5 py-1 rounded border border-blue-200 font-bold">
            Source: train/Outcomes-train.txt
          </span>
        </div>

        <div className="clinical-card p-6 bg-white border-l-4 border-l-blue-600 rounded-xl space-y-4 shadow-xs">
          <p className="text-xs text-slate-600">
            PhysioNet Dataset 2 outcome fields recorded upon ICU discharge. Used for retrospective severity stratification and AI outcome modeling.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">SAPS-I Score</span>
              <span className="text-lg font-black font-mono text-slate-900 block mt-1">
                {patient.outcome?.sapsI ?? 'N/A'}
              </span>
              <span className="text-[9px] text-slate-400">Physiology Score</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">SOFA Score</span>
              <span className="text-lg font-black font-mono text-slate-900 block mt-1">
                {patient.outcome?.sofa ?? 'N/A'}
              </span>
              <span className="text-[9px] text-slate-400">Organ Failure</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">ICU Length of Stay</span>
              <span className="text-lg font-black font-mono text-slate-900 block mt-1">
                {patient.outcome?.lengthOfStay ?? 'N/A'} days
              </span>
              <span className="text-[9px] text-slate-400">Recorded Stay</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Survival</span>
              <span className="text-lg font-black font-mono text-slate-900 block mt-1">
                {patient.outcome?.survivalDays ?? 'N/A'} days
              </span>
              <span className="text-[9px] text-slate-400">Follow-up Days</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">In-Hospital Death</span>
              <span className={`text-base font-black font-mono block mt-1 ${patient.outcome?.inHospitalDeath === 1 ? 'text-red-600' : 'text-emerald-600'}`}>
                {patient.outcome?.inHospitalDeath === 1 ? 'Deceased (1)' : 'Survived (0)'}
              </span>
              <span className="text-[9px] text-slate-400">Primary Binary Outcome</span>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURE 1: PATIENT ROOM VISITING RECORD */}
      <RoomVisitingRecord
        patientId={patient.id}
        roomId={patient.room}
        userRole={currentUserRole}
        userName={currentUserName}
      />
    </motion.div>
  );
};
