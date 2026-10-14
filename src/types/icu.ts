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

// ----------------------------------------------------
// 1. MEDICINE INVENTORY & PHARMACY MANAGEMENT TYPES
// ----------------------------------------------------
export interface MedicineBatch {
  batchNumber: string;
  quantity: number;
  initialQuantity: number;
  expiryDate: string; // YYYY-MM-DD
  receivedDate: string;
  isExpired?: boolean;
  isExpiringSoon?: boolean; // Within 30 days
}

export interface StockMovement {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  type: 'RESTOCK' | 'DISPENSED' | 'ADJUSTMENT' | 'RETURNED' | 'DISCARDED';
  quantity: number; // positive or negative
  timestamp: string;
  performedBy: string;
  patientId?: string;
  orderId?: string;
  notes?: string;
}

export interface MedicineItem {
  id: string;
  name: string;
  genericName: string;
  strength: string; // e.g. "500 mg", "1 g", "40 mg"
  dosageForm: 'Tablet' | 'Capsule' | 'IV Infusion' | 'IV Injection' | 'Oral Solution' | 'Sachet' | 'Vial' | 'Ampoule';
  category: 'Antibiotic' | 'Analgesic' | 'Antihistamine' | 'Electrolyte/Fluid' | 'Cardiovascular' | 'Gastrointestinal' | 'Diuretic' | 'Respiratory';
  minimumStockThreshold: number;
  unitPrice: number; // in INR (₹)
  supplier: {
    name: string;
    contact: string;
    leadTimeDays: number;
  };
  batches: MedicineBatch[];
  totalAvailableQuantity: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON';
  isSyntheticDemo: boolean;
  notes?: string;
}

// ----------------------------------------------------
// 2. PRESCRIPTION & PHARMACY ORDER TRACKING TYPES
// ----------------------------------------------------
export type DeliveryStatus =
  | 'Pending'
  | 'Pharmacy Review'
  | 'Preparing'
  | 'Ready'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Delayed'
  | 'Cancelled';

export interface DeliveryTimelineStep {
  step: DeliveryStatus;
  label: string;
  timestamp?: string;
  completed: boolean;
  actor?: string;
  note?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  room: string;
  bedNumber: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  strength: string;
  dose: string;
  route: 'IV' | 'Oral' | 'SC' | 'IM' | 'Inhalation' | 'Topical';
  frequency: 'STAT' | 'Q4H' | 'Q6H' | 'Q8H' | 'Q12H' | 'OD' | 'BD' | 'TDS' | 'PRN';
  scheduledTime: string;
  quantity: number;
  prescribedBy: string;
  prescribedAt: string;
  urgency: 'STAT' | 'Urgent' | 'Routine';
  instructions?: string;
  status: 'Active' | 'Dispensed' | 'Discontinued' | 'Completed';
  associatedOrderId?: string;
}

export interface PharmacyOrder {
  id: string; // e.g. "RX-ORD-101"
  prescriptionId: string;
  patientId: string;
  patientName: string;
  room: string;
  bedNumber: string;
  medicineId: string;
  medicineName: string;
  strength: string;
  quantity: number;
  priority: 'STAT' | 'Urgent' | 'Routine';
  orderedAt: string;
  status: DeliveryStatus;
  allocatedBatchNumber?: string;
  reviewedBy?: string;
  preparedBy?: string;
  dispatchedBy?: string;
  deliveredBy?: string;
  lastUpdated: string;
  estimatedDeliveryTime?: string;
  timeline: DeliveryTimelineStep[];
  unitPrice: number;
  totalCost: number;
  billedToPatient: boolean;
  exceptionReason?: string;
}

export interface PatientBillingItem {
  id: string;
  patientId: string;
  description: string;
  category: 'Pharmacy' | 'Bed' | 'Laboratory' | 'Nursing' | 'Equipment';
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  timestamp: string;
  orderId?: string;
  isCorrected?: boolean;
  correctedBy?: string;
  correctionReason?: string;
}

// ----------------------------------------------------
// 3. PATIENT QUEUE & TRIAGE TYPES
// ----------------------------------------------------
export type TriagePriority = 'EMERGENCY' | 'URGENT' | 'ROUTINE';
export type QueueStatus = 'Waiting' | 'Triage' | 'In-Consult' | 'Admitted' | 'Completed';

