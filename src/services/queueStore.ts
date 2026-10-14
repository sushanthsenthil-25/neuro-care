import type { PatientQueueEntry, QueueStatus } from '../types/icu';

const STORAGE_KEY_QUEUE = 'neurocare_patient_queue_v1';

// Initial realistic synthetic patient queue entries
export const INITIAL_QUEUE_ENTRIES: PatientQueueEntry[] = [
  {
    id: 'Q-EM-101',
    patientName: 'Rohan Deshmukh',
    age: 58,
    gender: 'Male',
    arrivalTime: new Date(Date.now() - 18 * 60 * 1000).toISOString(), // 18 mins ago
    arrivalTimestampMs: Date.now() - 18 * 60 * 1000,
    department: 'Neuro-Trauma',
    triagePriority: 'EMERGENCY',
    priorityScore: 1, // Emergency Highest
    chiefComplaint: 'Acute subarachnoid hemorrhage with sudden drop in GCS (14 -> 9)',
    assignedClinician: 'Dr. Marcus Vance, MD',
    status: 'Triage',
    elapsedWaitingMinutes: 18,
    estimatedWaitMinutes: 0, // Immediate
    reassessmentRequired: true,
    lastReassessmentTime: '5 mins ago',
  },
  {
    id: 'Q-ICU-102',
    patientName: 'Meera Iyer',
    age: 46,
    gender: 'Female',
    arrivalTime: new Date(Date.now() - 32 * 60 * 1000).toISOString(), // 32 mins ago
    arrivalTimestampMs: Date.now() - 32 * 60 * 1000,
    department: 'ICU Triage',
    triagePriority: 'URGENT',
    priorityScore: 2,
    chiefComplaint: 'Sepsis alert: persistent tachycardia (HR 124) with elevated lactate',
    assignedClinician: 'Dr. Sarah Jenkins',
    status: 'Waiting',
    elapsedWaitingMinutes: 32,
    estimatedWaitMinutes: 10,
    reassessmentRequired: true, // Urgent waiting > 30 mins triggers reassessment alert!
    lastReassessmentTime: '15 mins ago',
  },
  {
    id: 'Q-EM-103',
    patientName: 'Kunal Verma',
    age: 34,
    gender: 'Male',
    arrivalTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    arrivalTimestampMs: Date.now() - 12 * 60 * 1000,
    department: 'Emergency',
    triagePriority: 'URGENT',
    priorityScore: 2,
    chiefComplaint: 'Post-op respiratory distress following craniotomy, SpO2 91% on room air',
    assignedClinician: 'Dr. Marcus Vance, MD',
    status: 'In-Consult',
    elapsedWaitingMinutes: 12,
    estimatedWaitMinutes: 5,
    reassessmentRequired: false,
  },
  {
    id: 'Q-SD-104',
    patientName: 'Anandi Patel',
    age: 69,
    gender: 'Female',
    arrivalTime: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
    arrivalTimestampMs: Date.now() - 48 * 60 * 1000,
    department: 'Step-down',
    triagePriority: 'ROUTINE',
    priorityScore: 3,
    chiefComplaint: 'Elective transfer evaluation from Ward 3 for telemetry step-down',
    assignedClinician: 'Dr. Sarah Jenkins',
    status: 'Waiting',
    elapsedWaitingMinutes: 48,
    estimatedWaitMinutes: 25,
    reassessmentRequired: false,
  },
];

class QueueStore {
  private queue: PatientQueueEntry[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const qStr = localStorage.getItem(STORAGE_KEY_QUEUE);
      this.queue = qStr ? JSON.parse(qStr) : INITIAL_QUEUE_ENTRIES;
    } catch {
      this.queue = INITIAL_QUEUE_ENTRIES;
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Failed to save queue to localStorage:', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // Returns queue sorted strictly by Clinical Urgency first, then FIFO timestamp
  public getSortedQueue(): PatientQueueEntry[] {
    const now = Date.now();
    return this.queue
      .map((item) => {
        const elapsed = Math.max(0, Math.floor((now - item.arrivalTimestampMs) / (1000 * 60)));
        // Reassessment rule: Emergency always flagged; Urgent flagged if waiting > 30 mins
        const reassessment = item.triagePriority === 'EMERGENCY' || (item.triagePriority === 'URGENT' && elapsed >= 30);
        return {
          ...item,
          elapsedWaitingMinutes: elapsed,
          reassessmentRequired: reassessment,
        };
      })
      .sort((a, b) => {
        // Priority 1 (Emergency) comes before Priority 2 (Urgent) comes before Priority 3 (Routine)
        if (a.priorityScore !== b.priorityScore) {
          return a.priorityScore - b.priorityScore;
        }
        // Within same priority, earliest arrival first (FIFO)
        return a.arrivalTimestampMs - b.arrivalTimestampMs;
      });
  }

  public addQueueEntry(entry: Omit<PatientQueueEntry, 'id' | 'arrivalTimestampMs' | 'elapsedWaitingMinutes' | 'priorityScore' | 'reassessmentRequired'>): PatientQueueEntry {
    const priorityScore = entry.triagePriority === 'EMERGENCY' ? 1 : entry.triagePriority === 'URGENT' ? 2 : 3;
    const now = Date.now();
    const newEntry: PatientQueueEntry = {
      ...entry,
      id: `Q-${Date.now().toString().slice(-4)}`,
      arrivalTimestampMs: now,
      priorityScore,
      elapsedWaitingMinutes: 0,
      reassessmentRequired: entry.triagePriority === 'EMERGENCY',
    };
    this.queue.unshift(newEntry);
    this.saveState();
    return newEntry;
  }

  public updateQueueStatus(id: string, newStatus: QueueStatus): boolean {
    const item = this.queue.find((q) => q.id === id);
    if (!item) return false;
    item.status = newStatus;
    if (newStatus === 'In-Consult' || newStatus === 'Admitted' || newStatus === 'Completed') {
      item.reassessmentRequired = false;
    }
    this.saveState();
    return true;
  }

  public recordReassessment(id: string, notes?: string): boolean {
    const item = this.queue.find((q) => q.id === id);
    if (!item) return false;
    item.lastReassessmentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    item.reassessmentRequired = false;
    if (notes) {
      item.chiefComplaint += ` [Reassessed: ${notes}]`;
    }
    this.saveState();
    return true;
  }
}

export const queueStore = new QueueStore();
