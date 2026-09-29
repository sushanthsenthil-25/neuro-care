import React, { useState, useEffect } from 'react';
import { UserCheck, ShieldCheck, LogIn, LogOut, Tag } from 'lucide-react';
import { fetchRoomAccessEvents, logRoomAccessEventBackend } from '../services/aiEngine';
import type { RoomAccessEventData } from '../services/aiEngine';

interface RoomVisitingRecordProps {
  patientId: string;
  roomId?: string;
  userRole?: string;
  userName?: string;
}

export const RoomVisitingRecord: React.FC<RoomVisitingRecordProps> = ({
  patientId,
  roomId = 'ICU 04',
  userRole = 'Doctor',
  userName = 'Dr. Marcus Vance'
}) => {
  const [events, setEvents] = useState<RoomAccessEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<RoomAccessEventData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadVisitingHistory();
  }, [patientId]);

  const loadVisitingHistory = async () => {
    setLoading(true);
    const data = await fetchRoomAccessEvents(patientId);
    setEvents(data);
    const currentActive = data.find((e) => e.status === 'ACTIVE' || e.exit_time === 'ACTIVE NOW');
    setActiveSession(currentActive || null);
    setLoading(false);
  };

  const handleEnterRoom = async (source: string = 'MANUAL') => {
    if (isProcessing) return;
    setIsProcessing(true);
    const newEvt: RoomAccessEventData = {
      patient_id: patientId,
      room_id: roomId,
      user_id: 'usr-' + userRole.toLowerCase(),
      role: userRole,
      display_name: userName,
      action: 'ENTER',
      source: source
    };
    await logRoomAccessEventBackend(newEvt);
    await loadVisitingHistory();
    setIsProcessing(false);
  };

  const handleExitRoom = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const exitEvt: RoomAccessEventData = {
      patient_id: patientId,
      room_id: roomId,
      user_id: 'usr-' + userRole.toLowerCase(),
      role: userRole,
      display_name: userName,
      action: 'EXIT',
      source: activeSession?.source || 'MANUAL'
    };
    await logRoomAccessEventBackend(exitEvt);
    await loadVisitingHistory();
    setIsProcessing(false);
  };

  return (
    <div className="mt-8 border border-slate-700/80 bg-slate-900/90 rounded-xl p-6 shadow-lg text-slate-100 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#FF897E]" />
            <h3 className="text-lg font-bold tracking-wide uppercase text-slate-100 font-mono">
              ROOM VISITING RECORD
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Authorized room access history (Application-level security audit)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeSession ? (
            <button
              onClick={handleExitRoom}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors shadow focus:outline-none focus:ring-2 focus:ring-rose-400"
            >
              <LogOut className="w-4 h-4" />
              EXIT ROOM
            </button>
          ) : (
            <button
              onClick={() => handleEnterRoom('MANUAL')}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-[#16A34A] hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors shadow focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <LogIn className="w-4 h-4" />
              ENTER ROOM
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE VISITOR INDICATOR */}
      {activeSession && (
        <div className="mb-6 bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="w-3 h-3 bg-emerald-500 rounded-full block animate-ping absolute inset-0"></span>
              <span className="w-3 h-3 bg-emerald-500 rounded-full block relative"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-emerald-400 font-mono tracking-wider">
                  ACTIVE NOW
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-mono">
                  {activeSession.role}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-100 mt-0.5">
                {activeSession.display_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-300 font-mono">
            <div>
              <span className="text-slate-400 block">Entered:</span>
              <span className="font-semibold text-slate-100">{activeSession.entry_time || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Status:</span>
              <span className="text-emerald-400 font-semibold">Currently in room</span>
            </div>
            <div>
              <span className="text-slate-400 block">Access:</span>
              <span className="text-slate-200">{activeSession.source || 'NFC'}</span>
            </div>
          </div>
        </div>
      )}

      {/* VISITING RECORD TABLE */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400 font-mono">
          Loading authorized room access records...
        </div>
      ) : events.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 font-mono border border-dashed border-slate-800 rounded-lg">
          No room visits recorded for this patient session.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Visitor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Entered</th>
                <th className="py-3 px-4">Left</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {events.map((evt, idx) => (
                <tr key={evt.event_id || idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-100 flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    {evt.display_name}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {evt.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">{evt.entry_time}</td>
                  <td className="py-3 px-4 font-mono">
                    {evt.exit_time === 'ACTIVE NOW' ? (
                      <span className="text-emerald-400 font-bold text-[11px] uppercase tracking-wide">ACTIVE NOW</span>
                    ) : (
                      <span className="text-slate-300">{evt.exit_time}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {evt.status === 'ACTIVE' ? (
                      <span className="text-emerald-400">In Progress</span>
                    ) : (
                      <span className="text-slate-300">{evt.duration}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                      <Tag className="w-3 h-3 text-[#FF897E]" />
                      {evt.source || 'NFC'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Application-level visiting audit log. Data stored securely in Firebase roomAccessEvents.</span>
      </div>
    </div>
  );
};
