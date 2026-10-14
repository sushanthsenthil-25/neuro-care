import type {
  MedicineItem,
  MedicineBatch,
  StockMovement,
  Prescription,
  PharmacyOrder,
  PatientBillingItem,
  DeliveryStatus,
} from '../types/icu';

const STORAGE_KEY_INVENTORY = 'neurocare_medicine_inventory_v1';
const STORAGE_KEY_ORDERS = 'neurocare_pharmacy_orders_v1';
const STORAGE_KEY_PRESCRIPTIONS = 'neurocare_prescriptions_v1';
const STORAGE_KEY_MOVEMENTS = 'neurocare_stock_movements_v1';
const STORAGE_KEY_BILLING = 'neurocare_patient_billing_v1';

// Initial realistic synthetic demo medicine inventory
export const INITIAL_MEDICINE_INVENTORY: MedicineItem[] = [
  {
    id: 'MED-PCM-500',
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    strength: '500 mg',
    dosageForm: 'Tablet',
    category: 'Analgesic',
    minimumStockThreshold: 100,
    unitPrice: 1.50,
    supplier: {
      name: 'Apex Pharma Healthcare Ltd',
      contact: '+91-80-2345-6789 (support@apexpharma.in)',
      leadTimeDays: 2,
    },
    batches: [
      {
        batchNumber: 'PCM-2026-A1',
        quantity: 140,
        initialQuantity: 200,
        expiryDate: '2027-08-30',
        receivedDate: '2026-02-15',
      },
      {
        batchNumber: 'PCM-2025-X9',
        quantity: 25,
        initialQuantity: 100,
        expiryDate: '2026-11-05', // Expiring soon (<30 days)
        receivedDate: '2025-11-01',
      },
      {
        batchNumber: 'PCM-2024-OLD',
        quantity: 10,
        initialQuantity: 50,
        expiryDate: '2025-12-31', // Expired batch (blocked from dispensing)
        receivedDate: '2024-06-10',
      },
    ],
    totalAvailableQuantity: 165,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
    notes: 'Synthetic demo batch data for ICU antipyretic protocol.',
  },
  {
    id: 'MED-PCM-IV',
    name: 'Paracetamol IV Infusion',
    genericName: 'Acetaminophen IV',
    strength: '1000 mg / 100 ml',
    dosageForm: 'IV Infusion',
    category: 'Analgesic',
    minimumStockThreshold: 40,
    unitPrice: 8.50,
    supplier: {
      name: 'Apex Pharma Healthcare Ltd',
      contact: '+91-80-2345-6789',
      leadTimeDays: 2,
    },
    batches: [
      {
        batchNumber: 'PCMI-8812',
        quantity: 65,
        initialQuantity: 100,
        expiryDate: '2027-05-15',
        receivedDate: '2026-03-01',
      },
    ],
    totalAvailableQuantity: 65,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-AMX-500',
    name: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    strength: '500 mg',
    dosageForm: 'Capsule',
    category: 'Antibiotic',
    minimumStockThreshold: 80,
    unitPrice: 3.20,
    supplier: {
      name: 'GlenBio Life Sciences',
      contact: 'orders@glenbio.com',
      leadTimeDays: 3,
    },
    batches: [
      {
        batchNumber: 'AMX-441-B',
        quantity: 95,
        initialQuantity: 150,
        expiryDate: '2027-03-20',
        receivedDate: '2026-01-10',
      },
    ],
    totalAvailableQuantity: 95,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-CET-10',
    name: 'Cetirizine',
    genericName: 'Cetirizine Hydrochloride',
    strength: '10 mg',
    dosageForm: 'Tablet',
    category: 'Antihistamine',
    minimumStockThreshold: 50,
    unitPrice: 1.20,
    supplier: {
      name: 'SunMed Formulary',
      contact: 'dispatch@sunmed.org',
      leadTimeDays: 2,
    },
    batches: [
      {
        batchNumber: 'CET-9021',
        quantity: 28, // Below 50 threshold -> LOW STOCK
        initialQuantity: 80,
        expiryDate: '2027-09-12',
        receivedDate: '2026-04-05',
      },
    ],
    totalAvailableQuantity: 28,
    stockStatus: 'LOW_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-ORS-SAC',
    name: 'Oral Rehydration Salts (ORS)',
    genericName: 'Sodium Chloride, Potassium, Dextrose',
    strength: '21.8 g Sachet',
    dosageForm: 'Sachet',
    category: 'Electrolyte/Fluid',
    minimumStockThreshold: 100,
    unitPrice: 0.90,
    supplier: {
      name: 'Lifeline Solutions Corp',
      contact: 'info@lifelinesolutions.in',
      leadTimeDays: 1,
    },
    batches: [
      {
        batchNumber: 'ORS-7731',
        quantity: 210,
        initialQuantity: 300,
        expiryDate: '2028-01-30',
        receivedDate: '2026-05-10',
      },
    ],
    totalAvailableQuantity: 210,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-NS-500',
    name: 'Normal Saline 0.9%',
    genericName: 'Sodium Chloride 0.9% IV',
    strength: '500 ml IV Bag',
    dosageForm: 'IV Infusion',
    category: 'Electrolyte/Fluid',
    minimumStockThreshold: 120,
    unitPrice: 4.50,
    supplier: {
      name: 'Baxter Sterile Solutions',
      contact: 'hospital-care@baxter-demo.com',
      leadTimeDays: 2,
    },
    batches: [
      {
        batchNumber: 'NS-2026-09A',
        quantity: 180,
        initialQuantity: 250,
        expiryDate: '2027-12-15',
        receivedDate: '2026-06-01',
      },
      {
        batchNumber: 'NS-2026-09B',
        quantity: 90,
        initialQuantity: 100,
        expiryDate: '2027-11-20',
        receivedDate: '2026-06-01',
      },
    ],
    totalAvailableQuantity: 270,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-D5W-500',
    name: 'Dextrose Solution 5%',
    genericName: 'Dextrose in Water (D5W)',
    strength: '500 ml IV Bag',
    dosageForm: 'IV Infusion',
    category: 'Electrolyte/Fluid',
    minimumStockThreshold: 80,
    unitPrice: 4.80,
    supplier: {
      name: 'Baxter Sterile Solutions',
      contact: 'hospital-care@baxter-demo.com',
      leadTimeDays: 2,
    },
    batches: [
      {
        batchNumber: 'D5W-5501',
        quantity: 110,
        initialQuantity: 150,
        expiryDate: '2027-10-10',
        receivedDate: '2026-06-15',
      },
    ],
    totalAvailableQuantity: 110,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-CTX-1G',
    name: 'Ceftriaxone',
    genericName: 'Ceftriaxone Sodium',
    strength: '1 g Vial',
    dosageForm: 'Vial',
    category: 'Antibiotic',
    minimumStockThreshold: 60,
    unitPrice: 12.00,
    supplier: {
      name: 'GlenBio Life Sciences',
      contact: 'orders@glenbio.com',
      leadTimeDays: 3,
    },
    batches: [
      {
        batchNumber: 'CTX-1092',
        quantity: 85,
        initialQuantity: 120,
        expiryDate: '2027-04-18',
        receivedDate: '2026-03-22',
      },
    ],
    totalAvailableQuantity: 85,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-OMP-40',
    name: 'Omeprazole IV',
    genericName: 'Omeprazole Sodium',
    strength: '40 mg Vial',
    dosageForm: 'Vial',
    category: 'Gastrointestinal',
    minimumStockThreshold: 50,
    unitPrice: 7.40,
    supplier: {
      name: 'Zydus Critical Care',
      contact: 'supply@zydus-demo.in',
      leadTimeDays: 2,
    },
    batches: [
      {
        batchNumber: 'OMP-4011',
        quantity: 70,
        initialQuantity: 100,
        expiryDate: '2027-07-25',
        receivedDate: '2026-04-15',
      },
    ],
    totalAvailableQuantity: 70,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-OMP-20',
    name: 'Omeprazole Capsules',
    genericName: 'Omeprazole Delayed-Release',
    strength: '20 mg',
    dosageForm: 'Capsule',
    category: 'Gastrointestinal',
    minimumStockThreshold: 75,
    unitPrice: 2.10,
    supplier: {
      name: 'Zydus Critical Care',
      contact: 'supply@zydus-demo.in',
      leadTimeDays: 2,
    },
    batches: [
      {
        batchNumber: 'OMPC-302',
        quantity: 120,
        initialQuantity: 150,
        expiryDate: '2027-11-01',
        receivedDate: '2026-05-18',
      },
    ],
    totalAvailableQuantity: 120,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-FUR-40',
    name: 'Furosemide',
    genericName: 'Furosemide 10mg/ml',
    strength: '40 mg / 4 ml Ampoule',
    dosageForm: 'Ampoule',
    category: 'Diuretic',
    minimumStockThreshold: 50,
    unitPrice: 3.50,
    supplier: {
      name: 'Sanofi Emergency Therapeutics',
      contact: 'icu-orders@sanofi-demo.org',
      leadTimeDays: 1,
    },
    batches: [
      {
        batchNumber: 'FUR-881',
        quantity: 45, // Below 50 threshold -> LOW STOCK
        initialQuantity: 100,
        expiryDate: '2027-02-14',
        receivedDate: '2026-01-20',
      },
    ],
    totalAvailableQuantity: 45,
    stockStatus: 'LOW_STOCK',
    isSyntheticDemo: true,
  },
  {
    id: 'MED-NE-4',
    name: 'Norepinephrine',
    genericName: 'Norepinephrine Bitartrate',
    strength: '4 mg / 4 ml Ampoule',
    dosageForm: 'Ampoule',
    category: 'Cardiovascular',
    minimumStockThreshold: 30,
    unitPrice: 18.50,
    supplier: {
      name: 'Critical Vasopressors Int',
      contact: 'vaso@critical-demo.com',
      leadTimeDays: 1,
    },
    batches: [
      {
        batchNumber: 'NE-9903',
        quantity: 42,
        initialQuantity: 60,
        expiryDate: '2027-06-30',
        receivedDate: '2026-04-10',
      },
    ],
    totalAvailableQuantity: 42,
    stockStatus: 'IN_STOCK',
    isSyntheticDemo: true,
  },
];

