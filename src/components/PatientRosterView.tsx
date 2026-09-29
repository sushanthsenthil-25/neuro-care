import React, { useState } from 'react';
import type { Patient } from '../types/icu';
import { Search, ArrowRight } from 'lucide-react';

interface PatientRosterViewProps {
  patients: Patient[];
  onSelectPatient: (patientId: string) => void;
}

export const PatientRosterView: React.FC<PatientRosterViewProps> = ({ patients, onSelectPatient }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.assignedDoctor.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="clinical-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">ICU Patient Roster Registry</h2>
          <p className="text-xs text-slate-500">Searchable list of all active ICU patients with live vital summaries and risk scores.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, Name, Room, Doctor..."
              className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-64 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="OBSERVATION">Observation</option>
            <option value="STABLE">Stable</option>
          </select>
        </div>
      </div>

      {/* Roster Table */}
      <div className="clinical-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3">Patient ID</th>
                <th className="p-3">Patient Name</th>
                <th className="p-3">Room / Bed</th>
                <th className="p-3">Age / Gender</th>
                <th className="p-3">Diagnosis</th>
                <th className="p-3">HR</th>
                <th className="p-3">SpO₂</th>
                <th className="p-3">BP</th>
                <th className="p-3">Risk Score</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onSelectPatient(p.id)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-mono font-bold text-slate-900">{p.id}</td>
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 font-medium text-slate-700">{p.room}</td>
                  <td className="p-3 text-slate-600">{p.age}y / {p.gender[0]}</td>
                  <td className="p-3 text-slate-700 max-w-xs truncate">{p.diagnosis}</td>
                  <td className={`p-3 font-mono font-semibold ${p.vitals.heartRate.current > 100 ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                    {p.vitals.heartRate.current} <span className="text-[9px] text-slate-400">bpm</span>
                  </td>
                  <td className={`p-3 font-mono font-semibold ${p.vitals.spo2.current < 92 ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                    {p.vitals.spo2.current}%
                  </td>
                  <td className="p-3 font-mono text-slate-700">
                    {p.vitals.bpSystolic.current}/{p.vitals.bpDiastolic.current}
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-900">{p.deteriorationRisk}%</td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.status === 'CRITICAL'
                          ? 'bg-red-50 text-red-700 border-red-300'
                          : p.status === 'WARNING'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : p.status === 'OBSERVATION'
                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button className="text-red-600 hover:text-red-700 font-bold text-xs inline-flex items-center gap-1">
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
