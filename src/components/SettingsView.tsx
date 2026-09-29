import React from 'react';
import { Settings, RefreshCw, UserCheck } from 'lucide-react';

interface SettingsViewProps {
  currentUserRole: 'Doctor' | 'Nurse';
  onRoleChange: (role: 'Doctor' | 'Nurse') => void;
  isSimulationActive: boolean;
  onToggleSimulation: () => void;
  onResetDemoData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUserRole,
  onRoleChange,
  isSimulationActive,
  onToggleSimulation,
  onResetDemoData,
}) => {
  return (
    <div className="space-y-5">
      <div className="clinical-card p-5 border-l-4 border-l-red-600">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-100">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">System & AI Threshold Configuration</h2>
            <p className="text-xs text-slate-500">Configure false-alarm filter sensitivity, patient baseline ranges, and role access settings.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* User Role & Access Control */}
        <div className="clinical-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-red-600" /> Active User Session & Role Simulation
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">Logged-In Clinical Role:</label>
            <div className="flex gap-3">
              <button
                onClick={() => onRoleChange('Doctor')}
                className={`flex-1 p-3 rounded-lg border text-xs font-bold transition-colors ${
                  currentUserRole === 'Doctor' ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                Doctor / Attending Intensivist
              </button>
              <button
                onClick={() => onRoleChange('Nurse')}
                className={`flex-1 p-3 rounded-lg border text-xs font-bold transition-colors ${
                  currentUserRole === 'Nurse' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                Bedside / Charge Nurse
              </button>
            </div>
          </div>
        </div>

        {/* Demo & Live Simulation Control */}
        <div className="clinical-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-red-600" /> Hackathon Demo & Real-Time Telemetry Simulation
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Live Telemetry Simulation Engine</span>
                <span className="text-[10px] text-slate-500">Gradual deterioration & false artifact spike simulator</span>
              </div>
              <button
                onClick={onToggleSimulation}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  isSimulationActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {isSimulationActive ? 'Active (Running)' : 'Disabled'}
              </button>
            </div>

            <button
              onClick={onResetDemoData}
              className="w-full p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded border border-slate-300 transition-colors"
            >
              Reset Demo Dataset to Initial Benchmark State
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