// Initial realistic synthetic demo prescriptions
export const INITIAL_PRESCRIPTIONS: Prescription[] = [
  {
    id: 'RX-132543-01',
    patientId: '132543',
    patientName: 'Elena Rostova',
    room: 'ICU Room 03',
    bedNumber: 'Bed 03',
    medicineId: 'MED-CTX-1G',
    medicineName: 'Ceftriaxone',
    genericName: 'Ceftriaxone Sodium',
    strength: '1 g Vial',
    dose: '1 g',
    route: 'IV',
    frequency: 'Q12H',
    scheduledTime: '14:00',
    quantity: 2,
    prescribedBy: 'Dr. Marcus Vance, MD',
    prescribedAt: '2026-10-14 09:30',
    urgency: 'Urgent',
    instructions: 'Reconstitute with 10ml sterile water. Infuse over 30 mins.',
    status: 'Dispensed',
    associatedOrderId: 'ORD-2026-101',
  },
  {
    id: 'RX-132547-02',
    patientId: '132547',
    patientName: 'Devi Sharma',
    room: 'ICU Room 04',
    bedNumber: 'Bed 04',
    medicineId: 'MED-NE-4',
    medicineName: 'Norepinephrine',
    genericName: 'Norepinephrine Bitartrate',
    strength: '4 mg / 4 ml Ampoule',
    dose: '4 mg in 50ml D5W',
    route: 'IV',
    frequency: 'STAT',
    scheduledTime: 'Immediate',
    quantity: 2,
    prescribedBy: 'Dr. Marcus Vance, MD',
    prescribedAt: '2026-10-14 11:15',
    urgency: 'STAT',
    instructions: 'Titrate central venous line for MAP > 65 mmHg.',
    status: 'Dispensed',
    associatedOrderId: 'ORD-2026-102',
  },
  {
    id: 'RX-132539-03',
    patientId: '132539',
    patientName: 'Arthur Pendelton',
    room: 'ICU Room 01',
    bedNumber: 'Bed 01',
    medicineId: 'MED-OMP-40',
    medicineName: 'Omeprazole IV',
    genericName: 'Omeprazole Sodium',
    strength: '40 mg Vial',
    dose: '40 mg',
    route: 'IV',
    frequency: 'OD',
    scheduledTime: '08:00',
    quantity: 1,
    prescribedBy: 'Dr. Sarah Jenkins',
    prescribedAt: '2026-10-14 07:45',
    urgency: 'Routine',
    instructions: 'Prophylaxis for stress ulcer.',
    status: 'Active',
    associatedOrderId: 'ORD-2026-103',
  },
];

