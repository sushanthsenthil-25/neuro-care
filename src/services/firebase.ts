/**
 * Firebase Integration Service for NeuroCare Application State.
 * Manages Firebase Realtime State, NFC Tag Bindings, Doctor Assignments, and Alert Acknowledgements.
 * Note: Raw clinical observations are processed via Parquet/DuckDB pipeline.
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Configured for NeuroCare Firebase Project
export const FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyNeuroCareClinicalIntelligence2026Key",
  authDomain: "neurocare-icu-ai.firebaseapp.com",
  projectId: "neurocare-icu-ai",
  storageBucket: "neurocare-icu-ai.appspot.com",
  messagingSenderId: "987654321012",
  appId: "1:987654321012:web:a1b2c3d4e5f6g7h8"
};

export interface AlertAcknowledgement {
  alertId: string;
  recordId: string;
  acknowledgedBy: string;
  userRole: 'Doctor' | 'Nurse';
  timestamp: string;
  notes: string;
}

export interface NFCTagBinding {
  tagId: string;
  recordId: string;
  roomNumber: string;
  boundAt: string;
}

// In-Memory Firebase Collections Store
const nfcBindingsStore: Record<string, NFCTagBinding> = {
  'NFC-TAG-132539': { tagId: 'NFC-TAG-132539', recordId: '132539', roomNumber: 'ICU 01', boundAt: '2026-09-26 14:30' },
  'NFC-TAG-132541': { tagId: 'NFC-TAG-132541', recordId: '132541', roomNumber: 'ICU 02', boundAt: '2026-09-27 08:15' },
  'NFC-TAG-132543': { tagId: 'NFC-TAG-132543', recordId: '132543', roomNumber: 'ICU 03', boundAt: '2026-09-27 11:20' },
  'NFC-TAG-132547': { tagId: 'NFC-TAG-132547', recordId: '132547', roomNumber: 'ICU 04', boundAt: '2026-09-27 16:45' },
  'NFC-TAG-132548': { tagId: 'NFC-TAG-132548', recordId: '132548', roomNumber: 'ICU 05', boundAt: '2026-09-28 02:10' }
};

const alertAcknowledgementsStore: AlertAcknowledgement[] = [];

export async function lookupPatientByNFCTag(tagId: string): Promise<string | null> {
  const binding = nfcBindingsStore[tagId.trim()];
  if (binding) {
    return binding.recordId;
  }
  // Fallback: extract numeric RecordID if tag is prefixed
  if (tagId.startsWith('NFC-TAG-')) {
    return tagId.replace('NFC-TAG-', '');
  }
  return null;
}

export async function acknowledgeAlertInFirebase(ack: AlertAcknowledgement): Promise<boolean> {
  alertAcknowledgementsStore.push(ack);
  return true;
}

export async function getAlertAcknowledgementsFromFirebase(recordId: string): Promise<AlertAcknowledgement[]> {
  return alertAcknowledgementsStore.filter((a) => a.recordId === recordId);
}
