import React, { useState } from 'react';
import type { Patient } from '../types/icu';
import { Search } from 'lucide-react';

interface DischargedPatientsViewProps {
  dischargedPatients: Patient[];
}

export const DischargedPatientsView: React.FC<DischargedPatientsViewProps> = ({ dischargedPatients }) => {
  const [search, setSearch] = useState('');

  const filtered = dischargedPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.diagnosis.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="clinical-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Discharged Patient Archives & Clinical Summary</h2>
          <p className="text-xs text-slate-500">Historical archive of patients discharged from NeuroCare ICU.</p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search discharged archives..."
            className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-64 focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="clinical-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
            <tr>
              <th className="p-3">Patient ID</th>
              <th className="p-3">Patient Name</th>
              <th className="p-3">Admission Date</th>
              <th className="p-3">Discharge Date</th>
              <th className="p-3">Final Diagnosis</th>
              <th className="p-3">Attending Doctor</th>
              <th className="p-3">Final Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3 font-mono font-bold text-slate-900">{p.id}</td>
                <td className="p-3 font-bold text-slate-900">{p.name}</td>
                <td className="p-3 font-mono text-slate-600">{p.admissionDate}</td>
                <td className="p-3 font-mono text-slate-600">{p.dischargeDate || '—'}</td>
                <td className="p-3 text-slate-700">{p.diagnosis}</td>
                <td className="p-3 text-slate-700">{p.assignedDoctor}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                    Discharged / Recovered
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
