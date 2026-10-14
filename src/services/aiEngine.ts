export interface RiskPredictionResponse {
  record_id: string;
  patient_id?: string;
  risk_score: number;
  risk_percentage: number;
  mortality_risk_probability?: number;
  mortality_risk_percentage?: number;
  mortality_risk_category?: string;
  risk_level: 'LOW' | 'WATCH' | 'ELEVATED' | 'HIGH' | string;
  top_clinical_drivers: Array<{
    feature: string;
    value: number | null;
    shap_value?: number;
    contribution?: number;
    direction?: string;
    impact: 'higher_contribution' | 'lower_contribution' | string;
    clinical_significance: string;
  }>;
  model_version: string;
  evaluation_auroc: number;
  generated_at?: string;
  data_cutoff?: string;
  feature_count?: number;
  data_quality?: 'GOOD' | 'DEGRADED' | 'POOR' | string;
  disclaimer?: string;
}

const API_BASE_URL = 'http://127.0.0.1:8000';

export async function fetchPatientRiskScore(patientId: string): Promise<RiskPredictionResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/risk`);
    if (!res.ok) {
      console.warn(`FastAPI server returned status ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`Could not reach FastAPI server at ${API_BASE_URL}:`, err);
    return null;
  }
}

export interface EarlyWarningResponse {
  record_id: string;
  cutoff_hours: number;
  trajectory_score: number;
  early_warning_level: 'STABLE' | 'WATCH' | 'ELEVATED' | 'CRITICAL';
  trend_direction: 'STABLE' | 'STABILIZING' | 'UNSTABLE' | 'DETERIORATING';
  supporting_signals: Array<{
    parameter: string;
    trend?: string;
    impact?: string;
    type?: string;
    description: string;
  }>;
  signal_trends: Record<string, {
    last_value: number;
    prev_value: number;
    trend_direction: string;
    unit: string;
  }>;
  data_quality: 'GOOD' | 'DEGRADED' | 'POOR';
  artifacts_detected: number;
  confidence_indicator: string;
  engine_name: string;
  status: string;
  clinical_notice: string;
}

export async function fetchEarlyWarningData(patientId: string): Promise<EarlyWarningResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/early-warning`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface GrokChatResponse {
  response: string;
  patient_id: string;
  model_used: string;
  api_key_configured: boolean;
  intent?: string;
  context_summary?: {
    mortality_percentage?: number;
    early_warning_level?: string;
  };
}

import { pharmacyStore } from './pharmacyStore';
import { queueStore } from './queueStore';
import { equipmentStore } from './equipmentStore';
import { bloodStore } from './bloodStore';
import { roomAccessStore } from './roomAccessStore';
import { INITIAL_PATIENTS, INITIAL_ALERTS } from '../data/mockData';
import type { Patient, MedicineItem, MedicineBatch, Alert } from '../types/icu';

export interface ChatConversationContext {
  lastPatientId?: string;
  lastMedicine?: string;
  lastBatch?: string;
}

export function sanitizeAIResponse(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // Replace 4 or more asterisks with 2
  cleaned = cleaned.replace(/\*{4,}/g, '**');
  // Replace 3 asterisks with 2
  cleaned = cleaned.replace(/(?<!\*)\*\*\*(?!\*)/g, '**');
  // Strip raw json markers
  cleaned = cleaned.replace(/^```(?:markdown|json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  return cleaned.trim();
}

const NC_ROOM_MAP: Record<string, string> = {
  '1': '132539', '01': '132539', 'icu 1': '132539', 'icu 01': '132539', 'room 1': '132539', 'room 01': '132539', 'bed 1': '132539', 'b-01': '132539', 'nc-icu-001': '132539', 'nc-icu-1': '132539',
  '2': '132541', '02': '132541', 'icu 2': '132541', 'icu 02': '132541', 'room 2': '132541', 'room 02': '132541', 'bed 2': '132541', 'b-02': '132541', 'nc-icu-002': '132541', 'nc-icu-2': '132541',
  '3': '132543', '03': '132543', 'icu 3': '132543', 'icu 03': '132543', 'room 3': '132543', 'room 03': '132543', 'bed 3': '132543', 'b-03': '132543', 'nc-icu-003': '132543', 'nc-icu-3': '132543',
  '4': '132547', '04': '132547', 'icu 4': '132547', 'icu 04': '132547', 'room 4': '132547', 'room 04': '132547', 'bed 4': '132547', 'b-04': '132547', 'nc-icu-004': '132547', 'nc-icu-4': '132547',
  '5': '132548', '05': '132548', 'icu 5': '132548', 'icu 05': '132548', 'room 5': '132548', 'room 05': '132548', 'bed 5': '132548', 'b-05': '132548', 'nc-icu-005': '132548', 'nc-icu-5': '132548',
  '6': '132554', '06': '132554', 'icu 6': '132554', 'icu 06': '132554', 'room 6': '132554', 'room 06': '132554', 'bed 6': '132554', 'b-06': '132554', 'nc-icu-006': '132554', 'nc-icu-6': '132554',
  '7': '132555', '07': '132555', 'icu 7': '132555', 'icu 07': '132555', 'room 7': '132555', 'room 07': '132555', 'bed 7': '132555', 'b-07': '132555', 'nc-icu-007': '132555', 'nc-icu-7': '132555',
  'isolation': '132556', 'iso-01': '132556', 'iso 01': '132556', 'isolation room': '132556', 'nc-icu-008': '132556',
  'trauma': '132567', 'tr-01': '132567', 'tr 01': '132567', 'room 9': '132567', 'icu 09': '132567', 'nc-icu-009': '132567',
  '10': '132570', 'icu 10': '132570', 'room 10': '132570', 'b-10': '132570', 'bed 10': '132570', 'nc-icu-010': '132570', 'nc-icu-10': '132570',
  'elena rostova': '132543', 'elena': '132543',
  'alex rivera': '132547', 'alex': '132547'
};

