import React from 'react';
import type { ShiftSummary, Patient } from '../types/icu';
import { Moon, Stethoscope } from 'lucide-react';

interface ShiftSummaryCardProps {
  summary: ShiftSummary;
  patient: Patient;
}

export const ShiftSummaryCard: React.FC<ShiftSummaryCardProps> = ({ summary, patient }) => {
  return (
    <div className="clinical-card p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <Moon className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Automated Overnight Clinical Shift Summary</h3>
            <p className="text-xs text-slate-500">{summary.shiftTime} — Generated for Patient {patient.name} ({patient.id})</p>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-bold border ${
            (summary.overallTrajectory || '').includes('Worsening')
              ? 'bg-red-50 text-red-700 border-red-300'
              : 'bg-emerald-50 text-emerald-700 border-emerald-300'
          }`}
        >
          Trajectory: {summary.overallTrajectory || 'STABLE'}
        </span>
      </div>

      {/* Vital Trend Grid */}
      <div>
        <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Overnight Vital Telemetry Trends</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Heart Rate</span>
            <span className="text-xs font-bold text-slate-900">{summary.vitalTrends.hr}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">SpO₂ Oxygen</span>
            <span className="text-xs font-bold text-slate-900">{summary.vitalTrends.spo2}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Blood Pressure</span>
            <span className="text-xs font-bold text-slate-900">{summary.vitalTrends.bp}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Temperature</span>
            <span className="text-xs font-bold text-slate-900">{summary.vitalTrends.temp}</span>
          </div>
        </div>
      </div>

      {/* Shift Events & Activity Ticker */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100/60 rounded-lg border border-slate-200 text-center text-xs">
        <div>
          <span className="text-slate-500 font-medium block">Clinical Alerts</span>
          <span className="font-bold text-red-600 text-sm">{summary.alertsCount} Alerts</span>
        </div>
        <div>
          <span className="text-slate-500 font-medium block">Sensor Anomalies</span>
          <span className="font-bold text-amber-600 text-sm">{summary.sensorAnomaliesCount} Filtered</span>
        </div>
        <div>
          <span className="text-slate-500 font-medium block">Nurse Logged</span>
          <span className="font-bold text-emerald-600 text-sm">{summary.nurseAcknowledgementsCount} Notes</span>
        </div>
      </div>

      {/* Medications Summary */}
      <div>
        <h4 className="text-xs font-bold text-slate-700 uppercase mb-1">Medications Administered During Shift</h4>
        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 font-mono">
          {summary.medicationsSummary}
        </p>
      </div>

      {/* Recommendation & Clinical Determination Note */}
      <div className="p-3 bg-red-50/60 rounded-lg border border-red-200 text-xs text-red-900 space-y-1">
        <div className="flex items-center gap-1.5 font-bold">
          <Stethoscope className="w-4 h-4 text-red-600" />
          <span>Intensivist Action Recommendation:</span>
        </div>
        <p className="text-slate-700">{summary.recommendation}</p>
        <span className="text-[10px] text-slate-500 italic block mt-1">
          * Note: Measured parameters changed following medication administration. Definitive clinical evaluation remains under physician authority.
        </span>
      </div>
    </div>
  );
};
