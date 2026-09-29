export type PatientStatus = 'STABLE' | 'OBSERVATION' | 'WARNING' | 'CRITICAL';
export type AlertSeverity = 'NORMAL' | 'SENSOR_ANOMALY' | 'CLINICAL_RISK';

export interface VitalReading {
  current: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  timestamp: string;
  expectedRange: [number, number];
  warningRange: [number, number];
  criticalRange: [number, number];
}

export interface PatientVitals {
  heartRate: VitalReading;
  spo2: VitalReading;
  bpSystolic: VitalReading;
  bpDiastolic: VitalReading;
  respRate: VitalReading;
  temperature: VitalReading;
  urineOutput: VitalReading;
  fluidIntake: VitalReading;
}

export interface TelemetryQuality {
  score: number; // 0 - 100%
  missingReadings: number;
  sensorAnomalies: number;
  status: 'Good' | 'Degraded' | 'Poor';
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

// Complete PhysioNet Dataset 2 (42 Clinical Parameters) Structure
export interface DatasetLabs {
  glucose?: number;
  na?: number;
  k?: number;
  mg?: number;
  hco3?: number;
  bun?: number;
  creatinine?: number;
  hct?: number;
  wbc?: number;
  platelets?: number;
  albumin?: number;
  lactate?: number;
  ph?: number;
  pao2?: number;
  paco2?: number;
  fio2?: number;
  alt?: number;
  ast?: number;
  alp?: number;
  bilirubin?: number;
  cholesterol?: number;
  troponinI?: number;
  troponinT?: number;
  sysABP?: number;
  diasABP?: number;
  map?: number;
  niSysABP?: number;
  niDiasABP?: number;
  niMap?: number;
}

// Dataset Outcome (train/Outcomes-train.txt)
export interface PatientOutcome {
  sapsI: number;
  sofa: number;
  lengthOfStay: number; // days
  survivalDays: number;
  inHospitalDeath: 0 | 1; // 0: Survived, 1: Deceased
}

export interface Patient {
  id: string; // RecordID e.g. 132539
  name: string; // Patient 132539
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  height?: number; // cm (Dataset 2 parameter)
  weight?: number; // kg (Dataset 2 parameter)
  bloodGroup: string;
  admissionDate: string;
  room: string; // e.g. ICU Room 01
  bedNumber: string;
  diagnosis: string;
  condition: string;
  medicalHistory: string[];
  existingDiseases: string[];
  allergies: string[];
  surgeries: string[];
  currentProblems: string[];
  emergencyContact: EmergencyContact;
  assignedDoctor: string;
  assignedNurse: string;
  status: PatientStatus;
  deteriorationRisk: number; // 0-100%
  telemetryQuality: TelemetryQuality;
  vitals: PatientVitals;
  nfcTagId: string;
  isDischarged: boolean;
  dischargeDate?: string;
  
  // Supplied Dataset 2 Specific Parameters (42 Parameters)
  gcs?: number; // Glasgow Coma Scale (3-15)
  icuType?: number; // ICU Type (1: CCU, 2: CSRU, 3: MICU, 4: SICU)
  mechVent?: boolean; // Mechanical Ventilation (0/1)
  hasSpo2?: boolean;
  hasRespRate?: boolean;
  
  labs?: DatasetLabs;
  outcome?: PatientOutcome;
}

export interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  room: string;
  timestamp: string;
  severity: AlertSeverity;
  title: string;
  explanation: string[];
  riskScore: number;
  recommendedAction: string;
  nurseAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgementTime?: string;
  nurseNote?: string;
  doctorReviewed: boolean;
  doctorAction?: string;
  resolved: boolean;
}

export interface MedicalReport {
  id: string;
  patientId: string;
  type: 'Blood Test' | 'X-Ray' | 'CT Scan' | 'MRI' | 'ECG Lab' | 'Abdominal Ultrasound';
  date: string;
  uploadedBy: string;
  importantFindings: string;
  previewUrl?: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
}

export interface Medication {
  id: string;
  patientId: string;
  medicine: string;
  dose: string;
  route: string;
  scheduledTime: string;
  administeredTime?: string;
  administeredBy?: string;
  status: 'Scheduled' | 'Administered' | 'Missed' | 'Delayed';
}

export interface IntakeOutputRecord {
  id: string;
  patientId: string;
  timestamp: string;
  waterIntake: number; // ml
  ivFluids: number; // ml
  urineOutput: number; // ml
  otherOutput: number; // ml
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  author: string;
  role: 'Doctor' | 'Nurse';
  timestamp: string;
  note: string;
  category: 'Progress' | 'Order' | 'Observation' | 'Handover';
}

export interface TimelineEvent {
  id: string;
  patientId: string;
  timestamp: string;
  type: 'vital_change' | 'medication' | 'lab_report' | 'scan' | 'alert' | 'nurse_note' | 'doctor_note' | 'procedure';
  title: string;
  description: string;
  actor?: string;
}

export interface ShiftSummary {
  patientId: string;
  shiftTime: string;
  vitalTrends: { hr: string; spo2: string; bp: string; temp: string };
  alertsCount: number;
  sensorAnomaliesCount: number;
  keyEvents?: string[];
  handoverNotes?: string;
  overallTrajectory?: string;
  recommendation?: string;
  nurseAcknowledgementsCount?: number;
  medicationsSummary?: string;
}

export interface SimilarCasePattern {
  id: string;
  title: string;
  similarityPercentage: number;
  vitalTrendDescription: string;
  historicalOutcome: string;
  diagnosisContext?: string;
}

export interface HistoricalTeamMember {
  name?: string;
  role: string;
  shiftDate?: string;
  doctorName?: string;
  action?: string;
  timestamp?: string;
}