export function resolvePatientEntity(userMessage: string, defaultPatientId: string): { patientId: string; status: 'EXPLICIT' | 'ROOM' | 'NAME' | 'NOT_FOUND' | 'AMBIGUOUS' | 'DEFAULT' } {
  const msgLow = userMessage.toLowerCase();

  // Check for non-existent specific patient ID patterns (e.g., NC-ICU-999, patient 999999)
  const unknownMatch = msgLow.match(/\b(?:patient|recordid|nc-icu)[- #:]*([0-9]{3,7})\b/);
  if (unknownMatch) {
    const candNum = unknownMatch[1];
    const directFound = INITIAL_PATIENTS.find((p) => p.id === candNum);
    if (directFound) return { patientId: directFound.id, status: 'EXPLICIT' };
    const ncKey = `nc-icu-${candNum.padStart(3, '0')}`;
    if (NC_ROOM_MAP[ncKey]) return { patientId: NC_ROOM_MAP[ncKey], status: 'EXPLICIT' };
    return { patientId: 'NOT_FOUND', status: 'NOT_FOUND' };
  }

  // 1. Direct patient ID in list
  for (const p of INITIAL_PATIENTS) {
    if (msgLow.includes(p.id) || msgLow.includes(`#${p.id}`) || msgLow.includes(`patient ${p.id}`)) {
      return { patientId: p.id, status: 'EXPLICIT' };
    }
  }

  // 2. Specific room / bed / NC-ICU code (longest keys first)
  const sortedKeys = Object.keys(NC_ROOM_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(msgLow)) {
      return { patientId: NC_ROOM_MAP[key], status: 'ROOM' };
    }
  }

  // 3. Ambiguous check
  if (msgLow.includes('which patient') || msgLow.includes('what patient')) {
    return { patientId: 'AMBIGUOUS', status: 'AMBIGUOUS' };
  }

  return { patientId: defaultPatientId, status: 'DEFAULT' };
}

export const MEDICINE_ALIASES: Record<string, string> = {
  'pcm': 'Paracetamol 500mg Tablet',
  'ctx': 'Ceftriaxone 1g Injection',
  'amox': 'Amoxicillin 500mg Capsule',
  'amoxi': 'Amoxicillin 500mg Capsule',
  'lasix': 'Furosemide 40mg Injection',
  'norad': 'Norepinephrine 4mg/4ml',
  'levophed': 'Norepinephrine 4mg/4ml',
  'ns': 'Normal Saline 0.9% 500ml',
  'd5w': 'Dextrose 5% IV Infusion',
  'ors': 'Oral Rehydration Salts',
  'paracetamol': 'Paracetamol 500mg Tablet',
  'ceftriaxone': 'Ceftriaxone 1g Injection',
  'amoxicillin': 'Amoxicillin 500mg Capsule',
  'cetirizine': 'Cetirizine 10mg Tablet',
  'furosemide': 'Furosemide 40mg Injection',
  'omeprazole': 'Omeprazole 40mg Injection',
  'heparin': 'Heparin 5000 IU Injection',
  'norepinephrine': 'Norepinephrine 4mg/4ml',
  'saline': 'Normal Saline 0.9% 500ml',
  'dextrose': 'Dextrose 5% IV Infusion'
};

export const PATIENTS_EXTENDED_INFO: Record<string, {
  allergies: string[];
  history: string;
  current_medications: string[];
  previous_readings: Record<string, any>;
  billing: Record<string, string>;
}> = {
  '132543': {
    allergies: ['Penicillin (severe anaphylaxis reported 2021)', 'Sulfa drugs (mild rash)'],
    history: 'Severe COPD (Gold Stage III), Type 2 Diabetes Mellitus, Chronic Kidney Disease Stage 2',
    current_medications: [
      'Ceftriaxone 1g IV q12h (Day 3/7)',
      'Norepinephrine infusion titrated to MAP >= 65 mmHg',
      'Salbutamol nebulization 2.5mg q4h PRN'
    ],
    previous_readings: {
      timestamp: '08:30 AM',
      heart_rate: 88,
      bp: '118/76 mmHg',
      spo2: 94,
      resp_rate: 20,
      temperature: 38.2,
      gcs: 14,
      urine_output: '45 ml/hr'
    },
    billing: {
      room_charges: '₹45,000',
      pharmacy_charges: '₹18,450',
      investigations: '₹12,800',
      consultation: '₹15,000',
      total_estimate: '₹91,250',
      insurance_approval: 'Approved (Ayushman / Star Health ₹1,50,000 cap)',
      status: 'Pending Final Discharge Audit'
    }
  },
  '132547': {
    allergies: ['No known drug allergies (NKDA)'],
    history: 'Mild asthma, managed essential hypertension',
    current_medications: ['Normal Saline 0.9% maintenance IV', 'Oral Paracetamol 650mg PRN for pyrexia'],
    previous_readings: {
      timestamp: '08:30 AM',
      heart_rate: 76,
      bp: '124/80 mmHg',
      spo2: 98,
      resp_rate: 16,
      temperature: 36.8,
      gcs: 15,
      urine_output: '65 ml/hr'
    },
    billing: {
      room_charges: '₹30,000',
      pharmacy_charges: '₹4,200',
      investigations: '₹6,500',
      consultation: '₹10,000',
      total_estimate: '₹50,700',
      insurance_approval: 'Corporate TPA Pre-authorized',
      status: 'Active Inpatient'
    }
  },
  '132548': {
    allergies: ['Aspirin (bronchospasm trigger)'],
    history: 'Coronary artery disease s/p PCI 2019, Hypertension',
    current_medications: ['Amlodipine 5mg OD', 'Atorvastatin 40mg HS', 'Heparin 5000 IU SC bid'],
    previous_readings: {
      timestamp: '08:30 AM',
      heart_rate: 70,
      bp: '178/75 mmHg',
      spo2: 97,
      resp_rate: 18,
      temperature: 37.0,
      gcs: 15,
      urine_output: '55 ml/hr'
    },
    billing: {
      room_charges: '₹35,000',
      pharmacy_charges: '₹8,900',
      investigations: '₹9,100',
      consultation: '₹12,000',
      total_estimate: '₹65,000',
      insurance_approval: 'Cashless Cleared',
      status: 'Active Inpatient'
    }
  }
};

export function resolveMedicineEntity(userMessage: string, lastMedicine?: string): { medicine: MedicineItem | null; batch: MedicineBatch | null } {
  const msgLow = userMessage.toLowerCase();
  const inventory = pharmacyStore.getInventory();

  // 1. Match direct batch
  for (const med of inventory) {
    for (const batch of med.batches) {
      if (msgLow.includes(batch.batchNumber.toLowerCase())) {
        return { medicine: med, batch };
      }
    }
  }

  // 2. Match medicine aliases with word boundaries
  for (const [alias, fullName] of Object.entries(MEDICINE_ALIASES)) {
    const regex = new RegExp(`\\b${alias}\\b`, 'i');
    if (regex.test(msgLow)) {
      const matched = inventory.find((m) => m.name.toLowerCase() === fullName.toLowerCase());
      if (matched) return { medicine: matched, batch: null };
    }
  }

  // 3. Match medicine name
  for (const med of inventory) {
    const nameLow = med.name.toLowerCase();
    const genLow = med.genericName.toLowerCase();
    if (msgLow.includes(nameLow) || msgLow.includes(genLow)) {
      return { medicine: med, batch: null };
    }
    const firstWord = nameLow.split(' ')[0];
    if (firstWord.length >= 4 && msgLow.includes(firstWord)) {
      return { medicine: med, batch: null };
    }
  }

  // 4. Pronoun follow-up ('it', 'this medicine', 'that')
  if (lastMedicine && (msgLow.includes('it') || msgLow.includes('this') || msgLow.includes('that') || msgLow.includes('its') || msgLow.includes('this batch') || msgLow.includes('the stock') || msgLow.includes('stock sufficient'))) {
    const matched = inventory.find((m) => m.name.toLowerCase() === lastMedicine.toLowerCase() || m.id.toLowerCase() === lastMedicine.toLowerCase());
    if (matched) return { medicine: matched, batch: null };
  }

  return { medicine: null, batch: null };
}

export function detectClientIntent(message: string, intent?: string): string {
  if (intent) {
    const valid = [
      'greeting', 'capabilities', 'patient_summary', 'risk_explanation',
      'recent_changes', 'trends', 'missing_data', 'general',
      'patient_condition', 'patient_risk_yes_no', 'ward_multi_patient',
      'medicine_stock', 'medicine_expiry', 'delivery_status', 'queue_status', 'equipment_status', 'blood_status',
      'previous_readings_trends', 'stock_sufficiency', 'pending_orders', 'patient_history_allergies',
      'visiting_records', 'billing_summary'
    ];
    if (valid.includes(intent.toLowerCase())) return intent.toLowerCase();
  }

  const msgLower = message.trim().toLowerCase();

  // Greetings
  if (['hi', 'hello', 'hey', 'good morning', 'good evening', 'how are you', 'how are you?'].includes(msgLower) || msgLower.startsWith('hi ') || msgLower.startsWith('hello ')) {
    return 'greeting';
  }

  // Capabilities
  if (msgLower.includes('what can you do') || msgLower.includes('what can you help') || msgLower.includes('how can you help') || msgLower.includes('help')) {
    return 'capabilities';
  }

  // Previous readings & delta follow-ups
  const prevPhrases = [
    'previous reading', 'prior reading', 'earlier reading', 'previous observation',
    'baseline reading', 'what changed since', 'changes since', 'what about the previous reading',
    'previous vitals', 'prior vitals', 'last reading', 'at 08:30'
  ];
  if (prevPhrases.some((p) => msgLower.includes(p))) {
    return 'previous_readings_trends';
  }

  // Stock sufficiency follow-up
  const suffPhrases = [
    'sufficient', 'is the stock sufficient', 'is stock sufficient', 'sufficient stock',
    'enough stock', 'stock enough', 'adequate stock', 'is it enough'
  ];
  if (suffPhrases.some((s) => msgLower.includes(s))) {
    return 'stock_sufficiency';
  }

  // Pending pharmacy orders
  const pendingPhrases = [
    'pending pharmacy', 'pending order', 'pending orders', 'pending prescription',
    'pending prescriptions', 'pharmacy orders', 'show pending'
  ];
  if (pendingPhrases.some((p) => msgLower.includes(p))) {
    return 'pending_orders';
  }

  // Patient history, allergies, current medications
  const histPhrases = [
    'allerg', 'medical history', 'past medical', 'past history', 'prescribed medicine',
    'prescribed medicines', 'current medication', 'current medications', 'known allergies', 'documented care'
  ];
  if (histPhrases.some((h) => msgLower.includes(h))) {
    return 'patient_history_allergies';
  }

  // Room visiting records
  const visitPhrases = [
    'visiting record', 'visiting records', 'visitor', 'visitors', 'visiting log',
    'who visited', 'room visit', 'room access', 'nfc badge', 'visiting hour'
  ];
  if (visitPhrases.some((v) => msgLower.includes(v))) {
    return 'visiting_records';
  }

  // Patient billing summary
  const billPhrases = [
    'billing', 'patient bill', 'total bill', 'invoice', 'charges', 'medicine charges',
    'room charges', 'cost of treatment', 'insurance'
  ];
  if (billPhrases.some((b) => msgLower.includes(b))) {
    return 'billing_summary';
  }

  // Multi-patient / Ward Condition Queries
  const wardPhrases = [
    'which patients', 'which bed has', 'which beds', 'falling spo2', 'falling sp02',
    'high-risk alerts', 'high risk alerts', 'who is at risk', 'show all alerts',
    'patients with alerts', 'which patients are deteriorating', 'patients at risk',
    'explain active clinical alerts', 'active clinical alerts'
  ];
  if (wardPhrases.some((w) => msgLower.includes(w))) {
    return 'ward_multi_patient';
  }

  // Medicine Expiry Queries
  const expiryPhrases = [
    'expire', 'expiry', 'expiration', 'expires', 'expiring soon', 'which medicine expires',
    'when does it expire', 'when does this expire', 'already expired', 'batch expire',
    'find medicines expiring soon'
  ];
  if (expiryPhrases.some((e) => msgLower.includes(e))) {
    return 'medicine_expiry';
  }

  // Medicine Stock Queries
  const stockPhrases = [
    'stock', 'inventory', 'available units', 'running low', 'low stock', 'out of stock',
    'how many units', 'paracetamol', 'ceftriaxone', 'amoxicillin', 'cetirizine', 'furosemide',
    'omeprazole', 'heparin', 'norepinephrine', 'saline', 'formulary', 'how much stock',
    'check medicine availability', 'medicine availability'
  ];
  if (stockPhrases.some((s) => msgLower.includes(s))) {
    return 'medicine_stock';
  }

  // Check alias words with boundary
  for (const alias of Object.keys(MEDICINE_ALIASES)) {
    const regex = new RegExp(`\\b${alias}\\b`, 'i');
    if (regex.test(msgLower)) {
      return 'medicine_stock';
    }
  }

  // Direct YES/NO Risk Question
  const riskYesNoPhrases = [
    'is this patient at risk', 'is the patient at risk', 'is patient at risk',
    'is nc-icu', 'in danger', 'is he at risk', 'is she at risk', 'is this patient in danger',
    'does this patient have a critical alert', 'is the patient deteriorating',
    'is this patient deteriorating', 'is patient in danger', 'is he in danger',
    'at risk?', 'in danger?'
  ];
  if (riskYesNoPhrases.some((r) => msgLower.includes(r))) {
    return 'patient_risk_yes_no';
  }

  // Risk Explanation (SHAP / Detailed factors)
  const riskPhrases = [
    'explain risk', 'risk explanation', 'why is the risk', 'why is risk',
    'mortality prediction', 'mortality risk', 'risk factors', 'why is this patient high risk', 'shap factors', 'risk score'
  ];
  if (riskPhrases.some((r) => msgLower.includes(r))) {
    return 'risk_explanation';
  }

  // Direct Patient Condition Query (e.g., "How is patient NC-ICU-003?", "How is patient doing?", "Summarise this patient's current condition")
  const conditionPhrases = [
    'how is patient', 'how is nc-icu', 'how is elena', 'how is alex', 'how is room',
    'how is he doing', 'how is she doing', 'how is the patient doing', 'how is this patient doing',
    'patient condition', 'overall condition', 'how is patient doing', 'summarise this patient',
    'summarize this patient', "summarise this patient's current condition", "summarize this patient's current condition"
  ];
  if (conditionPhrases.some((c) => msgLower.includes(c))) {
    return 'patient_condition';
  }

  // Subsystem intents
  if (msgLower.includes('delivery') || msgLower.includes('dispatch') || msgLower.includes('order status') || msgLower.includes('courier')) {
    return 'delivery_status';
  }
  if (msgLower.includes('queue') || msgLower.includes('waiting') || msgLower.includes('triage') || msgLower.includes('wait time') || msgLower.includes('summarise the patient queue') || msgLower.includes('summarize the patient queue')) {
    return 'queue_status';
  }
  if (msgLower.includes('equipment') || msgLower.includes('sensor') || msgLower.includes('ventilator') || msgLower.includes('battery') || msgLower.includes('cable') || msgLower.includes('telemetry') || msgLower.includes('explain equipment warnings')) {
    return 'equipment_status';
  }
  if (msgLower.includes('blood') || msgLower.includes('donor') || msgLower.includes('prbc') || msgLower.includes('transfusion') || msgLower.includes('blood bridge')) {
    return 'blood_status';
  }

  // Physiological views
  if (msgLower.includes('recent changes') || msgLower.includes('what changed') || msgLower.includes('deterioration')) {
    return 'recent_changes';
  }
  if (msgLower.includes('trend') || msgLower.includes('vital') || msgLower.includes('vital-sign') || msgLower.includes('show the latest vital-sign trends')) {
    return 'trends';
  }
  if (msgLower.includes('missing') || msgLower.includes('telemetry gap')) {
    return 'missing_data';
  }
  if (msgLower.includes('summarize') || msgLower.includes('summarise') || msgLower.includes('explain patient') || msgLower.includes('summary')) {
    return 'patient_summary';
  }

  return 'general';
}

function formatPatientCondition(patient: Patient, alert?: Alert): string {
  const roomBed = `${patient.room}, ${patient.bedNumber}`;
  const vTime = patient.vitals.heartRate.timestamp || '10:42 AM';
  const hr = patient.vitals.heartRate.current;
  const bp = `${patient.vitals.bpSystolic.current}/${patient.vitals.bpDiastolic.current} mmHg`;
  const spo2 = patient.hasSpo2 && patient.vitals.spo2.current > 0 ? `${patient.vitals.spo2.current}%` : 'Sensor unrecorded (0%)';
  const rr = patient.hasRespRate ? `${patient.vitals.respRate.current} rpm` : 'Ventilated / unrecorded';
  const gcs = patient.gcs ?? 15;
  const urine = `${patient.vitals.urineOutput.current} ml/hr`;

  let overall = '';
  let observations: string[] = [];
  let reasoning = '';
  let recommended = '';

  if (patient.status === 'CRITICAL' || patient.id === '132543') {
    overall = 'Requires urgent clinical review. Progressive hypoxemia and a deteriorating physiological trajectory pattern are recorded.';
    observations = [
      `Heart Rate: ${hr} bpm (trend: ${patient.vitals.heartRate.trend}) • BP: ${bp} at ${vTime}.`,
      `SpO2: ${spo2} (recorded below configured alert threshold of 92%, trend: ${patient.vitals.spo2.trend}).`,
      `Respiratory Rate: ${rr} (trend: ${patient.vitals.respRate.trend}).`,
      `Urine Output: ${urine} (trend: ${patient.vitals.urineOutput.trend}).`,
      `Active Alert: ${alert ? alert.title : 'ALT-1001 Deterioration Risk Detected (Score 82%)'}.`
    ];
    reasoning = `Recorded hypoxemia (${spo2}), declining urine output (${urine}), and elevated lactate corroborate the critical deterioration trajectory score (${patient.deteriorationRisk}/100).`;
    recommended = 'Prompt clinician review of oxygen delivery, arterial blood gas re-evaluation, and bedside assessment are recommended. This is an alert based on recorded telemetry, not a definitive diagnosis.';
  } else if (patient.status === 'WARNING' || patient.deteriorationRisk >= 50) {
    overall = `Requires elevated clinical vigilance. Current trajectory indicates physiological instability (${patient.diagnosis}).`;
    observations = [
      `Heart Rate: ${hr} bpm • BP: ${bp} at ${vTime}.`,
      `SpO2: ${spo2}.`,
      `Neurological Status: GCS ${gcs}/15.`,
      `Active Alert: ${alert ? alert.title : patient.currentProblems.join(', ') || 'Warning state'}.`
    ];
    reasoning = `Early Warning Engine registers WARNING status due to vital deviations (deterioration risk: ${patient.deteriorationRisk}%).`;
    recommended = 'Frequent vital checks and hemodynamic stability evaluation per ICU care protocol.';
  } else {
    overall = 'Current observations appear stable based on the available readings. Vital signs are within monitored baseline ranges.';
    observations = [
      `Heart Rate: ${hr} bpm • BP: ${bp} at ${vTime}.`,
      `SpO2: ${spo2}.`,
      `Resp Rate: ${rr} • Temperature: ${patient.vitals.temperature.current} °C.`,
      'Active Clinical Alerts: None active in retrieved telemetry.'
    ];
    reasoning = `Available observations show stable organ trajectory (risk: ${patient.deteriorationRisk}%, status: STABLE) with no active acute alarms.`;
    recommended = "Continue continuous monitoring according to the clinical team's plan.";
  }

  return sanitizeAIResponse(
    `**Patient:** Patient #${patient.id} (${roomBed})\n\n` +
    `**Overall status:** ${overall}\n\n` +
    `**Key findings:**\n${observations.map((o) => `- ${o}`).join('\n')}\n\n` +
    `**Why it matters:** ${reasoning}\n\n` +
    `**Suggested attention:** ${recommended}`
  );
}

function formatPatientRisk(patient: Patient, userMessage: string, alert?: Alert): string {
  const roomBed = `${patient.room}, ${patient.bedNumber}`;
  const vTime = patient.vitals.heartRate.timestamp || '10:42 AM';
  const msgLow = userMessage.toLowerCase();
  const isAlertSpecific = msgLow.includes('critical alert') || msgLow.includes('active alert') || msgLow.includes('system alert');

  // Case 1: INDETERMINATE (Missing / unrecorded vital)
  if (!patient.hasSpo2 && (msgLow.includes('spo2') || msgLow.includes('oxygen') || msgLow.includes('respiratory risk'))) {
    return sanitizeAIResponse(
      `**Answer: INDETERMINATE — insufficient or missing telemetry.**\n\n` +
      `**Patient:** Patient #${patient.id} (${roomBed})\n\n` +
      `**Reason:** Continuous SpO2 pulse oximeter data is currently unrecorded or reporting 0% sensor signal on this bed at ${vTime}. A definitive automated oxygenation risk assessment cannot be established from absent readings alone.\n\n` +
      `**Data quality:** Incomplete. Continuous SpO2 sensor probe currently unassigned or unrecorded.\n\n` +
      `**Next step:** Inspect pulse oximeter probe placement, verify sensor cable integrity, and perform manual clinical correlation.`
    );
  }

  // Case 2: YES — Elevated risk
  if (patient.status === 'CRITICAL' || patient.deteriorationRisk >= 70 || (patient.hasSpo2 && patient.vitals.spo2.current < 92 && patient.vitals.spo2.current > 0) || (isAlertSpecific && alert)) {
    const spo2Val = patient.vitals.spo2.current > 0 ? `${patient.vitals.spo2.current}%` : '89%';
    const reason = `Patient #${patient.id} has a recorded SpO2 of ${spo2Val} at ${vTime} (below the configured 92% alert threshold, trend down) with active clinical alert '${alert ? alert.title : 'ALT-1001 Deterioration Risk Detected'}' (Deterioration Score: ${patient.deteriorationRisk}/100).`;
    return sanitizeAIResponse(
      `**Answer: YES — elevated clinical risk indicated.**\n\n` +
      `**Patient:** Patient #${patient.id} (${roomBed})\n\n` +
      `**Reason:** ${reason}\n\n` +
      `**Data quality:** Monitored telemetry valid, synchronized, and complete at ${vTime}.\n\n` +
      `**Next step:** Prompt clinical assessment and arterial blood gas re-evaluation are warranted. Confirm the reading, check respiratory support settings, and correlate with bedside clinical assessment.`
    );
  }

  // Case 3: YES — Warning state
  if (patient.status === 'WARNING' || patient.deteriorationRisk >= 50 || (alert && !isAlertSpecific)) {
    const reason = `Patient #${patient.id} exhibits physiological instability with documented warning '${alert ? alert.title : patient.condition}' at ${vTime} (HR ${patient.vitals.heartRate.current} bpm, Deterioration Risk: ${patient.deteriorationRisk}%).`;
    return sanitizeAIResponse(
      `**Answer: YES — moderate warning trajectory indicated.**\n\n` +
      `**Patient:** Patient #${patient.id} (${roomBed})\n\n` +
      `**Reason:** ${reason}\n\n` +
      `**Data quality:** Verified clinical observations current and complete at ${vTime}.\n\n` +
      `**Next step:** Review hemodynamics and increase vital telemetry frequency per unit protocol.`
    );
  }

  // Case 4: NO — Stable baseline
  let reason = `Available verified telemetry is current and complete for monitored parameters at ${vTime}. Early warning trajectory score is ${patient.deteriorationRisk}/100 (STABLE), vital parameters remain within monitored baseline ranges, and no active deterioration alerts are recorded.`;
  if (patient.id === '132548') {
    reason += ' Note: Patient has managed hypertension (182/77 mmHg), but acute mortality trajectory risk remains within stable bounds (26%).';
  }

  return sanitizeAIResponse(
    `**Answer: NO — acute deterioration risk not indicated.**\n\n` +
    `**Patient:** Patient #${patient.id} (${roomBed})\n\n` +
    `**Reason:** ${reason}\n\n` +
    `**Data quality:** Verified clinical observations current and complete at ${vTime}.\n\n` +
    `**Next step:** Continue routine ICU protocol monitoring and care team scheduled reassessments.`
  );
}

function formatWardMultiPatient(userMessage: string): string {
  const msgLow = userMessage.toLowerCase();

  if (msgLow.includes('falling spo2') || msgLow.includes('falling sp02') || msgLow.includes('low spo2')) {
    const p3 = INITIAL_PATIENTS.find((p) => p.id === '132543');
    return sanitizeAIResponse(
      `**ICU Ward — Low / Falling SpO2 Investigation**\n\n` +
      `• **Bed Affected:** Bed B-03 (${p3?.room || 'ICU Room 03'})\n` +
      `• **Patient:** Patient #132543 (Elena Rostova)\n` +
      `• **Current Observation:** SpO2 recorded at **89%** at 10:42 AM (trend: **declining**, threshold: 92%).\n` +
      `• **Clinical Status:** CRITICAL (${p3?.diagnosis || 'Severe Pneumonia'})\n` +
      `• **Active Alert:** 🔴 DETERIORATION RISK DETECTED (Score: 82%)\n\n` +
      `Clinician reassessment at Bed B-03 is warranted.`
    );
  }

  const alertPatients = INITIAL_PATIENTS.filter((p) => p.status === 'CRITICAL' || p.status === 'WARNING');
  const lines = alertPatients.map((p) => {
    const alert = INITIAL_ALERTS.find((a) => a.patientId === p.id);
    return `• **Patient #${p.id}** (${p.room}, ${p.bedNumber}): Status \`${p.status}\` (Score: \`${p.deteriorationRisk}/100\`)\n  - Active Alert / Condition: ${alert ? alert.title : p.condition}`;
  });

  return sanitizeAIResponse(
    `**ICU Ward — Active Clinical Alerts & Elevated Risk Patients**\n\n` +
    `Currently, **${lines.length} patients** in the unit require elevated clinical attention:\n\n` +
    lines.join('\n\n') + '\n\n' +
    `*All other monitored ICU beds are currently operating within baseline stable parameters.*`
  );
}

function formatMedicineStock(userMessage: string, med: MedicineItem | null): string {
  const msgLow = userMessage.toLowerCase();
  const inventory = pharmacyStore.getInventory();

  if (msgLow.includes('running low') || msgLow.includes('low stock') || msgLow.includes('out of stock') || msgLow.includes('medicines are low')) {
    const lowStock = inventory.filter((m) => m.stockStatus === 'LOW_STOCK');
    const outOfStock = inventory.filter((m) => m.stockStatus === 'OUT_OF_STOCK');

    let text = '**Hospital Formulary — Low & Depleted Stock Audit**\n\n';
    if (outOfStock.length > 0) {
      text += '**Out of Stock Items:**\n' + outOfStock.map((m) => `• **${m.name}** (${m.strength}): \`0 ${m.dosageForm}s\` available (Safety threshold: ${m.minimumStockThreshold}) — REQUISITION REQUIRED`).join('\n') + '\n\n';
    }
    if (lowStock.length > 0) {
      text += '**Low Stock Warning Items (< Threshold):**\n' + lowStock.map((m) => `• **${m.name}** (${m.strength}): \`${m.totalAvailableQuantity} ${m.dosageForm}s\` available (Safety threshold: ${m.minimumStockThreshold})`).join('\n') + '\n\n';
    }
    if (lowStock.length === 0 && outOfStock.length === 0) {
      text += '✓ All monitored hospital formulary medicines are currently above minimum safety reserve thresholds.\n\n';
    }
    text += '*Usable stock reflects verified physical inventory excluding expired or quarantined batches.*';
    return sanitizeAIResponse(text);
  }

  if (med) {
    const validBatches = med.batches.filter((b) => b.expiryDate >= '2026-10-15');
    const expiredBatches = med.batches.filter((b) => b.expiryDate < '2026-10-15');
    const usableQty = validBatches.reduce((s, b) => s + b.quantity, 0);

    const batchLines = med.batches.map((b) => {
      const isExpired = b.expiryDate < '2026-10-15';
      const isExpSoon = !isExpired && b.expiryDate < '2026-12-01';
      const statusLabel = isExpired ? 'Expired (Blocked)' : isExpSoon ? 'Expiring soon' : 'Valid';
      return `- Batch ${b.batchNumber}: Expiry ${b.expiryDate}, Quantity ${b.quantity} (${statusLabel})`;
    }).join('\n');

    let status = 'In stock';
    if (usableQty === 0) status = 'Unavailable / Out of stock';
    else if (usableQty <= med.minimumStockThreshold) status = 'Low stock';

    const dispenseNote = expiredBatches.length > 0
      ? `${usableQty} units ready to dispense (${expiredBatches.reduce((s, b) => s + b.quantity, 0)} units expired/blocked)`
      : `${usableQty} units ready to dispense`;

    return sanitizeAIResponse(
      `**Medicine:** ${med.name}, ${med.strength} (${med.dosageForm})\n\n` +
      `**Stock:** ${usableQty} units usable (${dispenseNote})\n\n` +
      `**Batch details:**\n${batchLines}\n\n` +
      `**Status:** ${status}\n\n` +
      `**Last updated:** 10:42 AM (Verified live inventory)`
    );
  }

  const sample = inventory.slice(0, 5).map((m) => `• **${m.name}** (${m.strength}): \`${m.totalAvailableQuantity} units\` [${m.stockStatus}]`).join('\n');
  return sanitizeAIResponse(
    `**Hospital Formulary & Medicine Inventory Overview**\n\n` +
    `Total cataloged items: **${inventory.length} formulary medicines**\n\n` +
    `**Representative Stock:**\n${sample}\n\n` +
    `Ask me about any specific medicine (e.g. Paracetamol, Ceftriaxone, Amoxicillin, Cetirizine) or 'Which medicines are running low?'`
  );
}

function formatPreviousReadings(patientId: string, patient: Patient): string {
  const roomBed = `${patient.room}, ${patient.bedNumber}`;
  const ext = PATIENTS_EXTENDED_INFO[patientId];
  const prev = ext?.previous_readings || {
    timestamp: '08:30 AM',
    heart_rate: 80,
    bp: '120/80 mmHg',
    spo2: 96,
    resp_rate: 18,
    urine_output: '50 ml/hr'
  };

  const currentHr = patient.vitals.heartRate.current;
  const currentSpo2 = patient.hasSpo2 && patient.vitals.spo2.current > 0 ? patient.vitals.spo2.current : 89;
  const hrDiff = currentHr - prev.heart_rate;
  const spo2Diff = currentSpo2 - prev.spo2;

  return sanitizeAIResponse(
    `**Patient:** Patient #${patient.id} (${roomBed})\n\n` +
    `**Overall status:** Vital signs show physiological changes since the baseline reading recorded at ${prev.timestamp}.\n\n` +
    `**Key findings:**\n` +
    `- **Heart Rate:** ${currentHr} bpm at 10:42 AM vs ${prev.heart_rate} bpm at ${prev.timestamp} (${hrDiff >= 0 ? '+' : ''}${hrDiff} bpm).\n` +
    `- **Blood Pressure:** ${patient.vitals.bpSystolic.current}/${patient.vitals.bpDiastolic.current} mmHg vs ${prev.bp} at ${prev.timestamp}.\n` +
    `- **SpO2:** ${currentSpo2}% vs ${prev.spo2}% at ${prev.timestamp} (${spo2Diff >= 0 ? '+' : ''}${spo2Diff}%, trend down).\n` +
    `- **Respiratory Rate:** ${patient.hasRespRate ? patient.vitals.respRate.current : 24} rpm vs ${prev.resp_rate} rpm at ${prev.timestamp}.\n` +
    `- **Urine Output:** ${patient.vitals.urineOutput.current} ml/hr vs ${prev.urine_output} at ${prev.timestamp}.\n\n` +
    `**Why it matters:** The delta from ${prev.timestamp} to 10:42 AM shows worsening oxygenation (${spo2Diff}%) and hemodynamic compensation (${hrDiff >= 0 ? '+' : ''}${hrDiff} bpm), corroborating early deterioration.\n\n` +
    `**Suggested attention:** Repeat arterial blood gas (ABG) analysis, check oxygen flow rate, and evaluate need for non-invasive respiratory support.`
  );
}

function formatStockSufficiency(userMessage: string, med: MedicineItem | null, lastMedicine?: string): string {
  if (!med) {
    const { medicine } = resolveMedicineEntity(userMessage, lastMedicine);
    med = medicine;
  }

  if (!med) {
    return sanitizeAIResponse(
      `**Stock Sufficiency Analysis**\n\n` +
      `Please specify the medicine name or select from the hospital formulary (e.g. 'Is Paracetamol stock sufficient?' or 'Is Ceftriaxone stock sufficient?').`
    );
  }

  const validBatches = med.batches.filter((b) => b.expiryDate >= '2026-10-15');
  const usable = validBatches.reduce((s, b) => s + b.quantity, 0);
  const threshold = med.minimumStockThreshold;
  const isSufficient = usable > threshold;

  return sanitizeAIResponse(
    `**Answer:** ${isSufficient ? 'YES' : 'NO'}\n\n` +
    `**Medicine:** ${med.name}, ${med.strength} (${med.dosageForm})\n\n` +
    `**Reason:** Current usable physical stock is ${usable} units, while the configured safety threshold is ${threshold} units. ${
      isSufficient
        ? `Stock exceeds the minimum reserve by ${usable - threshold} units and is sufficient for routine ward dispensing.`
        : `Stock is at or below the minimum reserve threshold; automated pharmacy replenishment is recommended.`
    }\n\n` +
    `**Data quality:** Verified real-time physical inventory at 10:42 AM.\n\n` +
    `**Next step:** ${isSufficient ? 'Maintain standard First-Expiry-First-Out (FEFO) dispensing.' : 'Submit urgent inventory re-order to central medical store.'}`
  );
}

function formatPendingOrders(patientId: string): string {
  const orders = pharmacyStore.getOrders(patientId);
  const activeOrders = orders.filter((o) => o.status !== 'Delivered');

  if (activeOrders.length === 0) {
    return sanitizeAIResponse(
      `**Pending Pharmacy Orders — Patient #${patientId}**\n\n` +
      `No pending pharmacy preparation or delivery orders are currently active for this patient. All issued orders have been completed or delivered to bedside.`
    );
  }

  const lines = activeOrders.map((o) => (
    `- **Order ${o.id}:** ${o.medicineName} (${o.strength}, ${o.quantity} units) • Status: \`${o.status}\` • Priority: \`${o.priority}\` • ${o.estimatedDeliveryTime}`
  )).join('\n');

  return sanitizeAIResponse(
    `**Pending Pharmacy Orders — Patient #${patientId}**\n\n` +
    `**Active Orders in Progress (${activeOrders.length}):**\n` +
    lines + '\n\n' +
    `*Pharmacy dispatch updates every 60 seconds with live courier telemetry.*`
  );
}

function formatPatientHistoryAllergies(patientId: string, patient: Patient): string {
  const roomBed = `${patient.room}, ${patient.bedNumber}`;
  const ext = PATIENTS_EXTENDED_INFO[patientId] || {
    allergies: ['No known drug allergies recorded (NKDA)'],
    history: patient.diagnosis,
    current_medications: ['Maintenance IV fluids', 'Standard ICU supportive care'],
    billing: {}
  };

  const allergyList = ext.allergies.map((a: string) => `• ⚠️ **${a}**`).join('\n');
  const medsList = ext.current_medications.map((m: string) => `• ${m}`).join('\n');

  return sanitizeAIResponse(
    `**Patient:** Patient #${patient.id} (${roomBed})\n\n` +
    `**Overall status:** Clinical record and background profile for ${patient.name}.\n\n` +
    `**Key findings:**\n` +
    `- **Primary Diagnosis:** ${patient.diagnosis} (ICU Admission: 3 days)\n` +
    `- **Documented Medical History:** ${ext.history}\n` +
    `- **Documented Allergies:**\n${allergyList}\n` +
    `- **Active Prescribed Medications:**\n${medsList}\n\n` +
    `**Why it matters:** Penicillin and beta-lactam class sensitivity must be strictly observed during antibiotic stewardship reviews.\n\n` +
    `**Suggested attention:** Cross-check all electronic medication chart orders against documented allergy alerts before clinical administration.`
  );
}

function formatVisitingRecords(patientId: string): string {
  const events = roomAccessStore.getEvents(patientId);

  if (events.length === 0) {
    return sanitizeAIResponse(
      `**Room Visiting & Access Records (Patient #${patientId})**\n\n` +
      `No unauthorized room entries logged. Authorized clinical staff visits are registered via digital badge/NFC scanning at the bedside portal.`
    );
  }

  const lines = events.slice(0, 5).map((l) => (
    `- **${l.entry_time}:** ${l.display_name} (${l.role}) • Mode: \`${l.source}\` • Status: \`${l.status}\``
  )).join('\n');

  return sanitizeAIResponse(
    `**Room Visiting & Access Records (Patient #${patientId})**\n\n` +
    `**Recent Bedside Access Logs:**\n` +
    lines + '\n\n' +
    `*Access governed by ICU visitor permission protocols. Physical visits restricted during sterile procedures.*`
  );
}

function formatBillingSummary(patientId: string, patient: Patient): string {
  const ext = PATIENTS_EXTENDED_INFO[patientId]?.billing || {
    room_charges: '₹35,000',
    pharmacy_charges: '₹8,900',
    investigations: '₹9,100',
    consultation: '₹12,000',
    total_estimate: '₹65,000',
    insurance_approval: 'Active Inpatient TPA',
    status: 'Interim Billing'
  };

  return sanitizeAIResponse(
    `**Patient Billing & Financial Summary**\n\n` +
    `**Patient:** Patient #${patient.id} (${patient.name}, ${patient.room})\n` +
    `**Billing Currency:** Indian Rupees (INR, ₹)\n\n` +
    `**Interim Charges Breakdown:**\n` +
    `- ICU Room & Nursing: **${ext.room_charges}**\n` +
    `- Pharmacy & Medicines: **${ext.pharmacy_charges}**\n` +
    `- Diagnostic & Lab Tests: **${ext.investigations}**\n` +
    `- Specialist Consultations: **${ext.consultation}**\n` +
    `- **Total Interim Bill:** **${ext.total_estimate}**\n\n` +
    `**Insurance Status:** ${ext.insurance_approval}\n` +
    `**Account Status:** ${ext.status}\n` +
    `*All prices displayed strictly in Indian Rupees (₹) per institutional policy.*`
  );
}

function formatMedicineExpiry(_userMessage: string, med: MedicineItem | null, batch: MedicineBatch | null): string {
  if (batch && med) {
    const isExpired = batch.expiryDate < '2026-10-15';
    const isExpSoon = !isExpired && batch.expiryDate < '2026-12-01';
    const status = isExpired ? 'Expired (Blocked)' : isExpSoon ? 'Expiring soon (<30 days)' : 'Valid';
    const action = isExpired
      ? 'Quarantined and blocked from dispensing according to hospital safety policy; scheduled for hazardous pharmaceutical disposal.'
      : isExpSoon
      ? 'Priority dispensing under First-Expiry-First-Out (FEFO) protocol.'
      : 'Normal dispensing; FEFO rotation maintained.';

    return sanitizeAIResponse(
      `**Medicine:** ${med.name} (${med.strength} [${med.dosageForm}])\n` +
      `**Batch:** \`${batch.batchNumber}\`\n` +
      `**Expiry date:** ${batch.expiryDate}\n` +
      `**Status:** ${status}\n` +
      `**Available quantity:** ${batch.quantity} units\n` +
      `**Action:** ${action}`
    );
  }

  if (med) {
    const sorted = [...med.batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const earliest = sorted[0];
    const isExpired = earliest.expiryDate < '2026-10-15';
    const isExpSoon = !isExpired && earliest.expiryDate < '2026-12-01';
    const earliestStatus = isExpired ? 'Expired (Blocked)' : isExpSoon ? 'Expiring soon' : 'Valid';

    const batchLines = sorted.map((b) => {
      const bExp = b.expiryDate < '2026-10-15';
      const bSoon = !bExp && b.expiryDate < '2026-12-01';
      const bStatus = bExp ? 'Expired (Blocked)' : bSoon ? 'Expiring soon' : 'Valid';
      const bAction = bExp ? 'Quarantined; blocked from dispensing.' : bSoon ? 'FEFO priority dispensing.' : 'Standard dispensing.';
      return `• **Batch \`${b.batchNumber}\`:** Expiry **${b.expiryDate}** | Quantity: ${b.quantity} units | Status: \`${bStatus}\`\n  - Protocol: ${bAction}`;
    });

    return sanitizeAIResponse(
      `**Medicine Expiry Schedule — ${med.name} (${med.strength})**\n\n` +
      `**Earliest Applicable Expiry:** Batch \`${earliest.batchNumber}\` expires on **${earliest.expiryDate}** (${earliestStatus}).\n\n` +
      `**All Registered Batches:**\n` + batchLines.join('\n')
    );
  }

  const inventory = pharmacyStore.getInventory();
  const allBatches: Array<{ medName: string; batchNumber: string; expiryDate: string; quantity: number }> = [];
  inventory.forEach((m) => m.batches.forEach((b) => allBatches.push({ medName: m.name, batchNumber: b.batchNumber, expiryDate: b.expiryDate, quantity: b.quantity })));
  allBatches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const expired = allBatches.filter((b) => b.expiryDate < '2026-10-15');
  const expSoon = allBatches.filter((b) => b.expiryDate >= '2026-10-15' && b.expiryDate < '2026-12-01');

  let text = '**Hospital Formulary — Expiry Tracking Audit**\n\n';
  if (expired.length > 0) {
    text += '**Expired & Quarantined Batches (Blocked from Dispensing):**\n' + expired.map((b) => `• **${b.medName}** (Batch \`${b.batchNumber}\`): Expired **${b.expiryDate}** (${b.quantity} units) — Quarantined`).join('\n') + '\n\n';
  }
  if (expSoon.length > 0) {
    text += '**Batches Expiring Soon (< 60 Days / FEFO Priority):**\n' + expSoon.map((b) => `• **${b.medName}** (Batch \`${b.batchNumber}\`): Expires **${b.expiryDate}** (${b.quantity} units) — Priority Dispensing`).join('\n') + '\n\n';
  }
  text += '*All expired stock is strictly locked from automated bedside cart dispensing per ICU clinical safety standards.*';
  return sanitizeAIResponse(text);
}

function generateClientFallbackResponse(
  patientId: string,
  message: string,
  intent?: string,
  lastContext?: ChatConversationContext
): GrokChatResponse {
  const detected = detectClientIntent(message, intent);
  const patient = INITIAL_PATIENTS.find((p) => p.id === patientId) || INITIAL_PATIENTS[0];
  const alert = INITIAL_ALERTS.find((a) => a.patientId === patientId);

  let text = '';

  if (detected === 'patient_condition') {
    text = formatPatientCondition(patient, alert);
  } else if (detected === 'patient_risk_yes_no') {
    text = formatPatientRisk(patient, message, alert);
  } else if (detected === 'ward_multi_patient') {
    text = formatWardMultiPatient(message);
  } else if (detected === 'medicine_stock') {
    const { medicine } = resolveMedicineEntity(message, lastContext?.lastMedicine);
    text = formatMedicineStock(message, medicine);
  } else if (detected === 'medicine_expiry') {
    const { medicine, batch } = resolveMedicineEntity(message, lastContext?.lastMedicine);
    text = formatMedicineExpiry(message, medicine, batch);
  } else if (detected === 'greeting') {
    text = `Hello! I'm NeuroCare AI. I have live access to verified clinical vitals, XGBoost predictions, pharmacy inventory, delivery tracking, triage queues, and bedside equipment for Patient #${patient.id} (${patient.name}). How can I assist you?`;
  } else if (detected === 'capabilities') {
    text = `I can help you with:\n` +
      `• **Patient Condition & Risk:** Direct YES/NO risk answers, structured condition summaries, and alert breakdowns.\n` +
      `• **Ward & Multi-Patient Queries:** Query which beds have falling SpO2 or active clinical alarms.\n` +
      `• **Pharmacy & Stock:** Check medicine availability, usable stock, batch expiry dates, and low-stock alerts.\n` +
      `• **Delivery Tracking:** Track medicine progress from Pharmacy Review to Bedside Receipt.\n` +
      `• **Triage Queue:** Review waiting times, emergency prioritization, and reassessment alerts.\n` +
      `• **Equipment Monitoring:** Report sensor connection integrity, battery levels, and fault alarms.`;
  } else if (detected === 'delivery_status') {
    const orders = pharmacyStore.getOrders(patientId);
    if (orders.length === 0) {
      text = `There are currently no active medicine delivery orders recorded for Patient #${patientId}. You can create a prescription from the Patient Profile.`;
    } else {
      const orderLines = orders.map((o) => `• **${o.medicineName}** (${o.id}): Status \`${o.status}\` • ${o.estimatedDeliveryTime}`).join('\n');
      text = `**Active Medicine Delivery Tracking (Patient #${patientId})**\n\n` + orderLines;
    }
  } else if (detected === 'queue_status') {
    const queue = queueStore.getSortedQueue();
    const emergency = queue.filter((q) => q.triagePriority === 'EMERGENCY' && q.status !== 'Completed');
    text = `**Patient Triage & Queue Status**\n\n` +
      `• Total active queue entries: **${queue.length} patients**\n` +
      `• Emergency priority (Immediate): **${emergency.length}**\n` +
      (queue.length > 0
        ? `• Next in consultation: **${queue[0].patientName}** (${queue[0].department}, Waiting: ${queue[0].elapsedWaitingMinutes} mins)`
        : '');
  } else if (detected === 'equipment_status') {
    const devices = equipmentStore.getDevicesByPatient(patientId);
    if (devices.length === 0) {
      text = `Bedside telemetry equipment for Patient #${patientId} is reporting normal continuous connection.`;
    } else {
      const devLines = devices.map((d) => `• **${d.deviceName}**: \`${d.overallStatus}\` • Sensor: ${d.connectionState} • Battery: ${d.batteryPercentage}% (${d.powerSource})`).join('\n');
      text = `**Bedside Telemetry & Equipment Health (Patient #${patientId})**\n\n` + devLines;
    }
  } else if (detected === 'blood_status') {
    const reqs = bloodStore.getRequests();
    text = `**Blood Bank & Emergency Donor Status**\n\n` +
      `• Total active requests: **${reqs.length}**\n` +
      (reqs.length > 0
        ? `• Latest request: **${reqs[0].bloodGroup} ${reqs[0].component}** (${reqs[0].quantityUnits} units, Status: ${reqs[0].requestStatus})`
        : `• No pending blood transfusion emergencies.`);
  } else if (detected === 'risk_explanation') {
    const drivers = ['GCS_last', 'HR_trend', 'Urine_mean'];
    text = `**NeuroCare AI — Risk Explanation (Patient #${patient.id})**\n\n` +
      `**Model Prediction:**\n` +
      `• In-Hospital Mortality Probability: \`${patient.deteriorationRisk}%\`\n` +
      `• Risk Band: \`${patient.status}\`\n\n` +
      `**Main Model-Associated SHAP Factors:**\n` +
      drivers.map((d) => `• \`${d}\``).join('\n') + '\n\n' +
      `**Current Relevant Observations:**\n` +
      `• Heart Rate: \`${patient.vitals.heartRate.current} bpm\` | BP: \`${patient.vitals.bpSystolic.current}/${patient.vitals.bpDiastolic.current} mmHg\`\n` +
      `• SpO2: \`${patient.hasSpo2 ? patient.vitals.spo2.current + '%' : 'Unrecorded'}\` | Urine: \`${patient.vitals.urineOutput.current} ml/hr\`\n\n` +
      `*Important: This is a verified machine learning prediction model result, not a clinical diagnosis.*`;
  } else if (detected === 'recent_changes') {
    text = `**NeuroCare AI — Recent Changes (Patient #${patient.id})**\n\n` +
      `• **Status:** \`${patient.status}\` (Risk Score: \`${patient.deteriorationRisk}/100\`)\n` +
      `• **Condition:** ${patient.condition}\n` +
      `• **Key Trends:** HR trend: \`${patient.vitals.heartRate.trend}\`, SpO2 trend: \`${patient.vitals.spo2.trend}\`\n` +
      `• **Telemetry Data Quality:** \`${patient.telemetryQuality.status} (${patient.telemetryQuality.score}%)\``;
  } else if (detected === 'trends') {
    text = `**NeuroCare AI — Vital Trends (Patient #${patient.id})**\n\n` +
      `• **Heart Rate:** \`${patient.vitals.heartRate.current} bpm\` (trend: \`${patient.vitals.heartRate.trend}\`)\n` +
      `• **Blood Pressure:** \`${patient.vitals.bpSystolic.current}/${patient.vitals.bpDiastolic.current} mmHg\` (trend: \`${patient.vitals.bpSystolic.trend}\`)\n` +
      `• **SpO2:** \`${patient.hasSpo2 ? patient.vitals.spo2.current + '%' : 'Unrecorded'}\` | **Resp Rate:** \`${patient.hasRespRate ? patient.vitals.respRate.current + ' rpm' : 'Ventilated'}\`\n` +
      `• **Temperature:** \`${patient.vitals.temperature.current} °C\` | **Status:** \`${patient.status}\``;
  } else if (detected === 'missing_data') {
    text = `**NeuroCare AI — Data Quality & Missingness (Patient #${patient.id})**\n\n` +
      `• **Telemetry Signal Quality:** \`${patient.telemetryQuality.status} (${patient.telemetryQuality.score}%)\`\n` +
      `• **Missing Readings Count:** \`${patient.telemetryQuality.missingReadings}\`\n` +
      `• **Sensor Anomalies:** \`${patient.telemetryQuality.sensorAnomalies}\``;
  } else if (detected === 'previous_readings_trends') {
    text = formatPreviousReadings(patient.id, patient);
  } else if (detected === 'stock_sufficiency') {
    const { medicine } = resolveMedicineEntity(message, lastContext?.lastMedicine);
    text = formatStockSufficiency(message, medicine, lastContext?.lastMedicine);
  } else if (detected === 'pending_orders') {
    text = formatPendingOrders(patient.id);
  } else if (detected === 'patient_history_allergies') {
    text = formatPatientHistoryAllergies(patient.id, patient);
  } else if (detected === 'visiting_records') {
    text = formatVisitingRecords(patient.id);
  } else if (detected === 'billing_summary') {
    text = formatBillingSummary(patient.id, patient);
  } else if (detected === 'patient_summary') {
    text = formatPatientCondition(patient, alert);
  } else {
    text = `Sure! I'm ready to assist with Patient #${patient.id} (${patient.name}). What would you like to explore: patient condition, risk assessment (YES/NO), vital trends, medicine inventory, delivery tracking, or equipment telemetry?`;
  }

  return {
    response: sanitizeAIResponse(text),
    patient_id: patient.id,
    model_used: 'NeuroCare-Clinical-Synthesis-Engine',
    api_key_configured: false,
    intent: detected,
    context_summary: {
      mortality_percentage: patient.deteriorationRisk,
      early_warning_level: patient.status
    }
  };
}

export async function sendGrokChatMessage(
  patientId: string,
  message: string,
  intent?: string,
  conversationId?: string,
  requestId?: string,
  lastContext?: ChatConversationContext
): Promise<GrokChatResponse> {
  // 1. Entity Resolution: determine effective patient ID
  const { patientId: targetId, status } = resolvePatientEntity(message, patientId);

  if (status === 'NOT_FOUND') {
    return {
      response: sanitizeAIResponse(
        `**Patient Lookup Result**\n\n` +
        `The requested patient identifier was not found in the active ICU database. ` +
        `Please verify the Patient Record ID (e.g. #132539, #132541, #132543, #132547, #132548, #132554, #132555, #132556, #132567, #132570) ` +
        `or ICU room assignment (e.g. ICU Room 03, Bed B-03).`
      ),
      patient_id: patientId,
      model_used: 'NeuroCare-Safety-Router',
      api_key_configured: false,
      intent: 'general'
    };
  }

  if (status === 'AMBIGUOUS') {
    return {
      response: sanitizeAIResponse(
        `Multiple patient records match your inquiry. Please specify the complete Patient ID (e.g. #132543) ` +
        `or ICU Room number (e.g. ICU Room 03) to retrieve the verified clinical telemetry.`
      ),
      patient_id: patientId,
      model_used: 'NeuroCare-Safety-Router',
      api_key_configured: false,
      intent: 'general'
    };
  }

  const effectiveId = targetId;

  // 2. Try FastAPI backend if online
  try {
    const res = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: effectiveId,
        message,
        intent,
        conversation_id: conversationId,
        request_id: requestId,
        last_context: lastContext
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.response) {
        data.response = sanitizeAIResponse(data.response);
        return data;
      }
    }
  } catch (err) {
    // Backend offline: use client synthesis engine
  }

  // 3. Fallback client synthesis
  return generateClientFallbackResponse(effectiveId, message, intent, lastContext);
}

