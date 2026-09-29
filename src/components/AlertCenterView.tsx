import React, { useState } from 'react';
import type { Alert } from '../types/icu';
import { CheckCircle2, ArrowRight } from 'lucide-react';

interface AlertCenterViewProps {
  alerts: Alert[];
  onSelectPatient: (patientId: string) => void;
}

export const AlertCenterView: React.FC<AlertCenterViewProps> = ({ alerts, onSelectPatient }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'ALL') return true;
    if (filterSeverity === 'CLINICAL_RISK') return a.severity === 'CLINICAL_RISK';
    if (filterSeverity === 'SENSOR_ANOMALY') return a.severity === 'SENSOR_ANOMALY';
    if (filterSeverity === 'RESOLVED') return a.resolved;
    if (filterSeverity === 'UNRESOLVED') return !a.resolved;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filter */}
      <div className="clinical-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">AI Alert Center & Audit Trail</h2>
          <p className="text-xs text-slate-500">Historical & active alerts, false alarm suppression audit log, and resolution statuses.</p>
        </div>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white"
        >
          <option value="ALL">All Alerts</option>
          <option value="CLINICAL_RISK">🔴 Clinical Risk</option>
          <option value="SENSOR_ANOMALY">🟡 Sensor Anomaly / Artifact</option>
          <option value="UNRESOLVED">Unresolved Only</option>
          <option value="RESOLVED">Resolved Only</option>
        </select>
      </div>

      {/* Alerts Table */}
      <div className="clinical-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Room</th>
                <th className="p-3">Alert Title</th>
                <th className="p-3">Classification</th>
                <th className="p-3">Nurse Status</th>
                <th className="p-3">Doctor Status</th>
                <th className="p-3">Resolution</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAlerts.map((alt) => (
                <tr key={alt.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono text-slate-500">{alt.timestamp}</td>
                  <td className="p-3 font-bold text-slate-900">{alt.patientName}</td>
                  <td className="p-3 text-slate-700 font-medium">{alt.room}</td>
                  <td className="p-3 font-semibold text-slate-900">{alt.title}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        alt.severity === 'CLINICAL_RISK'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {alt.severity}
                    </span>
                  </td>
                  <td className="p-3">
                    {alt.nurseAcknowledged ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acked
                      </span>
                    ) : (
                      <span className="text-amber-600 text-[11px]">Pending</span>
                    )}
                  </td>
                  <td className="p-3">
                    {alt.doctorReviewed ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed
                      </span>
                    ) : (
                      <span className="text-amber-600 text-[11px]">Pending</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      alt.resolved ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {alt.resolved ? 'Resolved' : 'Active'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onSelectPatient(alt.patientId)}
                      className="text-red-600 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
