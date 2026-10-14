import type { BedsideEquipmentDevice } from '../types/icu';

const STORAGE_KEY_EQUIPMENT = 'neurocare_equipment_telemetry_v1';

// Initial realistic synthetic equipment dataset for ICU Rooms 01 - 10
export const INITIAL_EQUIPMENT_DATA: BedsideEquipmentDevice[] = [
  // Room 01 (Patient 132539)
  {
    deviceId: 'EQ-01-MON',
    deviceName: 'Philips IntelliVue MX800 Multi-Parameter Monitor',
    deviceType: 'Patient Monitor',
    modelNumber: 'MX800-SN8821',
    room: 'ICU Room 01',
    bedNumber: 'Bed 01',
    patientId: '132539',
    connectionState: 'Connected',
    cableIntegrity: 'Secure',
    powerSource: 'Mains AC',
    batteryPercentage: 98,
    isCharging: true,
    voltageReading: 231,
    voltageStability: 'Stable',
    overallStatus: 'NORMAL',
    activeFaults: [],
    lastTelemetryPing: 'Just now (1 sec ago)',
    isSimulatedTelemetry: true,
  },
  {
    deviceId: 'EQ-01-PUMP',
    deviceName: 'BD Alaris Quad-Channel Infusion System',
    deviceType: 'Infusion Pump',
    modelNumber: 'ALARIS-8015-1A',
    room: 'ICU Room 01',
    bedNumber: 'Bed 01',
    patientId: '132539',
    connectionState: 'Connected',
    cableIntegrity: 'Secure',
    powerSource: 'Mains AC',
    batteryPercentage: 88,
    isCharging: true,
    voltageReading: 229,
    voltageStability: 'Stable',
    overallStatus: 'NORMAL',
    activeFaults: [],
    lastTelemetryPing: 'Just now',
    isSimulatedTelemetry: true,
  },

  // Room 03 (Patient 132543 - Elena Rostova - Critical Alert Patient)
  {
    deviceId: 'EQ-03-MON',
    deviceName: 'Philips IntelliVue MX800 Multi-Parameter Monitor',
    deviceType: 'Patient Monitor',
    modelNumber: 'MX800-SN8823',
    room: 'ICU Room 03',
    bedNumber: 'Bed 03',
    patientId: '132543',
    connectionState: 'Loose / Intermittent',
    cableIntegrity: 'Signal Noise',
    powerSource: 'Internal Battery',
    batteryPercentage: 38,
    isCharging: false,
    voltageReading: 218,
    voltageStability: 'Fluctuating',
    overallStatus: 'WARNING',
    activeFaults: [
      'Hardware Notice: Lead II ECG electrode impedance high (loose sensor contact)',
      'Running on Internal Battery (AC Mains Disconnected or Switched)',
    ],
    lastTelemetryPing: '12 sec ago',
    isSimulatedTelemetry: true,
  },
  {
    deviceId: 'EQ-03-VENT',
    deviceName: 'Hamilton-C6 Intelligent ICU Ventilator',
    deviceType: 'Mechanical Ventilator',
    modelNumber: 'HAM-C6-7741',
    room: 'ICU Room 03',
    bedNumber: 'Bed 03',
    patientId: '132543',
    connectionState: 'Connected',
    cableIntegrity: 'Secure',
    powerSource: 'Mains AC',
    batteryPercentage: 94,
    isCharging: true,
    voltageReading: 230,
    voltageStability: 'Stable',
    overallStatus: 'NORMAL',
    activeFaults: [],
    lastTelemetryPing: 'Just now',
    isSimulatedTelemetry: true,
  },
  {
    deviceId: 'EQ-03-PUMP',
    deviceName: 'BD Alaris Quad-Channel Infusion System',
    deviceType: 'Infusion Pump',
    modelNumber: 'ALARIS-8015-3A',
    room: 'ICU Room 03',
    bedNumber: 'Bed 03',
    patientId: '132543',
    connectionState: 'Connected',
    cableIntegrity: 'Strain Warning',
    powerSource: 'Mains AC',
    batteryPercentage: 18, // <20% critical battery!
    isCharging: true,
    voltageReading: 228,
    voltageStability: 'Stable',
    overallStatus: 'WARNING',
    activeFaults: ['Channel B: Downstream occlusion detected on IV line', 'Internal backup battery degraded (18%)'],
    lastTelemetryPing: 'Just now',
    isSimulatedTelemetry: true,
  },

  // Room 04 (Patient 132547 - Devi Sharma)
  {
    deviceId: 'EQ-04-MON',
    deviceName: 'Philips IntelliVue MX800 Multi-Parameter Monitor',
    deviceType: 'Patient Monitor',
    modelNumber: 'MX800-SN8824',
    room: 'ICU Room 04',
    bedNumber: 'Bed 04',
    patientId: '132547',
    connectionState: 'Connected',
    cableIntegrity: 'Secure',
    powerSource: 'Mains AC',
    batteryPercentage: 92,
    isCharging: true,
    voltageReading: 232,
    voltageStability: 'Stable',
    overallStatus: 'NORMAL',
    activeFaults: [],
    lastTelemetryPing: 'Just now',
    isSimulatedTelemetry: true,
  },
  {
    deviceId: 'EQ-04-VENT',
    deviceName: 'Puritan Bennett 980 Series Ventilator',
    deviceType: 'Mechanical Ventilator',
    modelNumber: 'PB980-04A',
    room: 'ICU Room 04',
    bedNumber: 'Bed 04',
    patientId: '132547',
    connectionState: 'Connected',
    cableIntegrity: 'Secure',
    powerSource: 'Mains AC',
    batteryPercentage: 96,
    isCharging: true,
    voltageReading: 230,
    voltageStability: 'Stable',
    overallStatus: 'NORMAL',
    activeFaults: [],
    lastTelemetryPing: 'Just now',
    isSimulatedTelemetry: true,
  },

  // Room 02 (Patient 132541)
  {
    deviceId: 'EQ-02-MON',
    deviceName: 'Philips IntelliVue Multi-Parameter Monitor',
    deviceType: 'Patient Monitor',
    modelNumber: 'MX800-SN8822',
    room: 'ICU Room 02',
    bedNumber: 'Bed 02',
    patientId: '132541',
    connectionState: 'Connected',
    cableIntegrity: 'Secure',
    powerSource: 'Mains AC',
    batteryPercentage: 99,
    isCharging: true,
    voltageReading: 231,
    voltageStability: 'Stable',
    overallStatus: 'NORMAL',
    activeFaults: [],
    lastTelemetryPing: 'Just now',
    isSimulatedTelemetry: true,
  },
];

