import type { BloodRequest, BloodDonorRecord, BloodGroup } from '../types/icu';

const STORAGE_KEY_BLOOD = 'neurocare_blood_requests_v1';

// Initial synthetic demo donor database
export const SYNTHETIC_DEMO_DONORS: BloodDonorRecord[] = [
  {
    id: 'DNR-B01',
    name: 'Donor #D-101 (Rahul S.)',
    bloodGroup: 'O-',
    distanceKm: 3.2,
    neighborhood: 'Indiranagar (3.2 km)',
    consentStatus: 'On-Call ICU Donor',
    availabilityStatus: 'Available',
    lastDonationDate: '2026-06-12 (4 months ago)',
    lifetimeDonations: 8,
    isSyntheticDemo: true,
    notified: true,
    notificationTime: '10:30',
  },
  {
    id: 'DNR-B02',
    name: 'Donor #D-102 (Priya N.)',
    bloodGroup: 'O+',
    distanceKm: 4.8,
    neighborhood: 'Ulsoor Lake Road (4.8 km)',
    consentStatus: 'Active Registered Donor',
    availabilityStatus: 'Accepted',
    lastDonationDate: '2026-05-20 (5 months ago)',
    lifetimeDonations: 4,
    isSyntheticDemo: true,
    notified: true,
    notificationTime: '10:45',
  },
  {
    id: 'DNR-B03',
    name: 'Donor #D-103 (Vikram K.)',
    bloodGroup: 'B+',
    distanceKm: 7.5,
    neighborhood: 'Koramangala 4th Block (7.5 km)',
    consentStatus: 'Active Registered Donor',
    availabilityStatus: 'Available',
    lastDonationDate: '2026-07-01 (3 months ago)',
    lifetimeDonations: 6,
    isSyntheticDemo: true,
    notified: false,
  },
  {
    id: 'DNR-B04',
    name: 'Donor #D-104 (Sneha M.)',
    bloodGroup: 'A+',
    distanceKm: 9.1,
    neighborhood: 'Domlur Layout (9.1 km)',
    consentStatus: 'Active Registered Donor',
    availabilityStatus: 'Pending Response',
    lastDonationDate: '2026-04-10 (6 months ago)',
    lifetimeDonations: 3,
    isSyntheticDemo: true,
    notified: false,
  },
  {
    id: 'DNR-B05',
    name: 'Donor #D-105 (Arjun P.)',
    bloodGroup: 'AB+',
    distanceKm: 12.4,
    neighborhood: 'HSR Layout Sector 2 (12.4 km)',
    consentStatus: 'Rare Group Volunteer',
    availabilityStatus: 'Available',
    lastDonationDate: '2026-05-18 (5 months ago)',
    lifetimeDonations: 5,
    isSyntheticDemo: true,
    notified: false,
  },
  {
    id: 'DNR-B06',
    name: 'Donor #D-106 (Farhan A.)',
    bloodGroup: 'O-',
    distanceKm: 14.8,
    neighborhood: 'Whitefield Main Road (14.8 km)',
    consentStatus: 'On-Call ICU Donor',
    availabilityStatus: 'Pending Response',
    lastDonationDate: '2026-03-15 (7 months ago)',
    lifetimeDonations: 9,
    isSyntheticDemo: true,
    notified: false,
  },
  {
    id: 'DNR-B07',
    name: 'Donor #D-107 (Ananya D.)',
    bloodGroup: 'B-',
    distanceKm: 18.2,
    neighborhood: 'Electronic City Phase 1 (18.2 km)',
    consentStatus: 'Rare Group Volunteer',
    availabilityStatus: 'Available',
    lastDonationDate: '2026-06-05 (4 months ago)',
    lifetimeDonations: 2,
    isSyntheticDemo: true,
    notified: false,
  },
  {
    id: 'DNR-B08',
    name: 'Donor #D-108 (Devendra T.)',
    bloodGroup: 'AB-',
    distanceKm: 22.0,
    neighborhood: 'Hebbal Flyover Junction (22.0 km)',
    consentStatus: 'Rare Group Volunteer',
    availabilityStatus: 'Available',
    lastDonationDate: '2026-02-28 (8 months ago)',
    lifetimeDonations: 7,
    isSyntheticDemo: true,
    notified: false,
  },
];