// Initial realistic pharmacy orders
export const INITIAL_PHARMACY_ORDERS: PharmacyOrder[] = [
  {
    id: 'ORD-2026-101',
    prescriptionId: 'RX-132543-01',
    patientId: '132543',
    patientName: 'Elena Rostova',
    room: 'ICU Room 03',
    bedNumber: 'Bed 03',
    medicineId: 'MED-CTX-1G',
    medicineName: 'Ceftriaxone 1g Vial',
    strength: '1 g',
    quantity: 2,
    priority: 'Urgent',
    orderedAt: '10:15',
    status: 'Delivered',
    allocatedBatchNumber: 'CTX-1092',
    reviewedBy: 'Pharm. Rajesh Rao',
    preparedBy: 'Pharm. Ananya Sen',
    dispatchedBy: 'Courier Vijay',
    deliveredBy: 'Nurse Chloe Evans, RN',
    lastUpdated: '11:05',
    estimatedDeliveryTime: 'Delivered at 11:02',
    unitPrice: 12.00,
    totalCost: 24.00,
    billedToPatient: true,
    timeline: [
      { step: 'Pending', label: 'Order Placed', timestamp: '10:15', completed: true, actor: 'Dr. Marcus Vance' },
      { step: 'Pharmacy Review', label: 'Clinical Verification', timestamp: '10:22', completed: true, actor: 'Pharm. Rajesh Rao' },
      { step: 'Preparing', label: 'Sterile Compounding', timestamp: '10:35', completed: true, actor: 'Pharm. Ananya Sen' },
      { step: 'Ready', label: 'Barcoded for Delivery', timestamp: '10:45', completed: true, actor: 'Pharm. Ananya Sen' },
      { step: 'Out for Delivery', label: 'Pneumatic / Porter Dispatched', timestamp: '10:50', completed: true, actor: 'Courier Vijay' },
      { step: 'Delivered', label: 'Received & Verified at Bedside', timestamp: '11:02', completed: true, actor: 'Nurse Chloe Evans, RN' },
    ],
  },
  {
    id: 'ORD-2026-102',
    prescriptionId: 'RX-132547-02',
    patientId: '132547',
    patientName: 'Devi Sharma',
    room: 'ICU Room 04',
    bedNumber: 'Bed 04',
    medicineId: 'MED-NE-4',
    medicineName: 'Norepinephrine 4mg/4ml',
    strength: '4 mg',
    quantity: 2,
    priority: 'STAT',
    orderedAt: '11:15',
    status: 'Out for Delivery',
    allocatedBatchNumber: 'NE-9903',
    reviewedBy: 'Pharm. Rajesh Rao',
    preparedBy: 'Pharm. Rajesh Rao',
    dispatchedBy: 'Porter Ramesh (Urgent Runner)',
    lastUpdated: '11:28',
    estimatedDeliveryTime: 'ETA 5 mins (~11:35)',
    unitPrice: 18.50,
    totalCost: 37.00,
    billedToPatient: true,
    timeline: [
      { step: 'Pending', label: 'STAT Order Placed', timestamp: '11:15', completed: true, actor: 'Dr. Marcus Vance' },
      { step: 'Pharmacy Review', label: 'Emergency Fast-Track Verification', timestamp: '11:17', completed: true, actor: 'Pharm. Rajesh Rao' },
      { step: 'Preparing', label: 'Dispensed from ICU Rapid Vault', timestamp: '11:22', completed: true, actor: 'Pharm. Rajesh Rao' },
      { step: 'Ready', label: 'Sealed STAT Carrier', timestamp: '11:25', completed: true, actor: 'Pharm. Rajesh Rao' },
      { step: 'Out for Delivery', label: 'Urgent ICU Runner En Route', timestamp: '11:28', completed: true, actor: 'Porter Ramesh' },
      { step: 'Delivered', label: 'Awaiting Bedside Receipt', completed: false },
    ],
  },
  {
    id: 'ORD-2026-103',
    prescriptionId: 'RX-132539-03',
    patientId: '132539',
    patientName: 'Arthur Pendelton',
    room: 'ICU Room 01',
    bedNumber: 'Bed 01',
    medicineId: 'MED-OMP-40',
    medicineName: 'Omeprazole IV 40mg',
    strength: '40 mg',
    quantity: 1,
    priority: 'Routine',
    orderedAt: '11:40',
    status: 'Pharmacy Review',
    reviewedBy: 'Pharm. Rajesh Rao',
    lastUpdated: '11:45',
    estimatedDeliveryTime: 'ETA 30 mins (~12:15)',
    unitPrice: 7.40,
    totalCost: 7.40,
    billedToPatient: false,
    timeline: [
      { step: 'Pending', label: 'Order Placed', timestamp: '11:40', completed: true, actor: 'Dr. Sarah Jenkins' },
      { step: 'Pharmacy Review', label: 'Checking Stock & Allergies', timestamp: '11:45', completed: true, actor: 'Pharm. Rajesh Rao' },
      { step: 'Preparing', label: 'Pending Dispensing', completed: false },
      { step: 'Ready', label: 'Ready for Dispatch', completed: false },
      { step: 'Out for Delivery', label: 'Delivery Queue', completed: false },
      { step: 'Delivered', label: 'Bedside Receipt', completed: false },
    ],
  },
];

