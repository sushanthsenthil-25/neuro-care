import type { RoomAccessEventData } from './aiEngine';

const STORAGE_KEY_ROOM_ACCESS = 'neurocare_room_access_events_v2';

export const INITIAL_ROOM_ACCESS_EVENTS: RoomAccessEventData[] = [
  {
    event_id: 'evt-demo-103',
    patient_id: '132543',
    room_id: 'ICU 03',
    user_id: 'usr-dr-vance',
    role: 'Doctor',
    display_name: 'Dr. Marcus Vance, MD',
    action: 'ENTER',
    entry_time: '09:15',
    exit_time: '09:35',
    duration: '20 min',
    source: 'NFC',
    status: 'COMPLETED',
  },
  {
    event_id: 'evt-demo-104',
    patient_id: '132543',
    room_id: 'ICU 03',
    user_id: 'usr-nurse-evans',
    role: 'Nurse',
    display_name: 'Nurse Chloe Evans, RN',
    action: 'ENTER',
    entry_time: '10:10',
    exit_time: '10:25',
    duration: '15 min',
    source: 'NFC',
    status: 'COMPLETED',
  },
  {
    event_id: 'evt-demo-101',
    patient_id: '132547',
    room_id: 'ICU 04',
    user_id: 'usr-dr-kumar',
    role: 'Doctor',
    display_name: 'Dr. Kumar, MD',
    action: 'ENTER',
    entry_time: '14:05',
    exit_time: '14:17',
    duration: '12 min',
    source: 'NFC',
    status: 'COMPLETED',
  },
  {
    event_id: 'evt-demo-102',
    patient_id: '132547',
    room_id: 'ICU 04',
    user_id: 'usr-nurse-jenkins',
    role: 'Nurse',
    display_name: 'Nurse Sarah Jenkins, RN',
    action: 'ENTER',
    entry_time: '14:22',
    exit_time: '14:31',
    duration: '9 min',
    source: 'Manual',
    status: 'COMPLETED',
  },
  {
    event_id: 'evt-demo-105',
    patient_id: '132539',
    room_id: 'ICU 01',
    user_id: 'usr-dr-sen',
    role: 'Doctor',
    display_name: 'Dr. Ananya Sen, MD',
    action: 'ENTER',
    entry_time: '08:30',
    exit_time: '08:48',
    duration: '18 min',
    source: 'NFC',
    status: 'COMPLETED',
  },
];

class RoomAccessStore {
  private events: RoomAccessEventData[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ROOM_ACCESS);
      if (stored) {
        this.events = JSON.parse(stored);
      } else {
        this.events = [...INITIAL_ROOM_ACCESS_EVENTS];
      }
    } catch {
      this.events = [...INITIAL_ROOM_ACCESS_EVENTS];
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_ROOM_ACCESS, JSON.stringify(this.events));
    } catch (e) {
      console.warn('Failed to save room access events to localStorage:', e);
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

  public getEvents(patientId: string): RoomAccessEventData[] {
    return this.events.filter((e) => e.patient_id === patientId);
  }

  public getActiveSession(patientId: string): RoomAccessEventData | null {
    return (
      this.events.find(
        (e) => e.patient_id === patientId && (e.status === 'ACTIVE' || e.exit_time === 'ACTIVE NOW')
      ) || null
    );
  }

  public enterRoom(params: {
    patientId: string;
    roomId: string;
    userRole: string;
    userName: string;
    source?: string;
  }): RoomAccessEventData {
    const now = new Date();
    const nowStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Close any previous active session for this patient before starting new one
    this.events.forEach((e) => {
      if (e.patient_id === params.patientId && (e.status === 'ACTIVE' || e.exit_time === 'ACTIVE NOW')) {
        e.status = 'COMPLETED';
        e.exit_time = nowStr;
        e.duration = 'Completed';
      }
    });

    const newEvent: RoomAccessEventData = {
      event_id: `evt-${Date.now().toString().slice(-6)}`,
      patient_id: params.patientId,
      room_id: params.roomId,
      user_id: `usr-${params.userRole.toLowerCase()}-${Date.now().toString().slice(-4)}`,
      role: params.userRole,
      display_name: params.userName,
      action: 'ENTER',
      entry_time: nowStr,
      exit_time: 'ACTIVE NOW',
      duration: 'Active Session',
      source: params.source || 'Manual',
      status: 'ACTIVE',
    };

    this.events.unshift(newEvent);
    this.saveState();
    return newEvent;
  }

  public exitRoom(patientId: string, exitTime?: string): RoomAccessEventData | null {
    const now = new Date();
    const nowStr = exitTime || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const activeIndex = this.events.findIndex(
      (e) => e.patient_id === patientId && (e.status === 'ACTIVE' || e.exit_time === 'ACTIVE NOW')
    );

    if (activeIndex === -1) {
      return null;
    }

    const session = this.events[activeIndex];
    session.status = 'COMPLETED';
    session.exit_time = nowStr;

    // Calculate duration
    try {
      if (session.entry_time) {
        const [eh, em] = session.entry_time.split(':').map((p) => parseInt(p, 10));
        const [xh, xm] = nowStr.split(':').map((p) => parseInt(p, 10));
        let diffMinutes = (xh * 60 + xm) - (eh * 60 + em);
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        session.duration = `${Math.max(1, diffMinutes)} min`;
      } else {
        session.duration = '1 min';
      }
    } catch {
      session.duration = '1 min';
    }

    this.saveState();
    return session;
  }

  public addManualVisitRecord(params: {
    patientId: string;
    roomId: string;
    userRole: string;
    userName: string;
    entryTime: string;
    exitTime: string;
    durationMinutes?: number;
    source?: string;
  }): RoomAccessEventData {
    const duration = params.durationMinutes ? `${params.durationMinutes} min` : '15 min';

    const newRecord: RoomAccessEventData = {
      event_id: `evt-man-${Date.now().toString().slice(-6)}`,
      patient_id: params.patientId,
      room_id: params.roomId,
      user_id: `usr-${params.userRole.toLowerCase()}`,
      role: params.userRole,
      display_name: params.userName,
      action: 'ENTER',
      entry_time: params.entryTime,
      exit_time: params.exitTime,
      duration: duration,
      source: params.source || 'Manual',
      status: 'COMPLETED',
    };

    this.events.unshift(newRecord);
    this.saveState();
    return newRecord;
  }
}

export const roomAccessStore = new RoomAccessStore();
