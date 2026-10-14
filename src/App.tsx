import React, { useState, useEffect } from 'react';
import type { Patient, Alert, MedicalReport, Medication, IntakeOutputRecord, ClinicalNote, TimelineEvent, ShiftSummary } from './types/icu';
import {
  INITIAL_PATIENTS,
  INITIAL_ALERTS,
  INITIAL_REPORTS,
  INITIAL_MEDICATIONS,
  INITIAL_INTAKE_OUTPUT,
  INITIAL_CLINICAL_NOTES,
  INITIAL_TIMELINE_EVENTS,
  INITIAL_SHIFT_SUMMARIES,
} from './data/mockData';
import { ICUFloorLayout } from './components/ICUFloorLayout';
import { PatientProfileView } from './components/PatientProfileView';
import { DoctorDashboardView } from './components/DoctorDashboardView';
import { NFCAccessModal } from './components/NFCAccessModal';
import { DataImportModal } from './components/DataImportModal';
import { RobotAIRobotAssistant } from './components/RobotAIRobotAssistant';
import { MedicineInventoryModal } from './components/MedicineInventoryModal';
import { PharmacyOrdersModal } from './components/PharmacyOrdersModal';
import { PatientQueueDrawer } from './components/PatientQueueDrawer';
import { BloodDonorModal } from './components/BloodDonorModal';
import { NotificationCenterDropdown } from './components/NotificationCenterDropdown';
import { useTheme } from './services/themeContext';
import { notificationStore } from './services/notificationStore';
import {
  Radio,
  Search,
  RefreshCw,
  Stethoscope,
  Box,
  UserCheck,
  Bell,
  Sun,
  Moon,
  Pill,
  Users,
  Droplet
} from 'lucide-react';

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Main State
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [reports] = useState<MedicalReport[]>(INITIAL_REPORTS);
  const [medications] = useState<Medication[]>(INITIAL_MEDICATIONS);
  const [intakeOutput] = useState<IntakeOutputRecord[]>(INITIAL_INTAKE_OUTPUT);
  const [notes, setNotes] = useState<ClinicalNote[]>(INITIAL_CLINICAL_NOTES);
  const [timelineEvents] = useState<TimelineEvent[]>(INITIAL_TIMELINE_EVENTS);
  const [shiftSummaries] = useState<Record<string, ShiftSummary>>(INITIAL_SHIFT_SUMMARIES);

  // Active Section State: exactly 3 sections: 'icu-overview' | 'patient-details' | 'doctor-dashboard'
  const [activeSection, setActiveSection] = useState<'icu-overview' | 'patient-details' | 'doctor-dashboard'>('icu-overview');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('132543');

  // Global Search State
  const [globalSearch, setGlobalSearch] = useState('');

  // User Role State
  const currentUserRole = 'Doctor';
  const currentUserName = 'Dr. Marcus Vance, MD';

  // Modals & Drawers
  const [isNFCModalOpen, setIsNFCModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isBloodModalOpen, setIsBloodModalOpen] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);

  // Notification count
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(() =>
    notificationStore.getUnreadCount()
  );

  useEffect(() => {
    return notificationStore.subscribe(() => {
      setUnreadNotificationsCount(notificationStore.getUnreadCount());
    });
  }, []);

  // Live Telemetry Simulation Engine
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [simStep, setSimStep] = useState(0);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Hash/URL Dynamic Routing Sync
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/patient/')) {
        const pId = hash.replace('#/patient/', '');
        const exists = patients.find((p) => p.id === pId);
        if (exists) {
          setSelectedPatientId(pId);
          setActiveSection('patient-details');
        }
      } else if (hash === '#/doctor-dashboard') {
        setActiveSection('doctor-dashboard');
      } else if (hash === '#/' || hash === '#/overview') {
        setActiveSection('icu-overview');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [patients]);

  const navigateToPatient = (pId: string) => {
    setSelectedPatientId(pId);
    setActiveSection('patient-details');
    window.location.hash = `#/patient/${pId}`;
  };

  const navigateToSection = (sec: 'icu-overview' | 'patient-details' | 'doctor-dashboard') => {
    setActiveSection(sec);
    if (sec === 'icu-overview') {
      window.location.hash = '#/';
    } else if (sec === 'doctor-dashboard') {
      window.location.hash = '#/doctor-dashboard';
    } else if (sec === 'patient-details') {
      window.location.hash = `#/patient/${selectedPatientId}`;
    }
  };

  // Live Simulation Engine (Requirement 31: Deterioration trajectory & sensor artifact demo)
  useEffect(() => {
    if (!isSimulationActive) return;

    const simInterval = setInterval(() => {
      setSimStep((prev) => prev + 1);

      setPatients((prevPatients) =>
        prevPatients.map((p) => {
          if (p.id === '132543') {
            const hrSeq = [88, 91, 95, 99, 104];
            const rrSeq = [18, 20, 23, 27, 30];
            const riskSeq = [34, 42, 51, 64, 78];

            const idx = simStep % hrSeq.length;

            return {
              ...p,
              deteriorationRisk: riskSeq[idx],
              vitals: {
                ...p.vitals,
                heartRate: { ...p.vitals.heartRate, current: hrSeq[idx], trend: 'up' },
                respRate: { ...p.vitals.respRate, current: rrSeq[idx], trend: 'up' },
              },
            };
          } else if (p.id === '132539') {
            // Artifact simulation sequence: 92 -> 93 -> 250 -> 94
            const artifactSeq = [92, 93, 250, 94];
            const idx = simStep % artifactSeq.length;
            return {
              ...p,
              vitals: {
                ...p.vitals,
                heartRate: { ...p.vitals.heartRate, current: artifactSeq[idx] },
              },
            };
          }
          return p;
        })
      );
    }, 4000);

    return () => clearInterval(simInterval);
  }, [isSimulationActive, simStep]);

  // Global Search Handler
  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    const term = globalSearch.trim().toLowerCase();
    const found = patients.find(
      (p) => p.id.toLowerCase() === term || p.name.toLowerCase().includes(term) || p.room.toLowerCase().includes(term)
    );

    if (found) {
      navigateToPatient(found.id);
      setGlobalSearch('');
    }
  };

  // Nurse Acknowledge Alert Handler
  const handleAcknowledgeAlert = (alertId: string, nurseNote: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? {
              ...a,
              nurseAcknowledged: true,
              acknowledgedBy: currentUserName,
              acknowledgementTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              nurseNote: nurseNote || 'Bedside observation recorded by RN.',
            }
          : a
      )
    );
  };

  // Doctor Review Alert Handler
  const handleDoctorReviewAlert = (alertId: string, doctorAction: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? {
              ...a,
              doctorReviewed: true,
              doctorAction: doctorAction || 'Physician bedside assessment completed.',
              resolved: true,
            }
          : a
      )
    );
  };

  // Add Clinical Note Handler
  const handleAddNote = (noteText: string, category: 'Progress' | 'Order' | 'Observation' | 'Handover') => {
    if (!selectedPatientId) return;
    const newNote: ClinicalNote = {
      id: `CN-${Date.now()}`,
      patientId: selectedPatientId,
      author: currentUserName,
      role: currentUserRole,
      timestamp: new Date().toLocaleString(),
      note: noteText,
      category,
    };
    setNotes((prev) => [newNote, ...prev]);
  };

  // Stats
  const totalBeds = 20;
  const totalPatients = patients.length;
  const criticalCount = patients.filter((p) => p.status === 'CRITICAL').length;
  const warningCount = patients.filter((p) => p.status === 'WARNING').length;
  const observationCount = patients.filter((p) => p.status === 'OBSERVATION').length;
  const stableCount = patients.filter((p) => p.status === 'STABLE').length;

  const currentPatientObj = patients.find((p) => p.id === selectedPatientId) || patients[2];

  return (
    <div className="min-h-screen bg-slate-100/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* GLOBAL HEADER & PRIMARY 3-MODULE NAVIGATION BAR */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs">
        <div className="max-w-[1650px] mx-auto px-5 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigateToSection('icu-overview')}>
            <img
              src="/neurocare-logo.png"
              alt="NeuroCare AI Logo"
              className="h-10 w-auto object-contain hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight">
                  <span className="text-red-600">Neuro</span>
                  <span className="text-slate-900 dark:text-white">Care</span>
                </span>
                <span className="text-[10px] font-mono bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 px-2 py-0.5 rounded border border-red-200 dark:border-red-800 font-bold uppercase tracking-wider">
                  POWERED BY GEN STRIKERS
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase">
                AI-POWERED ICU PATIENT INTELLIGENCE
              </p>
            </div>
          </div>

          {/* PRIMARY NAVIGATION (CONSOLIDATED INTO EXACTLY 3 PRIMARY AREAS) */}
          <nav className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black font-mono shadow-inner">
            <button
              onClick={() => navigateToSection('icu-overview')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeSection === 'icu-overview'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Box className="w-4 h-4" /> 01 — ICU OVERVIEW
            </button>

            <button
              onClick={() => navigateToSection('patient-details')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeSection === 'patient-details'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" /> 02 — PATIENT DETAILS
            </button>

            <button
              onClick={() => navigateToSection('doctor-dashboard')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeSection === 'doctor-dashboard'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Stethoscope className="w-4 h-4" /> 03 — DOCTOR DASHBOARD
            </button>
          </nav>

          {/* Global Search Bar */}
          <div className="flex-1 max-w-sm relative hidden md:block">
            <form onSubmit={handleGlobalSearch}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Global Search (132543, Room 03...)"
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono focus:ring-2 focus:ring-red-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition-all text-slate-900 dark:text-slate-100"
                />
              </div>
            </form>
          </div>

          {/* Global Action Controls */}
          <div className="flex items-center gap-2.5 text-xs">
            {/* Quick Operational Tools */}
            <div className="hidden xl:flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-700 pr-2.5">
              <button
                onClick={() => setIsInventoryModalOpen(true)}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-colors"
                title="Medicine Inventory & Formulary"
              >
                <Pill className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Pharmacy</span>
              </button>
              <button
                onClick={() => setIsQueueOpen(true)}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-colors"
                title="Triage & Patient Waiting Queue"
              >
                <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Triage Queue</span>
              </button>
              <button
                onClick={() => setIsBloodModalOpen(true)}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-colors"
                title="Blood Donor Finder & Request Dispatch"
              >
                <Droplet className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span>Blood Bank</span>
              </button>
            </div>

            {/* Notification Center Dropdown Toggle */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationDropdownOpen((prev) => !prev)}
                className="relative p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                title="In-App Notification Center"
              >
                <Bell className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
              <NotificationCenterDropdown
                isOpen={isNotificationDropdownOpen}
                onClose={() => setIsNotificationDropdownOpen(false)}
                onNavigateToPatient={(pId) => {
                  setIsNotificationDropdownOpen(false);
                  navigateToPatient(pId);
                }}
                onNavigateToPharmacy={() => {
                  setIsNotificationDropdownOpen(false);
                  setIsOrdersModalOpen(true);
                }}
                onNavigateToQueue={() => {
                  setIsNotificationDropdownOpen(false);
                  setIsQueueOpen(true);
                }}
                onNavigateToBlood={() => {
                  setIsNotificationDropdownOpen(false);
                  setIsBloodModalOpen(true);
                }}
              />
            </div>

            {/* Theme Toggle (Light / Dark) */}
            <button
              id="theme-toggle-btn"
              data-testid="theme-toggle-btn"
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Simulation Engine Toggle */}
            <button
              onClick={() => setIsSimulationActive(!isSimulationActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                isSimulationActive
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulationActive ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSimulationActive ? 'Sim Active' : 'Start Sim'}</span>
            </button>

            {/* NFC Global Access */}
            <button
              onClick={() => setIsNFCModalOpen(true)}
              className="px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs font-mono"
            >
              <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" /> NFC
            </button>

            {/* User Profile */}
            <div className="pl-2 border-l border-slate-200 dark:border-slate-700 text-right hidden lg:block font-mono">
              <div className="font-bold text-slate-900 dark:text-white text-xs">{currentUserName}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{currentTime} • Ward Unit A</div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN APPLICATION CONTENT */}
      <main className="max-w-[1650px] mx-auto w-full px-5 py-5 flex-1 space-y-6">
        {/* 1. PRIMARY AREA 1: ICU OVERVIEW */}
        {activeSection === 'icu-overview' && (
          <div className="space-y-5">
            {/* CAPACITY STATS BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
              <div className="clinical-card p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">ICU Capacity</span>
                <div className="my-1">
                  <span className="text-xl font-black text-slate-900 dark:text-white">{totalPatients}</span>
                  <span className="text-xs text-slate-400"> / {totalBeds} Beds</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-slate-900 dark:bg-slate-100 h-full rounded-full" style={{ width: `${(totalPatients / totalBeds) * 100}%` }} />
                </div>
              </div>

              <div className="clinical-card p-3.5 bg-white dark:bg-slate-900 border-l-4 border-l-red-600 rounded-xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-red-600 uppercase">Critical</span>
                <div className="my-1 flex items-baseline justify-between">
                  <span className="text-xl font-black text-red-600">{criticalCount}</span>
                  <span className="text-[9px] bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-bold">132543</span>
                </div>
                <span className="text-[10px] text-slate-400">Immediate Rounding</span>
              </div>

              <div className="clinical-card p-3.5 bg-white dark:bg-slate-900 border-l-4 border-l-red-500 rounded-xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-red-500 uppercase">Warning</span>
                <div className="my-1">
                  <span className="text-xl font-black text-red-500">{warningCount}</span>
                </div>
                <span className="text-[10px] text-slate-400">High Trajectory Risk</span>
              </div>

              <div className="clinical-card p-3.5 bg-white dark:bg-slate-900 border-l-4 border-l-amber-500 rounded-xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Observation</span>
                <div className="my-1">
                  <span className="text-xl font-black text-amber-600">{observationCount}</span>
                </div>
                <span className="text-[10px] text-slate-400">Close Monitoring</span>
              </div>

              <div className="clinical-card p-3.5 bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500 rounded-xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Stable</span>
                <div className="my-1">
                  <span className="text-xl font-black text-emerald-600">{stableCount}</span>
                </div>
                <span className="text-[10px] text-slate-400">Normal Range</span>
              </div>

              <div className="clinical-card p-3.5 bg-slate-900 text-white rounded-xl shadow-xs flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">AI Deterioration</span>
                <div className="my-1 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <Radio className="w-3.5 h-3.5 animate-pulse" /> Engine Active
                </div>
                <span className="text-[10px] text-slate-400">Trajectory Model</span>
              </div>
            </div>

            {/* THE ONLY 3D ISOMETRIC HOSPITAL OVERVIEW CANVAS */}
            <ICUFloorLayout
              patients={patients}
              onSelectPatient={navigateToPatient}
              selectedPatientId={selectedPatientId}
            />
          </div>
        )}

        {/* 2. PRIMARY AREA 2: PATIENT DETAILS */}
        {activeSection === 'patient-details' && (
          <PatientProfileView
            patient={currentPatientObj}
            alerts={alerts}
            reports={reports}
            medications={medications}
            intakeOutput={intakeOutput}
            notes={notes}
            timelineEvents={timelineEvents}
            shiftSummary={shiftSummaries[currentPatientObj.id]}
            onBackToOverview={() => navigateToSection('icu-overview')}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onDoctorReviewAlert={handleDoctorReviewAlert}
            onAddNote={handleAddNote}
            currentUserRole={currentUserRole}
            currentUserName={currentUserName}
          />
        )}

        {/* 3. PRIMARY AREA 3: DOCTOR DASHBOARD */}
        {activeSection === 'doctor-dashboard' && (
          <DoctorDashboardView
            patients={patients}
            alerts={alerts}
            shiftSummaries={shiftSummaries}
            onSelectPatient={navigateToPatient}
            onOpenInventory={() => setIsInventoryModalOpen(true)}
            onOpenOrders={() => setIsOrdersModalOpen(true)}
            onOpenQueue={() => setIsQueueOpen(true)}
            onOpenBlood={() => setIsBloodModalOpen(true)}
          />
        )}
      </main>

      {/* NFC PATIENT ACCESS MODAL */}
      <NFCAccessModal
        isOpen={isNFCModalOpen}
        onClose={() => setIsNFCModalOpen(false)}
        patients={patients}
        onSelectPatient={navigateToPatient}
      />

      {/* DATA IMPORT MODAL */}
      <DataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportPatients={(importedList) => setPatients(importedList)}
      />

      {/* MEDICINE INVENTORY MODAL */}
      <MedicineInventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
      />

      {/* PHARMACY ORDERS & DISPENSING MODAL */}
      <PharmacyOrdersModal
        isOpen={isOrdersModalOpen}
        onClose={() => setIsOrdersModalOpen(false)}
      />

      {/* PATIENT QUEUE & TRIAGE DRAWER */}
      <PatientQueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onSelectPatient={(pId) => {
          setIsQueueOpen(false);
          navigateToPatient(pId);
        }}
      />

      {/* BLOOD DONOR FINDER & REQUEST MODAL */}
      <BloodDonorModal
        isOpen={isBloodModalOpen}
        onClose={() => setIsBloodModalOpen(false)}
      />

      {/* FEATURE 2: ROBOT-SHAPED AI WEB ASSISTANT */}
      <RobotAIRobotAssistant
        patientId={selectedPatientId}
        patientName={patients.find((p) => p.id === selectedPatientId)?.name}
      />
    </div>
  );
}
