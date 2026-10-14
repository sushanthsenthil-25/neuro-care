import React, { useState, useEffect } from 'react';
import type { Patient } from '../types/icu';
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Radio,
  ArrowRight,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { equipmentStore } from '../services/equipmentStore';

interface ICUFloorLayoutProps {
  patients: Patient[];
  onSelectPatient: (patientId: string) => void;
  selectedPatientId?: string;
}

export const ICUFloorLayout: React.FC<ICUFloorLayoutProps> = ({
  patients,
  onSelectPatient,
  selectedPatientId,
}) => {
  // 2D View State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeWing, setActiveWing] = useState<'wingA' | 'wingB'>('wingA');
  const [, setEquipmentTick] = useState(0);

  useEffect(() => {
    return equipmentStore.subscribe(() => setEquipmentTick((t) => t + 1));
  }, []);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 1.35));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.75));
  const handleResetView = () => {
    setZoomLevel(1);
    setSearchQuery('');
  };

  const getPatientByRoom = (roomName: string) => {
    return patients.find(
      (p) => p.room.toLowerCase().includes(roomName.toLowerCase()) || roomName.toLowerCase().includes(p.room.toLowerCase())
    );
  };

  // Color Tokens based on NeuroCare Palette
  // PRIMARY: #FF897E | SECONDARY: #0F172A | NORMAL: #16A34A | NEUTRAL: #64748B
  const getRoomStatusStyle = (status?: Patient['status']) => {
    switch (status) {
      case 'CRITICAL':
        return {
          wallBorder: 'border-2 border-[#FF897E] bg-red-50/90 dark:bg-red-950/40',
          badgeBg: 'bg-[#FF897E] text-slate-900 font-extrabold',
          indicatorDot: 'bg-[#FF897E] animate-pulse',
          pulseEffect: 'ring-4 ring-red-400/40 shadow-[0_0_20px_rgba(255,137,126,0.5)] animate-pulse-critical',
          statusText: 'CRITICAL',
          accentText: 'text-[#FF897E]',
        };
      case 'WARNING':
        return {
          wallBorder: 'border-2 border-[#FF897E]/70 bg-red-50/40 dark:bg-red-950/30',
          badgeBg: 'bg-[#FF897E]/90 text-slate-900 font-extrabold',
          indicatorDot: 'bg-[#FF897E]',
          pulseEffect: 'ring-2 ring-red-400/30 shadow-xs',
          statusText: 'WARNING',
          accentText: 'text-[#FF897E]',
        };
      case 'OBSERVATION':
        return {
          wallBorder: 'border-2 border-amber-500 bg-amber-50/50 dark:bg-amber-950/30',
          badgeBg: 'bg-amber-500 text-white font-extrabold',
          indicatorDot: 'bg-amber-500',
          pulseEffect: 'ring-2 ring-amber-400/20 shadow-xs',
          statusText: 'WATCH',
          accentText: 'text-amber-600',
        };
      case 'STABLE':
      default:
        return {
          wallBorder: 'border-2 border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 hover:border-emerald-700',
          badgeBg: 'bg-[#16A34A] text-white font-extrabold',
          indicatorDot: 'bg-[#16A34A]',
          pulseEffect: 'shadow-xs hover:shadow-md',
          statusText: 'NORMAL',
          accentText: 'text-[#16A34A]',
        };
    }
  };

  // Search Match Evaluator
  const isSearchMatch = (roomLabel: string, patient?: Patient) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.trim().toLowerCase();
    if (roomLabel.toLowerCase().includes(q)) return true;
    if (patient) {
      if (patient.id.toLowerCase().includes(q)) return true;
      if (patient.name.toLowerCase().includes(q)) return true;
      if (patient.room.toLowerCase().includes(q)) return true;
    }
    return false;
  };

  // 2D Architectural Room Renderer
  const render2DRoom = (
    roomLabel: string,
    roomNameMatch: string,
    doorPos: 'bottom' | 'top' = 'bottom',
    specialTag?: string
  ) => {
    const patient = getPatientByRoom(roomNameMatch);
    const isSelected = patient && patient.id === selectedPatientId;
    const isMatched = isSearchMatch(roomLabel, patient);
    const style = patient ? getRoomStatusStyle(patient.status) : getRoomStatusStyle();
    const eqStatus = equipmentStore.getRoomEquipmentStatus(roomLabel);

    return (
      <motion.div
        whileHover={{ scale: 1.015, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => patient && onSelectPatient(patient.id)}
        className={`relative p-3.5 rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between h-[210px] bg-white dark:bg-slate-900 ${
          style.wallBorder
        } ${style.pulseEffect} ${
          isSelected
            ? 'ring-4 ring-red-600 border-red-600 shadow-2xl z-30 scale-[1.02]'
            : isMatched
            ? 'ring-4 ring-amber-500 border-amber-500 shadow-xl z-20 scale-[1.02] bg-amber-50/80 dark:bg-amber-950/40'
            : ''
        }`}
      >
        {/* FLUSH DOOR THRESHOLD WITH SWING ARC */}
        <div
          className={`absolute w-12 h-2.5 bg-slate-200 dark:bg-slate-700 border-x-2 border-slate-700 dark:border-slate-500 flex items-center justify-center text-[7px] font-mono font-bold text-slate-800 dark:text-slate-200 z-20 shadow-xs ${
            doorPos === 'bottom' ? '-bottom-1.5 right-8' : '-top-1.5 right-8'
          }`}
        >
          🚪 DOOR
        </div>

        {/* Selected Bed Pin */}
        {isSelected && (
          <div className="absolute -top-3 left-3 bg-red-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-md z-30 flex items-center gap-1 uppercase tracking-widest font-mono">
            <Radio className="w-3 h-3 animate-ping" /> BED FOCUS
          </div>
        )}

        {/* Search Match Highlight Tag */}
        {isMatched && (
          <div className="absolute -top-3 right-3 bg-amber-500 text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-full shadow-md z-30 font-mono uppercase">
            🔍 SEARCH MATCH
          </div>
        )}

        {/* Room Header: Room Number + Equipment Status + Clinical Status */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {roomLabel}
            </span>
            {specialTag && (
              <span className="text-[7px] font-mono font-bold bg-slate-900 dark:bg-slate-700 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                {specialTag}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Bedside Equipment Telemetry Badge */}
            {eqStatus === 'CRITICAL' ? (
              <span className="text-[7.5px] font-mono font-bold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 px-1 py-0.2 rounded flex items-center gap-0.5" title="Bedside telemetry: Critical equipment fault">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" /> EQ FAULT
              </span>
            ) : eqStatus === 'WARNING' ? (
              <span className="text-[7.5px] font-mono font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-1 py-0.2 rounded flex items-center gap-0.5" title="Bedside telemetry: Warning (Battery / Cable)">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> EQ WARN
              </span>
            ) : (
              <span className="text-[7.5px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5" title="Bedside monitors & pumps online">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> EQ OK
              </span>
            )}

            {patient && (
              <span className={`text-[8.5px] font-mono font-extrabold px-2 py-0.5 rounded uppercase shadow-xs ${style.badgeBg}`}>
                {style.statusText}
              </span>
            )}
          </div>
        </div>

        {/* Room Body: Patient Identity & Vitals */}
        {patient ? (
          <div className="my-auto space-y-1.5">
            {/* PROMINENT PATIENT NAME & DEMOGRAPHICS */}
            <div className="flex items-center gap-2">
              {/* Round Avatar Icon */}
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center font-black text-[9px] text-slate-800 dark:text-slate-200 font-mono shadow-xs">
                ID:{patient.id.slice(-3)}
              </div>

              <div className="min-w-0 flex-1 leading-tight">
                {/* Prominent Patient Name */}
                <div className="text-xs font-black text-slate-900 dark:text-white truncate font-sans tracking-tight">
                  {patient.name}
                </div>
                {/* ID & Age / Gender */}
                <div className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                  ID: <span className="text-slate-900 dark:text-slate-100">{patient.id}</span> • {patient.age}Y / {patient.gender[0]}
                </div>
              </div>
            </div>

            {/* Compact Clinical Vitals Grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9.5px] font-mono bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                HR: <span className="font-bold text-slate-900 dark:text-white">{patient.vitals.heartRate.current} bpm</span>
              </div>
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                BP: <span className="font-bold text-slate-900 dark:text-white">{patient.vitals.bpSystolic.current}/{patient.vitals.bpDiastolic.current}</span>
              </div>
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                SpO₂:{' '}
                {patient.hasSpo2 !== false && patient.vitals.spo2.current > 0 ? (
                  <span className="font-bold text-slate-900 dark:text-white">{patient.vitals.spo2.current}%</span>
                ) : (
                  <span className="text-slate-400 italic font-sans font-normal text-[8.5px]">Data unavailable</span>
                )}
              </div>
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                RR:{' '}
                {patient.hasRespRate !== false && patient.vitals.respRate.current > 0 ? (
                  <span className="font-bold text-slate-900 dark:text-white">{patient.vitals.respRate.current}</span>
                ) : (
                  <span className="text-slate-400 italic font-sans font-normal text-[8.5px]">Data unavailable</span>
                )}
              </div>
            </div>

            {/* AI Risk Score & Clinical Attributes */}
            <div className="flex items-center justify-between text-[9px] font-mono pt-0.5">
              <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-slate-200">
                <span>AI RISK:</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-black text-white ${
                    patient.deteriorationRisk >= 75
                      ? 'bg-red-600'
                      : patient.deteriorationRisk >= 40
                      ? 'bg-amber-600'
                      : 'bg-emerald-600'
                  }`}
                >
                  {patient.deteriorationRisk}%
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1 py-0.2 rounded font-bold">GCS {patient.gcs ?? 15}</span>
                {patient.mechVent && (
                  <span className="bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-300 px-1 py-0.2 rounded font-extrabold border border-blue-300 dark:border-blue-800">
                    Vent
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="my-auto text-center py-6 text-slate-400 text-xs font-mono">
            Bed Unoccupied
          </div>
        )}

        {/* Room Footer Action */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-1 text-[8.5px] font-mono text-slate-500 dark:text-slate-400">
          <span>Bed: {patient ? patient.bedNumber : 'Standby'}</span>
          {patient && (
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-0.5 hover:text-red-600 dark:hover:text-red-400">
              Open Details <ArrowRight className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  // Header Summary Stats
  const totalOccupied = patients.length;
  const stableCount = patients.filter((p) => p.status === 'STABLE').length;
  const watchCount = patients.filter((p) => p.status === 'OBSERVATION').length;
  const criticalCount = patients.filter((p) => p.status === 'CRITICAL' || p.status === 'WARNING').length;
  const aiAlertsCount = patients.filter((p) => p.deteriorationRisk >= 40).length;

  return (
    <div className="clinical-card p-5 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
      {/* 1. COMMAND CENTER HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-600 animate-pulse" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white font-sans tracking-tight uppercase">
              2D Architectural Hospital Floor Plan Command Center
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Top-down 2D spatial ward overview displaying physical room boundaries, doors, corridors, and bedside patient identities.
          </p>
        </div>

        {/* Live Synchronized Status Indicator */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
            <span>● LIVE • Synchronized: 2s ago</span>
          </div>

          <span className="text-slate-400 dark:text-slate-600">|</span>

          {/* Wing Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setActiveWing('wingA')}
              className={`px-3 py-1 rounded transition-colors ${
                activeWing === 'wingA' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              Wing A (Rooms 01–10)
            </button>
            <button
              onClick={() => setActiveWing('wingB')}
              className={`px-3 py-1 rounded transition-colors ${
                activeWing === 'wingB' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              Wing B (Rooms 11–20)
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button onClick={handleZoomIn} className="p-1 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-700 rounded" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-[10px] text-slate-600 dark:text-slate-400 font-bold">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button onClick={handleZoomOut} className="p-1 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-700 rounded" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleResetView} className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded border-l border-slate-200 dark:border-slate-700 ml-1" title="Reset View">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. STATS & SEARCH BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono">
        {/* Compact Ward Summary Counts */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">Total Occupancy:</span>
            <span className="font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {totalOccupied} / 10 Occupied
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-700 pl-4">
            <span className="text-emerald-700 dark:text-emerald-400 font-bold uppercase text-[10px]">Stable:</span>
            <span className="font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
              {stableCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-700 pl-4">
            <span className="text-amber-700 dark:text-amber-400 font-bold uppercase text-[10px]">Watch:</span>
            <span className="font-black text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
              {watchCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-700 pl-4">
            <span className="text-red-600 dark:text-red-400 font-bold uppercase text-[10px]">Critical:</span>
            <span className="font-black text-red-600 dark:text-red-300 bg-red-100/70 dark:bg-red-950/60 px-2 py-0.5 rounded border border-red-300 dark:border-red-800">
              {criticalCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-700 pl-4">
            <span className="text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px]">AI Risk Alerts:</span>
            <span className="font-black text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {aiAlertsCount}
            </span>
          </div>
        </div>

        {/* OVERVIEW SEARCH FIELD */}
        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Patient / ID / Room..."
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg text-xs font-mono focus:ring-2 focus:ring-red-500 focus:outline-none shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. TOP-DOWN 2D ARCHITECTURAL FLOOR PLAN CANVAS */}
      <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-xl border-2 border-slate-300 dark:border-slate-800 shadow-inner space-y-4 overflow-x-auto">
        <div
          className="transition-transform duration-300 origin-top min-w-[1150px]"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {activeWing === 'wingA' ? (
            <div className="space-y-4">
              {/* NORTH WING A: ICU ROOMS 01 TO 05 WITH FLUSH BOTTOM DOORS */}
              <div>
                <div className="text-[10px] font-mono font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-2 px-1 flex justify-between">
                  <span>NORTH WING A — ICU ROOMS 01 TO 05</span>
                  <span>FLUSH DOOR THRESHOLDS</span>
                </div>
                <div className="grid grid-cols-5 gap-3 items-stretch">
                  {render2DRoom('ICU ROOM 01', 'ICU Room 01', 'bottom')}
                  {render2DRoom('ICU ROOM 02', 'ICU Room 02', 'bottom')}
                  {render2DRoom('ICU ROOM 03', 'ICU Room 03', 'bottom')}
                  {render2DRoom('ICU ROOM 04', 'ICU Room 04', 'bottom')}
                  {render2DRoom('ICU ROOM 05', 'ICU Room 05', 'bottom')}
                </div>
              </div>

              {/* CENTRAL MAIN CORRIDOR: NURSE STATION & MED PREP */}
              <div className="relative py-4 px-4 bg-slate-50 dark:bg-slate-900 border-y-4 border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-between shadow-xs">
                <div className="w-32 h-11 bg-slate-100 dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 rounded flex items-center justify-center text-[11px] font-black text-slate-900 dark:text-white text-center px-1 shrink-0 shadow-xs">
                  Medical Prep
                </div>

                <div className="flex-1 px-4 flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono text-xs font-black">
                  <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                    →
                  </motion.span>
                  <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}>
                    →
                  </motion.span>

                  {/* Central Nurse Station Hub */}
                  <div className="w-80 h-10 bg-slate-900 text-white border-2 border-red-600 rounded-lg shadow-md flex items-center justify-between px-4 text-xs font-black mx-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-red-500 animate-pulse" />
                      <span>Central Nurse Station Hub A</span>
                    </div>
                    <span className="text-[9px] font-mono bg-red-600 text-white px-2 py-0.5 rounded uppercase font-bold">
                      Telemetry Station
                    </span>
                  </div>

                  <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }}>
                    →
                  </motion.span>
                  <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.9 }}>
                    →
                  </motion.span>
                </div>

                <div className="w-32 h-11 bg-slate-100 dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 rounded flex items-center justify-center text-[11px] font-black text-slate-900 dark:text-white text-center px-1 shrink-0 shadow-xs">
                  STAT ICU Lab
                </div>
              </div>

              {/* SOUTH WING A: ICU ROOMS 06 TO 10 (SPECIALIZED UNITS & OT SUITE) */}
              <div>
                <div className="text-[10px] font-mono font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-2 px-1 flex justify-between">
                  <span>SOUTH WING A — ICU ROOMS 06 TO 10 (SPECIALIZED UNITS & OPERATING THEATRE)</span>
                  <span>FLUSH DOOR THRESHOLDS</span>
                </div>
                <div className="grid grid-cols-5 gap-3 items-stretch">
                  {render2DRoom('ICU ROOM 06', 'ICU Room 06', 'top')}
                  {render2DRoom('ICU ROOM 07', 'ICU Room 07', 'top')}
                  {render2DRoom('ICU ROOM 08', 'Isolation Room', 'top', 'AIRLOCK')}
                  {render2DRoom('ICU ROOM 09', 'Emergency/Trauma Room', 'top', 'TRAUMA')}
                  {render2DRoom('ICU ROOM 10', 'ICU Room 10', 'top', 'OT SUITE')}
                </div>
              </div>
            </div>
          ) : (
            /* WING B - ROOMS 11 TO 20 */
            <div className="space-y-4 min-w-[1150px]">
              <div>
                <div className="text-[10px] font-mono font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-2 px-1">
                  NORTH WING B — ICU ROOMS 11 TO 15
                </div>
                <div className="grid grid-cols-5 gap-3 items-stretch">
                  {['11', '12', '13', '14', '15'].map((num) => (
                    <div key={num} className="p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl h-[210px] flex flex-col justify-between relative shadow-xs">
                      <div className="absolute -bottom-1.5 right-8 w-12 h-2.5 bg-slate-200 dark:bg-slate-700 border-x-2 border-slate-700 dark:border-slate-500 flex items-center justify-center text-[7px] font-mono font-bold text-slate-800 dark:text-slate-200">
                        🚪 DOOR
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">ICU ROOM {num}</span>
                      <span className="text-xs text-slate-400 font-mono text-center">Bed Ready / Standby</span>
                      <span className="text-[9px] text-[#16A34A] dark:text-emerald-400 font-bold">NORMAL</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="py-3 px-4 bg-slate-50 dark:bg-slate-900 border-y-4 border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs">
                <span>Medical Prep B</span>
                <span className="bg-slate-900 text-white px-3 py-1 rounded">Nurse Station Hub B</span>
                <span>ICU Lab B</span>
              </div>

              <div>
                <div className="text-[10px] font-mono font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-2 px-1">
                  SOUTH WING B — ICU ROOMS 16 TO 20
                </div>
                <div className="grid grid-cols-5 gap-3 items-stretch">
                  {['16', '17', '18', '19', '20'].map((num) => (
                    <div key={num} className="p-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl h-[210px] flex flex-col justify-between relative shadow-xs">
                      <div className="absolute -top-1.5 right-8 w-12 h-2.5 bg-slate-200 dark:bg-slate-700 border-x-2 border-slate-700 dark:border-slate-500 flex items-center justify-center text-[7px] font-mono font-bold text-slate-800 dark:text-slate-200">
                        🚪 DOOR
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">ICU ROOM {num}</span>
                      <span className="text-xs text-slate-400 font-mono text-center">Bed Ready / Standby</span>
                      <span className="text-[9px] text-[#16A34A] dark:text-emerald-400 font-bold">NORMAL</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