// Initial patient billing records
export const INITIAL_BILLING_RECORDS: PatientBillingItem[] = [
  {
    id: 'BILL-101',
    patientId: '132543',
    description: 'Ceftriaxone 1g Vial (x2) - ICU Protocol',
    category: 'Pharmacy',
    unitPrice: 12.00,
    quantity: 2,
    totalAmount: 24.00,
    timestamp: '2026-10-14 11:02',
    orderId: 'ORD-2026-101',
  },
  {
    id: 'BILL-102',
    patientId: '132547',
    description: 'Norepinephrine 4mg/4ml (x2) - STAT Vasopressor',
    category: 'Pharmacy',
    unitPrice: 18.50,
    quantity: 2,
    totalAmount: 37.00,
    timestamp: '2026-10-14 11:25',
    orderId: 'ORD-2026-102',
  },
  {
    id: 'BILL-103',
    patientId: '132543',
    description: 'ICU Bed Charges - 24hr Critical Monitoring Unit',
    category: 'Bed',
    unitPrice: 850.00,
    quantity: 1,
    totalAmount: 850.00,
    timestamp: '2026-10-14 00:00',
  },
];

// Helper: Calculate batch flags (expired / expiring soon)
export function enrichBatches(batches: MedicineBatch[]): MedicineBatch[] {
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  return batches.map((b) => {
    const exp = new Date(b.expiryDate);
    const isExpired = exp < today;
    const isExpiringSoon = !isExpired && exp <= thirtyDaysFromNow;
    return {
      ...b,
      isExpired,
      isExpiringSoon,
    };
  });
}

