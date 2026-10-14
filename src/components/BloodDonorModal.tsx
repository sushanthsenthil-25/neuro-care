import React, { useState, useEffect } from 'react';
import {
  X,
  Droplet,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ShieldCheck,
  Plus,
  Users
} from 'lucide-react';
import { bloodStore } from '../services/bloodStore';
import type { Patient, BloodRequest, BloodGroup, BloodComponent, BloodRequestUrgency } from '../types/icu';

interface BloodDonorModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient;
}

export const BloodDonorModal: React.FC<BloodDonorModalProps> = ({ isOpen, onClose, patient }) => {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'create'>('requests');
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);

  // New request state
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>((patient?.bloodGroup as BloodGroup) || 'O-');
  const [component, setComponent] = useState<BloodComponent>('PRBC');
  const [quantity, setQuantity] = useState<number>(2);
  const [urgency, setUrgency] = useState<BloodRequestUrgency>('CRITICAL_STAT');
  const [requiredBy, setRequiredBy] = useState('Within 45 mins');
  const [radius, setRadius] = useState<5 | 10 | 15 | 25>(15);
  const [notes, setNotes] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const reqs = bloodStore.getRequests();
    setRequests(reqs);
    if (reqs.length > 0 && !selectedReqId) {
      setSelectedReqId(reqs[0].id);
    }

    const unsubscribe = bloodStore.subscribe(() => {
      setRequests(bloodStore.getRequests());
    });
    return unsubscribe;
  }, [isOpen, selectedReqId]);

  if (!isOpen) return null;

  const activeRequest = requests.find((r) => r.id === selectedReqId) || requests[0] || null;

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const created = bloodStore.createBloodRequest({
      patientId: patient?.id || '132543',
      patientName: patient?.name || 'ICU Patient',
      room: patient?.room || 'ICU Room 03',
      bloodGroup,
      component,
      quantityUnits: Number(quantity),
      urgency,
      requiredByTime: requiredBy,
      hospitalLocation: `NeuroCare ICU Ward Unit A - ${patient?.room || 'Room 03'}`,
      searchRadiusKm: radius,
      notes: notes.trim() || 'Urgent ICU transfusion requirement.',
    });

    setActionFeedback({
      type: 'success',
      text: `Blood Request ${created.id} registered. Matched ${created.matchedDonors.length} prospective donors within ${radius}km.`,
    });
    setSelectedReqId(created.id);
    setActiveTab('requests');
  };

  const handleApproveAndNotify = (requestId: string) => {
    const success = bloodStore.approveAndNotifyDonors(requestId, 'Dr. Marcus Vance, MD');
    if (success) {
      setActionFeedback({
        type: 'success',
        text: 'Staff Authorization Verified: Simulated dispatch sent to registered donors within radius.',
      });
    }
  };

  const handleRadiusChange = (requestId: string, newRadius: 5 | 10 | 15 | 25) => {
    bloodStore.updateSearchRadius(requestId, newRadius);
    setActionFeedback({
      type: 'success',
      text: `Expanded donor search radius to ${newRadius} km.`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
              <Droplet className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Emergency Blood Donor Finder & Request Dispatch
                </h3>
                <span className="text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                  SYNTHETIC DEMO DONOR POOL
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Progressive geographic radius search • Staff approval gated notification system
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            CLINICAL SAFETY NOTICE: Synthetic demo donor data only. Staff approval required prior to notification dispatch. Final cross-match and compatibility decisions remain strictly with certified hospital blood banks.
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 font-bold transition-all ${
              activeTab === 'requests'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Droplet className="w-3.5 h-3.5" /> Active Blood Requests ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 font-bold transition-all ${
              activeTab === 'create'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Create Emergency Blood Request
          </button>
        </div>

        {actionFeedback && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl text-xs flex items-center justify-between ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            <span>{actionFeedback.text}</span>
            <button onClick={() => setActionFeedback(null)} className="text-xs font-bold underline ml-2">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 1: Request Overview & Donor Match */}
        {activeTab === 'requests' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Request list */}
            <div className="w-full md:w-5/12 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-3 space-y-2">
              {requests.map((req) => {
                const isSelected = activeRequest?.id === req.id;
                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedReqId(req.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all space-y-2 ${
                      isSelected
                        ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800 shadow-xs'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-red-600 dark:text-red-400 text-sm">
                            {req.bloodGroup} {req.component}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            ({req.quantityUnits} Units)
                          </span>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                              req.urgency === 'CRITICAL_STAT'
                                ? 'bg-red-600 text-white animate-pulse'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            {req.urgency === 'CRITICAL_STAT' ? 'STAT' : req.urgency}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Pt: <span className="font-bold">{req.patientName}</span> ({req.room})
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">{req.requiredByTime}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            req.requestStatus === 'Donors Notified'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : req.requestStatus === 'Staff Approved'
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {req.requestStatus}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Search Radius: {req.searchRadiusKm} km</span>
                      <span className="text-slate-700 dark:text-slate-300 font-bold">
                        {req.matchedDonors.length} prospective donors
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Donor Match Detail */}
            {activeRequest ? (
              <div className="w-full md:w-7/12 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Header card */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-base font-black text-red-600 dark:text-red-400">
                        {activeRequest.bloodGroup} {activeRequest.component} ({activeRequest.quantityUnits} Units)
                      </span>
                      <p className="text-slate-600 dark:text-slate-300 text-xs">
                        Requested for {activeRequest.patientName} (#{activeRequest.patientId}) at {activeRequest.hospitalLocation}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Notes: {activeRequest.notes}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Approval State</span>
                      {activeRequest.staffApproved ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved by {activeRequest.approvedBy}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Staff Approval Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progressive Search Radius Selector */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Progressive Donor Search Radius:
                    </span>
                    <div className="flex items-center gap-1">
                      {([5, 10, 15, 25] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => handleRadiusChange(activeRequest.id, r)}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                            activeRequest.searchRadiusKm === r
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {r} km
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Staff Approval Action */}
                {!activeRequest.staffApproved && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-red-900 dark:text-red-200 block">
                        Physician / Staff Approval Gate
                      </span>
                      <span className="text-[11px] text-red-700 dark:text-red-400">
                        Authorise simulated dispatch to {activeRequest.matchedDonors.length} prospective donors.
                      </span>
                    </div>
                    <button
                      onClick={() => handleApproveAndNotify(activeRequest.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve & Dispatch Alerts
                    </button>
                  </div>
                )}

                {/* Matched Donors Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-red-600" /> Matched Synthetic Donors ({activeRequest.matchedDonors.length})
                    </span>
                    <span className="text-[11px] text-slate-400">Within {activeRequest.searchRadiusKm} km</span>
                  </div>

                  {activeRequest.matchedDonors.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                      No matching donors found within {activeRequest.searchRadiusKm} km. Try expanding radius to 25 km.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeRequest.matchedDonors.map((donor) => (
                        <div
                          key={donor.id}
                          className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shadow-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{donor.name}</span>
                              <span className="font-black text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-[10px]">
                                {donor.bloodGroup}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                {donor.consentStatus}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" /> {donor.neighborhood} • {donor.lastDonationDate} ({donor.lifetimeDonations} lifetime donations)
                            </p>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                donor.availabilityStatus === 'Accepted'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                  : donor.availabilityStatus === 'Available'
                                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                  : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {donor.availabilityStatus}
                            </span>
                            {donor.notified && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Dispatched at {donor.notificationTime}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Tab 2: Create Request Form */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateRequest} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-2xl font-mono text-xs">
            <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm">
              Register Emergency Blood / Blood Product Request
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Blood Group Required *</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                >
                  <option value="O-">O- (Universal Red Cell Donor)</option>
                  <option value="O+">O+</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+ (Universal Plasma Donor)</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Blood Component *</label>
                <select
                  value={component}
                  onChange={(e) => setComponent(e.target.value as BloodComponent)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
                  <option value="Platelets">Single Donor / Random Platelets</option>
                  <option value="FFP">Fresh Frozen Plasma (FFP)</option>
                  <option value="Whole Blood">Whole Blood</option>
                  <option value="Cryoprecipitate">Cryoprecipitate</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Required Quantity (Units) *</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Clinical Urgency</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as BloodRequestUrgency)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                >
                  <option value="CRITICAL_STAT">CRITICAL STAT (Immediate Need &lt;45m)</option>
                  <option value="URGENT">URGENT (&lt;2 Hours)</option>
                  <option value="ROUTINE">ROUTINE (Elective / Next Shift)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Required-By Timeframe</label>
                <input
                  type="text"
                  value={requiredBy}
                  onChange={(e) => setRequiredBy(e.target.value)}
                  placeholder="e.g. Within 45 mins, by 15:00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Initial Search Radius</label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value) as 5 | 10 | 15 | 25)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value={5}>Within 5 km</option>
                  <option value={10}>Within 10 km</option>
                  <option value={15}>Within 15 km (Recommended)</option>
                  <option value={25}>Within 25 km</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Clinical Indication / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Active post-surgical bleed, low Hct, emergency transfusion protocol"
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
              >
                Submit Blood Request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