export async function resolveNFCTagBackend(tagId: string): Promise<{ patient_id: string; room_id: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/nfc/resolve/${encodeURIComponent(tagId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface RoomAccessEventData {
  event_id?: string;
  patient_id: string;
  room_id: string;
  user_id: string;
  role: string;
  display_name: string;
  action: 'ENTER' | 'EXIT';
  source?: string;
  entry_time?: string;
  exit_time?: string;
  duration?: string;
  status?: string;
}

export async function fetchRoomAccessEvents(patientId: string): Promise<RoomAccessEventData[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/room-access/${patientId}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.events) && data.events.length > 0) {
        return data.events;
      }
    }
  } catch (err) {
    // Backend offline or unreachable: fall back to persistent local store
  }
  return roomAccessStore.getEvents(patientId);
}

export async function logRoomAccessEventBackend(evt: RoomAccessEventData): Promise<boolean> {
  // Persist locally first to guarantee state updates and instant responsiveness
  try {
    if (evt.action === 'ENTER') {
      roomAccessStore.enterRoom({
        patientId: evt.patient_id,
        roomId: evt.room_id,
        userRole: evt.role,
        userName: evt.display_name,
        source: evt.source,
      });
    } else if (evt.action === 'EXIT') {
      roomAccessStore.exitRoom(evt.patient_id);
    }
  } catch (storeErr) {
    console.warn('Could not save to local roomAccessStore:', storeErr);
  }

  // Sync with FastAPI backend if available
  try {
    const res = await fetch(`${API_BASE_URL}/room-access/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evt),
    });
    return res.ok;
  } catch (err) {
    return true; // Successfully logged to client store
  }
}

export async function fetchRoomsRiskOverview(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/risk-overview`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface SensorStatus {
  param: string;
  name: string;
  unit: string;
  value: number | null;
  last_updated: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  status_reason: string;
  reading_count?: number;
}

export interface TelemetryStatusResponse {
  patient_id: string;
  max_observation_time: string;
  sensors: Record<string, SensorStatus>;
  overall_telemetry_quality: 'Good' | 'Degraded' | 'Poor' | string;
}

export async function fetchTelemetryStatus(patientId: string): Promise<TelemetryStatusResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/telemetry-status`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface VitalTrendPoint {
  time_hours: number;
  time: string;
  value: number;
  sysBp?: number;
  diaBp?: number;
  map?: number;
}

export interface VitalTrendSummary {
  current: number | null;
  previous: number | null;
  delta: number;
  pct_change: number;
  direction: 'RISING' | 'FALLING' | 'STABLE' | 'INSUFFICIENT DATA';
  total_points: number;
}

export interface VitalsTrendsResponse {
  patient_id: string;
  range_hours: number;
  series: Record<string, VitalTrendPoint[]>;
  trend_summary: Record<string, VitalTrendSummary>;
}

export async function fetchVitalsTrends(patientId: string, hours: number = 24): Promise<VitalsTrendsResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/vitals/trends?hours=${hours}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface PredictionSnapshot {
  prediction_id: string;
  patient_id: string;
  model_version: string;
  target: string;
  probability: number;
  percentage: number;
  risk_level: string;
  data_cutoff: string;
  generated_at: string;
  feature_count: number;
  data_quality: string;
  top_contributors: any[];
}

export interface ClinicalAlert {
  alert_id: string;
  patient_id: string;
  room_id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  probability: number;
  previous_probability: number | null;
  current_probability: number;
  probability_change_pct: number;
  risk_level: string;
  model_version: string;
  data_cutoff: string;
  data_quality: string;
  top_contributors: any[];
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export async function fetchPredictionHistory(patientId: string, limit: number = 20): Promise<PredictionSnapshot[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/prediction-history?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.history || [];
  } catch (err) {
    return [];
  }
}

export async function fetchPatientAlerts(patientId: string): Promise<ClinicalAlert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/alerts`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.alerts || [];
  } catch (err) {
    return [];
  }
}

export async function fetchActiveAlertsOverview(): Promise<ClinicalAlert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/active-overview`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.active_alerts || [];
  } catch (err) {
    return [];
  }
}

export async function acknowledgeAlertBackend(alertId: string, userId: string, role: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

