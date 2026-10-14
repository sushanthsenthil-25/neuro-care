import type { AppNotification, NotificationCategory } from '../types/icu';

const STORAGE_KEY_NOTIFICATIONS = 'neurocare_app_notifications_v1';

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'NOTIF-01',
    category: 'CLINICAL_ALERT',
    severity: 'CRITICAL',
    title: 'Critical Trajectory Deterioration Alert',
    message: 'Patient #132543 (Elena Rostova, ICU 03) trajectory score jumped to 78/100 (HR 104 bpm, RR 30 rpm).',
    timestamp: '10 mins ago',
    patientId: '132543',
    room: 'ICU Room 03',
    linkType: 'patient',
    read: false,
    acknowledged: false,
  },
  {
    id: 'NOTIF-02',
    category: 'DELIVERY_UPDATE',
    severity: 'NORMAL',
    title: 'Pharmacy STAT Dispatch: Norepinephrine',
    message: 'Norepinephrine 4mg/4ml (Order ORD-2026-102) dispatched via ICU urgent runner to Room 04.',
    timestamp: '15 mins ago',
    patientId: '132547',
    room: 'ICU Room 04',
    linkType: 'pharmacy',
    read: false,
    acknowledged: false,
  },
  {
    id: 'NOTIF-03',
    category: 'EQUIPMENT_FAULT',
    severity: 'WARNING',
    title: 'Bedside Equipment Hardware Notice',
    message: 'Philips Monitor in Room 03: Lead II sensor contact loose + running on internal battery.',
    timestamp: '25 mins ago',
    patientId: '132543',
    room: 'ICU Room 03',
    linkType: 'equipment',
    read: false,
    acknowledged: false,
  },
  {
    id: 'NOTIF-04',
    category: 'LOW_STOCK',
    severity: 'WARNING',
    title: 'Pharmacy Stock Alert: Cetirizine & Furosemide',
    message: 'Cetirizine 10mg (28 remaining) and Furosemide 40mg (45 remaining) have dipped below minimum safety thresholds.',
    timestamp: '40 mins ago',
    linkType: 'pharmacy',
    read: true,
    acknowledged: false,
  },
  {
    id: 'NOTIF-05',
    category: 'QUEUE_ALERT',
    severity: 'WARNING',
    title: 'Triage Patient Reassessment Due',
    message: 'Patient Meera Iyer (Q-ICU-102) has been in Urgent Triage queue for >30 minutes. Reassessment required.',
    timestamp: '45 mins ago',
    linkType: 'queue',
    read: false,
    acknowledged: false,
  },
  {
    id: 'NOTIF-06',
    category: 'BLOOD_REQUEST',
    severity: 'CRITICAL',
    title: 'Blood Bank: Donors Notified for O- PRBC',
    message: 'Simulated alert dispatched to 2 matched donors within 15 km for Patient #132543.',
    timestamp: '1 hour ago',
    patientId: '132543',
    room: 'ICU Room 03',
    linkType: 'blood',
    read: true,
    acknowledged: true,
  },
];

class NotificationStore {
  private notifications: AppNotification[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const nStr = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      this.notifications = nStr ? JSON.parse(nStr) : INITIAL_NOTIFICATIONS;
    } catch {
      this.notifications = INITIAL_NOTIFICATIONS;
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this.notifications));
    } catch (e) {
      console.warn('Failed to save notifications:', e);
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

  public getNotifications(category?: NotificationCategory): AppNotification[] {
    if (category) {
      return this.notifications.filter((n) => n.category === category);
    }
    return this.notifications;
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public markAsRead(id: string): void {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif && !notif.read) {
      notif.read = true;
      this.saveState();
    }
  }

  public markAllAsRead(): void {
    this.notifications.forEach((n) => (n.read = true));
    this.saveState();
  }

  public acknowledgeNotification(id: string): void {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.acknowledged = true;
      notif.read = true;
      this.saveState();
    }
  }

  public addNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'acknowledged'>): AppNotification {
    const newNotif: AppNotification = {
      ...notification,
      id: `NOTIF-${Date.now().toString().slice(-4)}`,
      timestamp: 'Just now',
      read: false,
      acknowledged: false,
    };
    this.notifications.unshift(newNotif);
    this.saveState();
    return newNotif;
  }
}

export const notificationStore = new NotificationStore();