// Helper: Calculate medicine total available quantity & stock status
export function enrichMedicine(med: MedicineItem): MedicineItem {
  const enrichedBatches = enrichBatches(med.batches);
  // Total available quantity strictly excludes expired batches
  const validBatches = enrichedBatches.filter((b) => !b.isExpired);
  const totalAvailable = validBatches.reduce((acc, b) => acc + b.quantity, 0);

  let status: MedicineItem['stockStatus'] = 'IN_STOCK';
  if (totalAvailable === 0) {
    status = 'OUT_OF_STOCK';
  } else if (totalAvailable <= med.minimumStockThreshold) {
    status = 'LOW_STOCK';
  } else if (enrichedBatches.some((b) => b.isExpiringSoon)) {
    status = 'EXPIRING_SOON';
  }

  return {
    ...med,
    batches: enrichedBatches,
    totalAvailableQuantity: totalAvailable,
    stockStatus: status,
  };
}

// ----------------------------------------------------
// LOCAL STORAGE PERSISTENCE MANAGER
// ----------------------------------------------------
class PharmacyStore {
  private inventory: MedicineItem[] = [];
  private orders: PharmacyOrder[] = [];
  private prescriptions: Prescription[] = [];
  private movements: StockMovement[] = [];
  private billing: PatientBillingItem[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const invStr = localStorage.getItem(STORAGE_KEY_INVENTORY);
      this.inventory = invStr ? JSON.parse(invStr) : INITIAL_MEDICINE_INVENTORY.map(enrichMedicine);

      const ordStr = localStorage.getItem(STORAGE_KEY_ORDERS);
      this.orders = ordStr ? JSON.parse(ordStr) : INITIAL_PHARMACY_ORDERS;

      const rxStr = localStorage.getItem(STORAGE_KEY_PRESCRIPTIONS);
      this.prescriptions = rxStr ? JSON.parse(rxStr) : INITIAL_PRESCRIPTIONS;

      const movStr = localStorage.getItem(STORAGE_KEY_MOVEMENTS);
      this.movements = movStr ? JSON.parse(movStr) : [];

      const billStr = localStorage.getItem(STORAGE_KEY_BILLING);
      this.billing = billStr ? JSON.parse(billStr) : INITIAL_BILLING_RECORDS;
    } catch (e) {
      console.warn('Failed to parse pharmacy store from localStorage:', e);
      this.inventory = INITIAL_MEDICINE_INVENTORY.map(enrichMedicine);
      this.orders = INITIAL_PHARMACY_ORDERS;
      this.prescriptions = INITIAL_PRESCRIPTIONS;
      this.movements = [];
      this.billing = INITIAL_BILLING_RECORDS;
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(this.inventory));
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(this.orders));
      localStorage.setItem(STORAGE_KEY_PRESCRIPTIONS, JSON.stringify(this.prescriptions));
      localStorage.setItem(STORAGE_KEY_MOVEMENTS, JSON.stringify(this.movements));
      localStorage.setItem(STORAGE_KEY_BILLING, JSON.stringify(this.billing));
    } catch (e) {
      console.warn('Failed to save pharmacy state to localStorage:', e);
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

  // --- INVENTORY API ---
  public getInventory(): MedicineItem[] {
    return this.inventory.map(enrichMedicine);
  }

  public getMedicineById(id: string): MedicineItem | undefined {
    const med = this.inventory.find((m) => m.id === id);
    return med ? enrichMedicine(med) : undefined;
  }

  public addMedicine(medicine: Omit<MedicineItem, 'totalAvailableQuantity' | 'stockStatus'>): MedicineItem {
    const enriched = enrichMedicine({
      ...medicine,
      totalAvailableQuantity: 0,
      stockStatus: 'IN_STOCK',
    });
    this.inventory.unshift(enriched);
    this.saveState();
    return enriched;
  }

  public updateMedicine(id: string, updates: Partial<MedicineItem>): MedicineItem | null {
    const idx = this.inventory.findIndex((m) => m.id === id);
    if (idx === -1) return null;

    const merged = { ...this.inventory[idx], ...updates };
    const enriched = enrichMedicine(merged);
    this.inventory[idx] = enriched;
    this.saveState();
    return enriched;
  }

  public addBatch(medicineId: string, newBatch: MedicineBatch, actor: string = 'Authorized Pharmacist'): boolean {
    const med = this.inventory.find((m) => m.id === medicineId);
    if (!med) return false;

    // Check if batchNumber already exists
    const existing = med.batches.find((b) => b.batchNumber === newBatch.batchNumber);
    if (existing) {
      existing.quantity += newBatch.quantity;
    } else {
      med.batches.push(newBatch);
    }

    const movement: StockMovement = {
      id: `MOV-${Date.now()}`,
      medicineId: med.id,
      medicineName: med.name,
      batchNumber: newBatch.batchNumber,
      type: 'RESTOCK',
      quantity: newBatch.quantity,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      performedBy: actor,
      notes: `Restocked batch ${newBatch.batchNumber} (Expires: ${newBatch.expiryDate})`,
    };
    this.movements.unshift(movement);

    this.inventory = this.inventory.map((m) => (m.id === medicineId ? enrichMedicine(med) : m));
    this.saveState();
    return true;
  }

  public getStockMovements(): StockMovement[] {
    return this.movements;
  }

  // --- PRESCRIPTION & PHARMACY ORDERS API ---
  public getPrescriptions(patientId?: string): Prescription[] {
    if (patientId) {
      return this.prescriptions.filter((p) => p.patientId === patientId);
    }
    return this.prescriptions;
  }

  public getOrders(patientId?: string): PharmacyOrder[] {
    if (patientId) {
      return this.orders.filter((o) => o.patientId === patientId);
    }
    return this.orders;
  }

  public createPrescriptionAndOrder(
    prescriptionData: Omit<Prescription, 'id' | 'prescribedAt' | 'status' | 'associatedOrderId'>,
    actor: string = 'Dr. Marcus Vance, MD'
  ): { prescription: Prescription; order: PharmacyOrder } {
    const rxId = `RX-${prescriptionData.patientId}-${Date.now().toString().slice(-4)}`;
    const ordId = `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const med = this.getMedicineById(prescriptionData.medicineId);
    const unitPrice = med ? med.unitPrice : 5.0;
    const totalCost = unitPrice * prescriptionData.quantity;

    const newPrescription: Prescription = {
      ...prescriptionData,
      id: rxId,
      prescribedAt: `${new Date().toLocaleDateString()} ${nowTime}`,
      status: 'Active',
      associatedOrderId: ordId,
    };

    const newOrder: PharmacyOrder = {
      id: ordId,
      prescriptionId: rxId,
      patientId: prescriptionData.patientId,
      patientName: prescriptionData.patientName,
      room: prescriptionData.room,
      bedNumber: prescriptionData.bedNumber,
      medicineId: prescriptionData.medicineId,
      medicineName: prescriptionData.medicineName,
      strength: prescriptionData.strength,
      quantity: prescriptionData.quantity,
      priority: prescriptionData.urgency,
      orderedAt: nowTime,
      status: 'Pending',
      lastUpdated: nowTime,
      estimatedDeliveryTime: prescriptionData.urgency === 'STAT' ? 'ETA 15 mins' : 'ETA 45 mins',
      unitPrice,
      totalCost,
      billedToPatient: false,
      timeline: [
        { step: 'Pending', label: 'Prescription Order Placed', timestamp: nowTime, completed: true, actor },
        { step: 'Pharmacy Review', label: 'Pharmacist Clinical Verification', completed: false },
        { step: 'Preparing', label: 'Compounding & Dispensing', completed: false },
        { step: 'Ready', label: 'Packaged & Labeled', completed: false },
        { step: 'Out for Delivery', label: 'Dispatched to ICU Ward', completed: false },
        { step: 'Delivered', label: 'Received & Verified at Bedside', completed: false },
      ],
    };

    this.prescriptions.unshift(newPrescription);
    this.orders.unshift(newOrder);
    this.saveState();

    return { prescription: newPrescription, order: newOrder };
  }

  // Dispense & deduct from specific valid batch
  public dispenseOrder(
    orderId: string,
    batchNumber: string,
    pharmacistName: string = 'Pharm. Rajesh Rao'
  ): { success: boolean; message: string } {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };

    const med = this.inventory.find((m) => m.id === order.medicineId);
    if (!med) return { success: false, message: 'Medicine not found in inventory.' };

    const enrichedBatches = enrichBatches(med.batches);
    const batch = enrichedBatches.find((b) => b.batchNumber === batchNumber);

    if (!batch) return { success: false, message: `Batch ${batchNumber} not found.` };
    if (batch.isExpired) {
      return {
        success: false,
        message: `Safety Block: Batch ${batchNumber} expired on ${batch.expiryDate}. Expired batches cannot be dispensed!`,
      };
    }
    if (batch.quantity < order.quantity) {
      return {
        success: false,
        message: `Insufficient quantity in batch ${batchNumber}. Available: ${batch.quantity}, Required: ${order.quantity}.`,
      };
    }

    // Deduct stock from the batch
    batch.quantity -= order.quantity;
    med.batches = med.batches.map((b) => (b.batchNumber === batchNumber ? { ...b, quantity: batch.quantity } : b));
    this.inventory = this.inventory.map((m) => (m.id === med.id ? enrichMedicine(med) : m));

    // Log Stock Movement
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const movement: StockMovement = {
      id: `MOV-${Date.now()}`,
      medicineId: med.id,
      medicineName: med.name,
      batchNumber,
      type: 'DISPENSED',
      quantity: -order.quantity,
      timestamp: nowTime,
      performedBy: pharmacistName,
      patientId: order.patientId,
      orderId: order.id,
      notes: `Dispensed for ${order.patientName} (${order.room})`,
    };
    this.movements.unshift(movement);

    // Update Order
    order.allocatedBatchNumber = batchNumber;
    order.reviewedBy = pharmacistName;
    order.preparedBy = pharmacistName;
    this.updateOrderStatus(orderId, 'Ready', pharmacistName, `Dispensed from batch ${batchNumber}`);

    return { success: true, message: `Successfully dispensed ${order.quantity} units from batch ${batchNumber}.` };
  }

  // Update order delivery status
  public updateOrderStatus(
    orderId: string,
    newStatus: DeliveryStatus,
    actorName: string,
    note?: string
  ): PharmacyOrder | null {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return null;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    order.status = newStatus;
    order.lastUpdated = nowTime;

    // Update timeline step
    order.timeline = order.timeline.map((step) => {
      if (step.step === newStatus) {
        return { ...step, completed: true, timestamp: nowTime, actor: actorName, note };
      }
      return step;
    });

    if (newStatus === 'Pharmacy Review') order.reviewedBy = actorName;
    if (newStatus === 'Preparing') order.preparedBy = actorName;
    if (newStatus === 'Out for Delivery') {
      order.dispatchedBy = actorName;
      order.estimatedDeliveryTime = 'ETA 10-15 mins';
    }
    if (newStatus === 'Delivered') {
      order.deliveredBy = actorName;
      order.estimatedDeliveryTime = `Delivered at ${nowTime}`;

      // Automatically post to patient bill upon delivery (prevent duplicate billing)
      if (!order.billedToPatient) {
        this.addBillingItem({
          patientId: order.patientId,
          description: `${order.medicineName} (x${order.quantity}) - Batch ${order.allocatedBatchNumber || 'N/A'}`,
          category: 'Pharmacy',
          unitPrice: order.unitPrice,
          quantity: order.quantity,
          totalAmount: order.totalCost,
          orderId: order.id,
        });
        order.billedToPatient = true;
      }
    }

    this.saveState();
    return order;
  }

  // --- BILLING API ---
  public getBillingItems(patientId?: string): PatientBillingItem[] {
    if (patientId) {
      return this.billing.filter((b) => b.patientId === patientId);
    }
    return this.billing;
  }

  public addBillingItem(item: Omit<PatientBillingItem, 'id' | 'timestamp'>): PatientBillingItem {
    // Prevent duplicate billing for the same orderId
    if (item.orderId && this.billing.some((b) => b.orderId === item.orderId && !b.isCorrected)) {
      console.warn(`Billing item already exists for order ${item.orderId}. Skipping duplicate.`);
      return this.billing.find((b) => b.orderId === item.orderId)!;
    }

    const newItem: PatientBillingItem = {
      ...item,
      id: `BILL-${Date.now().toString().slice(-5)}`,
      timestamp: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    };
    this.billing.unshift(newItem);
    this.saveState();
    return newItem;
  }

  public correctBillingItem(
    itemId: string,
    correctionReason: string,
    correctedBy: string = 'Hospital Billing Admin'
  ): boolean {
    const item = this.billing.find((b) => b.id === itemId);
    if (!item) return false;

    item.isCorrected = true;
    item.correctionReason = correctionReason;
    item.correctedBy = correctedBy;
    this.saveState();
    return true;
  }
}

export const pharmacyStore = new PharmacyStore();