class EquipmentStore {
  private devices: BedsideEquipmentDevice[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const eqStr = localStorage.getItem(STORAGE_KEY_EQUIPMENT);
      this.devices = eqStr ? JSON.parse(eqStr) : INITIAL_EQUIPMENT_DATA;
    } catch {
      this.devices = INITIAL_EQUIPMENT_DATA;
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(this.devices));
    } catch (e) {
      console.warn('Failed to save equipment state:', e);
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

  public getAllDevices(): BedsideEquipmentDevice[] {
    return this.devices;
  }

  public getDevicesByPatient(patientId: string): BedsideEquipmentDevice[] {
    return this.devices.filter((d) => d.patientId === patientId);
  }

  public getDevicesByRoom(roomName: string): BedsideEquipmentDevice[] {
    return this.devices.filter(
      (d) => d.room.toLowerCase().includes(roomName.toLowerCase()) || roomName.toLowerCase().includes(d.room.toLowerCase())
    );
  }

  // Get aggregated room equipment status: NORMAL | WARNING | CRITICAL | OFFLINE
  public getRoomEquipmentStatus(roomName: string): 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE' {
    const devs = this.getDevicesByRoom(roomName);
    if (devs.length === 0) return 'NORMAL';
    if (devs.some((d) => d.overallStatus === 'CRITICAL')) return 'CRITICAL';
    if (devs.some((d) => d.overallStatus === 'WARNING')) return 'WARNING';
    if (devs.some((d) => d.overallStatus === 'OFFLINE')) return 'OFFLINE';
    return 'NORMAL';
  }

  // Acknowledge/clear equipment fault
  public clearEquipmentFault(deviceId: string, faultIndex: number): boolean {
    const dev = this.devices.find((d) => d.deviceId === deviceId);
    if (!dev) return false;

    dev.activeFaults.splice(faultIndex, 1);
    if (dev.activeFaults.length === 0) {
      dev.overallStatus = 'NORMAL';
      dev.connectionState = 'Connected';
    }
    this.saveState();
    return true;
  }
}

export const equipmentStore = new EquipmentStore();