export interface PatientQueueEntry {
  id: string; // Visit ID or Token
  patientId?: string;
  patientName: string;
  age: number;
  gender: string;
  arrivalTime: string; // ISO string
  arrivalTimestampMs: number;
  department: 'ICU Triage' | 'Emergency' | 'Neuro-Trauma' | 'Step-down' | 'General';
  triagePriority: TriagePriority;
  priorityScore: number; // 1 (Emergency) -> 2 (Urgent) -> 3 (Routine)
  chiefComplaint: string;
  assignedClinician: string;
  status: QueueStatus;
  elapsedWaitingMinutes: number;
  estimatedWaitMinutes?: number;
  reassessmentRequired: boolean;
  lastReassessmentTime?: string;
}

// ----------------------------------------------------
// 4. BLOOD DONOR FINDER TYPES
// ----------------------------------------------------
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type BloodComponent = 'PRBC' | 'Platelets' | 'FFP' | 'Whole Blood' | 'Cryoprecipitate';
export type BloodRequestUrgency = 'CRITICAL_STAT' | 'URGENT' | 'ROUTINE';

export interface BloodDonorRecord {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  distanceKm: number;
  neighborhood: string;
  consentStatus: 'Active Registered Donor' | 'On-Call ICU Donor' | 'Rare Group Volunteer';
  availabilityStatus: 'Available' | 'Pending Response' | 'Accepted' | 'Declined' | 'Unavailable';
  lastDonationDate: string;
  lifetimeDonations: number;
  isSyntheticDemo: boolean;
  notified: boolean;
  notificationTime?: string;
}

export interface BloodRequest {
  id: string;
  patientId: string;
  patientName: string;
  room: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  quantityUnits: number;
  urgency: BloodRequestUrgency;
  requiredByTime: string;
  createdAt: string;
  hospitalLocation: string;
  requestStatus: 'Searching Donors' | 'Staff Approved' | 'Donors Notified' | 'Units Reserved' | 'Fulfilled' | 'Cancelled';
  searchRadiusKm: 5 | 10 | 15 | 25;
  staffApproved: boolean;
  approvedBy?: string;
  matchedDonors: BloodDonorRecord[];
  notes?: string;
}

// ----------------------------------------------------
// 5. ICU EQUIPMENT & SENSOR MONITORING TYPES
// ----------------------------------------------------
export type DeviceHealthStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';

export interface BedsideEquipmentDevice {
  deviceId: string;
  deviceName: string;
  deviceType: 'Patient Monitor' | 'Mechanical Ventilator' | 'Infusion Pump' | 'Dialysis / CRRT' | 'Defibrillator';
  modelNumber: string;
  room: string;
  bedNumber: string;
  patientId: string;
  connectionState: 'Connected' | 'Loose / Intermittent' | 'Disconnected' | 'Unknown';
  cableIntegrity: 'Secure' | 'Strain Warning' | 'Signal Noise' | 'Simulated Teardown';
  powerSource: 'Mains AC' | 'Internal Battery' | 'UPS Backup';
  batteryPercentage: number;
  isCharging: boolean;
  voltageReading: number; // e.g. 230V or 120V
  voltageStability: 'Stable' | 'Fluctuating' | 'Surge Alert';
  overallStatus: DeviceHealthStatus;
  activeFaults: string[];
  lastTelemetryPing: string;
  isSimulatedTelemetry: boolean;
}

// ----------------------------------------------------
// 6. IN-APP NOTIFICATION TYPES
// ----------------------------------------------------
export type NotificationCategory =
  | 'CLINICAL_ALERT'
  | 'EQUIPMENT_FAULT'
  | 'MEDICINE_EXPIRY'
  | 'LOW_STOCK'
  | 'DELIVERY_UPDATE'
  | 'QUEUE_ALERT'
  | 'BLOOD_REQUEST';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  severity: 'NORMAL' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  timestamp: string;
  patientId?: string;
  room?: string;
  linkType?: 'patient' | 'pharmacy' | 'queue' | 'blood' | 'equipment';
  read: boolean;
  acknowledged: boolean;
}