// Initial demo blood requests
export const INITIAL_BLOOD_REQUESTS: BloodRequest[] = [
  {
    id: 'BLD-REQ-101',
    patientId: '132543',
    patientName: 'Elena Rostova',
    room: 'ICU Room 03',
    bloodGroup: 'O-',
    component: 'PRBC',
    quantityUnits: 2,
    urgency: 'CRITICAL_STAT',
    requiredByTime: 'Within 45 mins',
    createdAt: '2026-10-14 10:15',
    hospitalLocation: 'NeuroCare ICU Ward Unit A - Bed 03',
    requestStatus: 'Donors Notified',
    searchRadiusKm: 15,
    staffApproved: true,
    approvedBy: 'Dr. Marcus Vance, MD',
    matchedDonors: [SYNTHETIC_DEMO_DONORS[0], SYNTHETIC_DEMO_DONORS[5]],
    notes: 'Severe acute blood loss post-craniotomy. Universal donor O- PRBC emergency transfusion.',
  },
  {
    id: 'BLD-REQ-102',
    patientId: '132547',
    patientName: 'Devi Sharma',
    room: 'ICU Room 04',
    bloodGroup: 'B+',
    component: 'Platelets',
    quantityUnits: 4,
    urgency: 'URGENT',
    requiredByTime: 'Within 2 hours',
    createdAt: '2026-10-14 11:00',
    hospitalLocation: 'NeuroCare ICU Ward Unit A - Bed 04',
    requestStatus: 'Staff Approved',
    searchRadiusKm: 10,
    staffApproved: true,
    approvedBy: 'Dr. Marcus Vance, MD',
    matchedDonors: [SYNTHETIC_DEMO_DONORS[2]],
    notes: 'Thrombocytopenia alert: Platelets < 35,000/uL.',
  },
];

class BloodStore {
  private requests: BloodRequest[] = [];
  private donors: BloodDonorRecord[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const reqStr = localStorage.getItem(STORAGE_KEY_BLOOD);
      this.requests = reqStr ? JSON.parse(reqStr) : INITIAL_BLOOD_REQUESTS;
      this.donors = SYNTHETIC_DEMO_DONORS;
    } catch {
      this.requests = INITIAL_BLOOD_REQUESTS;
      this.donors = SYNTHETIC_DEMO_DONORS;
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_BLOOD, JSON.stringify(this.requests));
    } catch (e) {
      console.warn('Failed to save blood requests:', e);
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

  public getRequests(): BloodRequest[] {
    return this.requests;
  }

  // Find donors matching blood group and within radius
  public findDonors(bloodGroup: BloodGroup, maxRadiusKm: number = 15): BloodDonorRecord[] {
    return this.donors
      .filter((d) => {
        // Universal donor compatibility: O- can donate to anyone
        const isCompatible = d.bloodGroup === bloodGroup || d.bloodGroup === 'O-';
        const isWithinRadius = d.distanceKm <= maxRadiusKm;
        return isCompatible && isWithinRadius;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  public createBloodRequest(
    req: Omit<BloodRequest, 'id' | 'createdAt' | 'requestStatus' | 'staffApproved' | 'matchedDonors'>,
    requireApproval: boolean = true
  ): BloodRequest {
    const matched = this.findDonors(req.bloodGroup, req.searchRadiusKm);
    const newReq: BloodRequest = {
      ...req,
      id: `BLD-REQ-${Date.now().toString().slice(-4)}`,
      createdAt: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      requestStatus: requireApproval ? 'Searching Donors' : 'Staff Approved',
      staffApproved: !requireApproval,
      matchedDonors: matched,
    };

    this.requests.unshift(newReq);
    this.saveState();
    return newReq;
  }

  // Authorized clinician approves sending simulated alert to synthetic donors
  public approveAndNotifyDonors(requestId: string, approverName: string = 'Dr. Marcus Vance, MD'): boolean {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return false;

    req.staffApproved = true;
    req.approvedBy = approverName;
    req.requestStatus = 'Donors Notified';

    // Update matched donors status
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    req.matchedDonors = req.matchedDonors.map((d) => ({
      ...d,
      notified: true,
      notificationTime: nowTime,
      availabilityStatus: d.availabilityStatus === 'Pending Response' ? 'Accepted' : d.availabilityStatus,
    }));

    this.saveState();
    return true;
  }

  public updateSearchRadius(requestId: string, newRadius: 5 | 10 | 15 | 25): boolean {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return false;

    req.searchRadiusKm = newRadius;
    req.matchedDonors = this.findDonors(req.bloodGroup, newRadius);
    this.saveState();
    return true;
  }
}

export const bloodStore = new BloodStore();
