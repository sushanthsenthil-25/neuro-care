import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  ShieldCheck,
  LogIn,
  LogOut,
  Tag,
  Loader2,
  X,
  CheckCircle2,
  UserPlus
} from 'lucide-react';
import { fetchRoomAccessEvents, logRoomAccessEventBackend } from '../services/aiEngine';
import type { RoomAccessEventData } from '../services/aiEngine';
import { roomAccessStore } from '../services/roomAccessStore';

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
  userName = 'Dr. Marcus Vance, MD',
}) => {
  const [events, setEvents] = useState<RoomAccessEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<RoomAccessEventData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Manual visit modal state
  const [manualVisitorName, setManualVisitorName] = useState('');
  const [manualRole, setManualRole] = useState<'Doctor' | 'Nurse' | 'Consultant' | 'Family' | 'Allied Health'>('Doctor');
  const [manualEntryTime, setManualEntryTime] = useState('');
  const [manualExitTime, setManualExitTime] = useState('');
  const [manualSource, setManualSource] = useState('Manual');

  useEffect(() => {
    loadVisitingHistory();

    // Subscribe to store updates for instant reactive sync
    const unsubscribe = roomAccessStore.subscribe(() => {
      loadVisitingHistory();
    });

    return () => {
      unsubscribe();
    };
  }, [patientId]);

  const loadVisitingHistory = async () => {
    setLoading(true);
    const data = await fetchRoomAccessEvents(patientId);
    setEvents(data);
    const currentActive = data.find((e) => e.status === 'ACTIVE' || e.exit_time === 'ACTIVE NOW');
    setActiveSession(currentActive || null);
    setLoading(false);
  };

  const handleEnterRoom = async (source: string = 'Manual') => {
    if (isProcessing) return;
    setIsProcessing(true);
    const newEvt: RoomAccessEventData = {
      patient_id: patientId,
      room_id: roomId,
      user_id: 'usr-' + userRole.toLowerCase().replace(/\s+/g, '-'),
      role: userRole,
      display_name: userName,
      action: 'ENTER',
      source: source,
    };
    await logRoomAccessEventBackend(newEvt);
    await loadVisitingHistory();
    setIsProcessing(false);
    setFeedback({
      type: 'success',
      message: `${userName} entered ${roomId}. Active session initialized.`,
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleExitRoom = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const exitEvt: RoomAccessEventData = {
      patient_id: patientId,
      room_id: roomId,
      user_id: 'usr-' + userRole.toLowerCase().replace(/\s+/g, '-'),
      role: userRole,
      display_name: userName,
      action: 'EXIT',
      source: activeSession?.source || 'Manual',
    };
    await logRoomAccessEventBackend(exitEvt);
    await loadVisitingHistory();
    setIsProcessing(false);
    setFeedback({
      type: 'info',
      message: `Room visit completed and audit duration logged for ${roomId}.`,
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateManualRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualVisitorName.trim() || !manualEntryTime || !manualExitTime) return;

    roomAccessStore.addManualVisitRecord({
      patientId,
      roomId,
      userRole: manualRole,
      userName: manualVisitorName.trim(),
      entryTime: manualEntryTime,
      exitTime: manualExitTime,
      source: manualSource,
    });

    setIsAddModalOpen(false);
    setManualVisitorName('');
    setManualEntryTime('');
    setManualExitTime('');
    setFeedback({
      type: 'success',
      message: `Manual visiting record added for ${manualVisitorName}.`,
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="mt-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 shadow-xs text-slate-900 dark:text-slate-100 font-sans transition-colors">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-red-600 dark:text-[#FF897E]" />
            <h3 className="text-lg font-bold tracking-wide uppercase text-slate-900 dark:text-slate-100 font-mono">
              ROOM VISITING RECORD
            </h3>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700">
              {roomId}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Authorized room access history & clinical presence tracking (Patient #{patientId})
          </p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              const now = new Date();
              const nowStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const earlier = new Date(now.getTime() - 20 * 60000);
              const earlierStr = earlier.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              setManualEntryTime(earlierStr);
              setManualExitTime(nowStr);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-300 dark:border-slate-700 focus:outline-none"
            title="Log past or external specialist visit"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>Add Visit Log</span>
          </button>

          {activeSession ? (
            <button
              onClick={handleExitRoom}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-lg transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-50 cursor-pointer"
              aria-label="Exit patient room and close active visiting session"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>EXIT ROOM</span>
            </button>
          ) : (
            <button
              onClick={() => handleEnterRoom('Manual')}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 cursor-pointer"
              aria-label="Enter patient room and start active visiting session"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>ENTER ROOM</span>
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK TOAST BANNER */}
      {feedback && (
        <div
          className={`mb-4 p-3 rounded-lg text-xs font-mono flex items-center gap-2 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ACTIVE VISITOR INDICATOR */}
      {activeSession && (
        <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/40 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="w-3 h-3 bg-emerald-500 rounded-full block animate-ping absolute inset-0"></span>
              <span className="w-3 h-3 bg-emerald-500 rounded-full block relative"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 font-mono tracking-wider">
                  ACTIVE NOW
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-mono font-semibold">
                  {activeSession.role}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {activeSession.display_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600 dark:text-slate-300 font-mono">
            <div>
              <span className="text-slate-400 dark:text-slate-500 block">Entered:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activeSession.entry_time || 'Just now'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 block">Status:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Currently in room</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 block">Access:</span>
              <span className="text-slate-700 dark:text-slate-300">{activeSession.source || 'Manual'}</span>
            </div>
          </div>
        </div>
      )}

      {/* VISITING RECORD TABLE */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
          <span>Loading authorized room access records...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 font-mono border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
          <UserCheck className="w-8 h-8 text-slate-400 mx-auto" />
          <p>No room visits recorded yet for this patient session.</p>
          <button
            onClick={() => handleEnterRoom('Manual')}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Record First Entry</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 font-mono uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Visitor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Entered</th>
                <th className="py-3 px-4">Left</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {events.map((evt, idx) => (
                <tr
                  key={evt.event_id || idx}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{evt.display_name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {evt.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{evt.entry_time}</td>
                  <td className="py-3 px-4 font-mono">
                    {evt.exit_time === 'ACTIVE NOW' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] uppercase tracking-wide inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        ACTIVE NOW
                      </span>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300">{evt.exit_time}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {evt.status === 'ACTIVE' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">In Progress</span>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300">{evt.duration}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[11px]">
                      <Tag className="w-3 h-3 text-red-500 dark:text-[#FF897E]" />
                      {evt.source || 'Manual'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FOOTER AUDIT NOTE */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Application-level visiting audit log • Stored securely in persistent roomAccessStore / Firebase</span>
        </div>
        <span className="text-[10px] text-slate-400">
          Showing {events.length} visit record{events.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* MANUAL VISIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-red-600" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Log Visiting Record
                </h4>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualRecord} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Visitor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Rao, MD"
                  value={manualVisitorName}
                  onChange={(e) => setManualVisitorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Role
                </label>
                <select
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="Doctor">Doctor (Attending / Specialist)</option>
                  <option value="Nurse">Nurse (ICU / Primary Care)</option>
                  <option value="Consultant">Consultant Specialist</option>
                  <option value="Allied Health">Allied Health / Physical Therapy</option>
                  <option value="Family">Authorized Family Member</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Entry Time (HH:MM) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="14:15"
                    value={manualEntryTime}
                    onChange={(e) => setManualEntryTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Exit Time (HH:MM) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="14:35"
                    value={manualExitTime}
                    onChange={(e) => setManualExitTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Access Method
                </label>
                <select
                  value={manualSource}
                  onChange={(e) => setManualSource(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="Manual">Manual Security Log</option>
                  <option value="NFC">NFC Clinician Badge</option>
                  <option value="Consultation">Clinical Consultation Order</option>
                  <option value="Visitor Badge">Visitor Badge Pass</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
