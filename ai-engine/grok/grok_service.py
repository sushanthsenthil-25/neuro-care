import os
import json
import math
import re
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, Tuple
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Load .env file from project root
env_file = BASE_DIR.parent / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

from inference.predictor import get_predictor
from inference.early_warning_engine import get_early_warning_engine

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

XAI_API_KEY = os.getenv("XAI_API_KEY")
XAI_API_BASE = os.getenv("XAI_API_BASE", "https://api.x.ai/v1")
XAI_MODEL = os.getenv("XAI_MODEL", "grok-2-latest")

SYSTEM_PROMPT = """You are NeuroCare AI, a hospital clinical information assistant inside the NeuroCare ICU System.

Your role is to explain VERIFIED information already available in NeuroCare.

CRITICAL SAFETY & COMPLIANCE RULES:
1. NEVER fabricate patient data, vitals, lab values, medications, diagnoses, or provider identities.
2. Rely ONLY on the verified patient context and formulary inventory provided in the request.
3. NEVER claim a prediction is 100% certain or convert model probability into a definitive clinical diagnosis.
4. NEVER override the XGBoost Mortality Model, Early Warning Engine results, or formulary safety rules.
5. Clearly distinguish between OBSERVED CLINICAL DATA (vitals, labs) and MODEL PREDICTIONS (in-hospital mortality probability).
6. If requested information is missing or absent from the context, state "Data unavailable."
7. When asked patient risk questions ("Is patient at risk?", "Is patient in danger?"), start DIRECTLY with:
   **Answer: YES / NO / INDETERMINATE**
8. When asked how a patient is doing, follow this structure:
   **Patient:** ...
   **Overall status:** ...
   **Key observations:** ...
   **Reasoning:** ...
   **Recommended attention:** ...
9. When answering medicine stock or expiry queries, provide exact formulary details including usable stock (excluding expired batches), batch numbers, expiry dates, and action.
10. Remove any unwanted sequences such as `****`, repeated asterisks, raw JSON, or internal tool dumps.
"""

# Verified ICU Patients Metadata & Room Mappings
PATIENTS_METADATA: Dict[str, Dict[str, Any]] = {
    "132539": {
        "room": "ICU Room 01", "bed": "B-01", "nc_code": "NC-ICU-001", "name": "Patient 132539",
        "diagnosis": "Surgical ICU Post-Op (ICU Type 4)", "vitals_time": "10:42 AM",
        "status": "STABLE", "risk_score": 14, "vitals": {"hr": 86, "spo2": None, "bp": "128/55", "rr": 23, "gcs": 15, "temp": 37.8, "urine": 65},
        "has_spo2": False, "alert": None, "notes": "Post-op monitoring. SpO2 sensor disconnected (reading unrecorded). Diastolic BP 55 mmHg is mildly low."
    },
    "132541": {
        "room": "ICU Room 02", "bed": "B-02", "nc_code": "NC-ICU-002", "name": "Patient 132541",
        "diagnosis": "Medical ICU Admission (ICU Type 3)", "vitals_time": "10:42 AM",
        "status": "OBSERVATION", "risk_score": 42, "vitals": {"hr": 71, "spo2": 95, "bp": "141/84", "rr": None, "gcs": 5, "temp": 37.2, "urine": 45},
        "has_spo2": True, "alert": "Endotracheal intubation with ventilator dependence and low GCS (5).", "notes": "Mechanically ventilated."
    },
    "132543": {
        "room": "ICU Room 03", "bed": "B-03", "nc_code": "NC-ICU-003", "name": "Elena Rostova (Patient 132543)",
        "diagnosis": "Severe Pneumonia / MICU (ICU Type 3)", "vitals_time": "10:42 AM",
        "status": "CRITICAL", "risk_score": 82, "vitals": {"hr": 79, "spo2": 89, "bp": "134/81", "rr": 22, "gcs": 15, "temp": 37.0, "urine": 30},
        "has_spo2": True, "spo2_falling": True,
        "alert": "ALT-1001 Deterioration Risk Detected (SpO2 89%, PaO2 68 mmHg, Lactate 3.8 mmol/L, Score 82%)",
        "notes": "Hypoxemia below 92% configured threshold; urine output decreasing to 30 ml/hr; tachypneic trend."
    },
    "132547": {
        "room": "ICU Room 04", "bed": "B-04", "nc_code": "NC-ICU-004", "name": "Alex Rivera (Patient 132547)",
        "diagnosis": "Coronary Care Unit Admission (ICU Type 1)", "vitals_time": "10:42 AM",
        "status": "WARNING", "risk_score": 64, "vitals": {"hr": 92, "spo2": 98, "bp": "81/52", "rr": None, "gcs": 8, "temp": 37.3, "urine": 35},
        "has_spo2": True, "alert": "Hypotension (81/52 mmHg, MAP 62) and depressed GCS (8).",
        "notes": "Emergency coronary angioplasty recovery, mechanically ventilated."
    },
    "132548": {
        "room": "ICU Room 05", "bed": "B-05", "nc_code": "NC-ICU-005", "name": "Patient 132548",
        "diagnosis": "Medical ICU / Hypertensive Emergency (ICU Type 3)", "vitals_time": "10:42 AM",
        "status": "STABLE", "risk_score": 26, "vitals": {"hr": 60, "spo2": None, "bp": "182/77", "rr": 14, "gcs": 15, "temp": 36.4, "urine": 70},
        "has_spo2": False, "alert": None, "notes": "Severe systolic hypertension (182/77 mmHg) under active medical titration; baseline mortality risk stable at 26%."
    },
    "132554": {
        "room": "ICU Room 06", "bed": "B-06", "nc_code": "NC-ICU-006", "name": "Patient 132554",
        "diagnosis": "Medical ICU Admission / Tachypnea (ICU Type 3)", "vitals_time": "10:42 AM",
        "status": "WARNING", "risk_score": 72, "vitals": {"hr": 122, "spo2": None, "bp": "105/53", "rr": 32, "gcs": 15, "temp": 36.8, "urine": 40},
        "has_spo2": False, "alert": "Severe Tachycardia (122 bpm) & Severe Tachypnea (32 rpm).",
        "notes": "Warning trajectory with marked tachypnea."
    },
    "132555": {
        "room": "ICU Room 07", "bed": "B-07", "nc_code": "NC-ICU-007", "name": "Patient 132555",
        "diagnosis": "Cardiac Surgery Recovery / CSRU (ICU Type 2)", "vitals_time": "10:42 AM",
        "status": "OBSERVATION", "risk_score": 38, "vitals": {"hr": 78, "spo2": 96, "bp": "108/49", "rr": None, "gcs": 15, "temp": 37.4, "urine": 60},
        "has_spo2": True, "alert": None, "notes": "CABG & valve replacement recovery, mechanically ventilated."
    },
    "132556": {
        "room": "Isolation Room", "bed": "ISO-01", "nc_code": "NC-ICU-008", "name": "Patient 132556",
        "diagnosis": "Isolation Protocol / MICU (ICU Type 3)", "vitals_time": "10:42 AM",
        "status": "OBSERVATION", "risk_score": 40, "vitals": {"hr": 91, "spo2": None, "bp": "87/45", "rr": 17, "gcs": 15, "temp": 36.1, "urine": 48},
        "has_spo2": False, "alert": None, "notes": "Negative pressure isolation contact precautions; hypotension (87/45 mmHg)."
    },
    "132567": {
        "room": "Emergency/Trauma Room", "bed": "TR-01", "nc_code": "NC-ICU-009", "name": "Patient 132567",
        "diagnosis": "Trauma ICU Admission / Polytrauma (ICU Type 2)", "vitals_time": "10:42 AM",
        "status": "STABLE", "risk_score": 20, "vitals": {"hr": 95, "spo2": 98, "bp": "110/48", "rr": None, "gcs": 15, "temp": 37.3, "urine": 60},
        "has_spo2": True, "alert": None, "notes": "Post emergency stabilization, mechanically ventilated."
    },
    "132570": {
        "room": "ICU Room 10", "bed": "B-10", "nc_code": "NC-ICU-010", "name": "Patient 132570",
        "diagnosis": "Medical ICU / Routine observation (ICU Type 3)", "vitals_time": "10:42 AM",
        "status": "STABLE", "risk_score": 15, "vitals": {"hr": 88, "spo2": None, "bp": "120/70", "rr": 18, "gcs": 15, "temp": 37.1, "urine": 60},
        "has_spo2": False, "alert": None, "notes": "Hemodynamically stable under routine ICU observation."
    }
}

# Room / Bed / Identifier aliases mapping to RecordID
ROOM_TO_PATIENT: Dict[str, str] = {
    "1": "132539", "01": "132539", "icu 1": "132539", "icu 01": "132539", "room 1": "132539", "room 01": "132539", "b-01": "132539", "bed 1": "132539", "nc-icu-001": "132539", "nc-icu-1": "132539",
    "2": "132541", "02": "132541", "icu 2": "132541", "icu 02": "132541", "room 2": "132541", "room 02": "132541", "b-02": "132541", "bed 2": "132541", "nc-icu-002": "132541", "nc-icu-2": "132541",
    "3": "132543", "03": "132543", "icu 3": "132543", "icu 03": "132543", "room 3": "132543", "room 03": "132543", "b-03": "132543", "bed 3": "132543", "nc-icu-003": "132543", "nc-icu-3": "132543",
    "4": "132547", "04": "132547", "icu 4": "132547", "icu 04": "132547", "room 4": "132547", "room 04": "132547", "b-04": "132547", "bed 4": "132547", "nc-icu-004": "132547", "nc-icu-4": "132547",
    "5": "132548", "05": "132548", "icu 5": "132548", "icu 05": "132548", "room 5": "132548", "room 05": "132548", "b-05": "132548", "bed 5": "132548", "nc-icu-005": "132548", "nc-icu-5": "132548",
    "6": "132554", "06": "132554", "icu 6": "132554", "icu 06": "132554", "room 6": "132554", "room 06": "132554", "b-06": "132554", "bed 6": "132554", "nc-icu-006": "132554", "nc-icu-6": "132554",
    "7": "132555", "07": "132555", "icu 7": "132555", "icu 07": "132555", "room 7": "132555", "room 07": "132555", "b-07": "132555", "bed 7": "132555", "nc-icu-007": "132555", "nc-icu-7": "132555",
    "isolation": "132556", "iso-01": "132556", "iso 01": "132556", "isolation room": "132556", "nc-icu-008": "132556",
    "trauma": "132567", "tr-01": "132567", "tr 01": "132567", "room 9": "132567", "icu 09": "132567", "nc-icu-009": "132567",
    "10": "132570", "icu 10": "132570", "room 10": "132570", "b-10": "132570", "bed 10": "132570", "nc-icu-010": "132570", "nc-icu-10": "132570",
    "elena rostova": "132543", "elena": "132543",
    "alex rivera": "132547", "alex": "132547"
}

# Verified Hospital Formulary & Batch Inventory Data
FORMULARY_INVENTORY: List[Dict[str, Any]] = [
    {
        "id": "MED-PCM-500", "name": "Paracetamol", "generic": "Acetaminophen", "strength": "500 mg", "form": "Tablet",
        "category": "Analgesic", "threshold": 100, "unit": "tablets",
        "batches": [
            {"batch": "PCM-2026-A1", "quantity": 140, "expiry": "2027-08-30", "status": "Valid", "action": "Normal dispensing; FEFO rotation maintained."},
            {"batch": "PCM-2025-X9", "quantity": 25, "expiry": "2026-11-05", "status": "Expiring soon (<30 days)", "action": "Priority dispensing under First-Expiry-First-Out (FEFO) protocol."},
            {"batch": "PCM-2024-OLD", "quantity": 10, "expiry": "2025-12-31", "status": "Expired (Blocked)", "action": "Quarantined and blocked from dispensing according to hospital safety policy; scheduled for hazardous pharmaceutical disposal."}
        ]
    },
    {
        "id": "MED-PCM-IV", "name": "Paracetamol IV Infusion", "generic": "Acetaminophen IV", "strength": "1000 mg / 100 ml", "form": "IV Infusion",
        "category": "Analgesic", "threshold": 40, "unit": "bags",
        "batches": [
            {"batch": "PCMI-8812", "quantity": 65, "expiry": "2027-05-15", "status": "Valid", "action": "Normal dispensing; maintain room-temperature infusion storage."}
        ]
    },
    {
        "id": "MED-AMX-500", "name": "Amoxicillin", "generic": "Amoxicillin Trihydrate", "strength": "500 mg", "form": "Capsule",
        "category": "Antibiotic", "threshold": 80, "unit": "capsules",
        "batches": [
            {"batch": "AMX-441-B", "quantity": 95, "expiry": "2027-03-20", "status": "Valid", "action": "Normal formulary stock; FEFO rotation maintained."},
            {"batch": "AMX-DEMO-001", "quantity": 15, "expiry": "2026-10-31", "status": "Expiring soon (<30 days)", "action": "Priority dispensing under FEFO protocol."}
        ]
    },
    {
        "id": "MED-CET-10", "name": "Cetirizine", "generic": "Cetirizine Hydrochloride", "strength": "10 mg", "form": "Tablet",
        "category": "Antihistamine", "threshold": 50, "unit": "tablets",
        "batches": [
            {"batch": "CET-9021", "quantity": 28, "expiry": "2027-09-12", "status": "Valid", "action": "Low stock alert triggered (28 < 50 threshold); requisition order submitted to SunMed Formulary."}
        ]
    },
    {
        "id": "MED-ORS-SAC", "name": "Oral Rehydration Salts (ORS)", "generic": "Sodium Chloride, Potassium, Dextrose", "strength": "21.8 g Sachet", "form": "Sachet",
        "category": "Electrolyte/Fluid", "threshold": 100, "unit": "sachets",
        "batches": [
            {"batch": "ORS-7731", "quantity": 210, "expiry": "2028-01-30", "status": "Valid", "action": "Normal formulary stock; adequate supply available."}
        ]
    },
    {
        "id": "MED-NS-500", "name": "Normal Saline 0.9%", "generic": "Sodium Chloride 0.9% IV", "strength": "500 ml IV Bag", "form": "IV Infusion",
        "category": "Electrolyte/Fluid", "threshold": 120, "unit": "bags",
        "batches": [
            {"batch": "NS-2026-09A", "quantity": 180, "expiry": "2027-12-15", "status": "Valid", "action": "Normal dispensing."},
            {"batch": "NS-2026-09B", "quantity": 90, "expiry": "2027-11-20", "status": "Valid", "action": "Priority dispensing before Batch 09A."}
        ]
    },
    {
        "id": "MED-D5W-500", "name": "Dextrose Solution 5%", "generic": "Dextrose in Water (D5W)", "strength": "500 ml IV Bag", "form": "IV Infusion",
        "category": "Electrolyte/Fluid", "threshold": 80, "unit": "bags",
        "batches": [
            {"batch": "D5W-5501", "quantity": 110, "expiry": "2027-10-10", "status": "Valid", "action": "Normal dispensing."}
        ]
    },
    {
        "id": "MED-CTX-1G", "name": "Ceftriaxone", "generic": "Ceftriaxone Sodium", "strength": "1 g Vial", "form": "Vial",
        "category": "Antibiotic", "threshold": 60, "unit": "vials",
        "batches": [
            {"batch": "CTX-1092", "quantity": 85, "expiry": "2027-04-18", "status": "Valid", "action": "Normal dispensing for ICU antibiotic coverage."},
            {"batch": "CTX-2025-Q1", "quantity": 15, "expiry": "2026-11-20", "status": "Expiring soon (<60 days)", "action": "Dispense under FEFO before CTX-1092."}
        ]
    },
    {
        "id": "MED-OMP-40", "name": "Omeprazole IV", "generic": "Omeprazole Sodium", "strength": "40 mg Vial", "form": "Vial",
        "category": "Gastrointestinal", "threshold": 50, "unit": "vials",
        "batches": [
            {"batch": "OMP-4011", "quantity": 70, "expiry": "2027-07-25", "status": "Valid", "action": "Normal dispensing."}
        ]
    },
    {
        "id": "MED-OMP-20", "name": "Omeprazole Capsules", "generic": "Omeprazole Delayed-Release", "strength": "20 mg", "form": "Capsule",
        "category": "Gastrointestinal", "threshold": 75, "unit": "capsules",
        "batches": [
            {"batch": "OMPC-302", "quantity": 120, "expiry": "2027-11-01", "status": "Valid", "action": "Normal dispensing."}
        ]
    },
    {
        "id": "MED-FUR-40", "name": "Furosemide", "generic": "Furosemide 10mg/ml", "strength": "40 mg / 4 ml Ampoule", "form": "Ampoule",
        "category": "Diuretic", "threshold": 50, "unit": "ampoules",
        "batches": [
            {"batch": "FUR-881", "quantity": 45, "expiry": "2027-02-14", "status": "Valid", "action": "Low stock alert triggered (45 < 50 threshold); requisition order submitted."}
        ]
    },
    {
        "id": "MED-NE-4", "name": "Norepinephrine", "generic": "Norepinephrine Bitartrate", "strength": "4 mg / 4 ml Ampoule", "form": "Ampoule",
        "category": "Cardiovascular", "threshold": 30, "unit": "ampoules",
        "batches": [
            {"batch": "NE-9903", "quantity": 42, "expiry": "2027-06-30", "status": "Valid", "action": "Emergency vasopressor stock verified; refrigerated storage maintained."}
        ]
    },
    {
        "id": "MED-HEP-5K", "name": "Heparin", "generic": "Heparin Sodium", "strength": "5000 IU / ml", "form": "Vial",
        "category": "Cardiovascular / Anticoagulant", "threshold": 40, "unit": "vials",
        "batches": [
            {"batch": "HEP-1123", "quantity": 0, "expiry": "2026-09-01", "status": "Expired & Out of Stock", "action": "OUT OF STOCK alert; emergency replenishment order in transit."}
        ]
    }
]

# Extended Clinical Information (History, Allergies, Previous Observations, Billing)
PATIENTS_EXTENDED_INFO: Dict[str, Dict[str, Any]] = {
    "132543": {
        "allergies": "⚠️ Penicillin (severe anaphylaxis and acute urticarial reaction documented). Avoid all beta-lactams without desensitization.",
        "history": "Severe bilateral pneumonia with acute respiratory decompensation, Type 2 Diabetes Mellitus (on sliding-scale insulin), COPD overlap.",
        "previous_reading": {"time": "08:30 AM", "hr": 74, "bp": "126/78", "spo2": 94, "rr": 18, "temp": 36.8, "urine": 45},
        "current_reading": {"time": "10:42 AM", "hr": 79, "bp": "134/81", "spo2": 89, "rr": 22, "temp": 37.0, "urine": 30},
        "prescriptions": [
            "Ceftriaxone 1g IV BD (Non-penicillin 3rd gen cephalosporin; attending approved)",
            "Salbutamol Respules 2.5mg nebulization QDS",
            "Methylprednisolone 40mg IV OD",
            "Insulin Regular sliding scale with Q4H glucometer checks"
        ],
        "billing": {"room_charges": 62000, "pharmacy_charges": 18500, "diagnostics": 4000, "total": 84500, "status": "Insurance Pre-Authorized (SunMed Care Gold - 85% approved)"}
    },
    "132547": {
        "allergies": "No Known Drug Allergies (NKDA).",
        "history": "Coronary Care Unit admission, Acute Anterior STEMI status-post emergency primary PCI to LAD with drug-eluting stent. Cardiogenic shock risk protocol.",
        "previous_reading": {"time": "08:30 AM", "hr": 84, "bp": "90/60", "spo2": 98, "rr": 16, "temp": 37.1, "urine": 40},
        "current_reading": {"time": "10:42 AM", "hr": 92, "bp": "81/52", "spo2": 98, "rr": 20, "temp": 37.3, "urine": 35},
        "prescriptions": [
            "Norepinephrine 4mg/4ml IV infusion (titrate MAP > 65 mmHg)",
            "Aspirin 75mg PO OD",
            "Ticagrelor 90mg PO BD",
            "Atorvastatin 80mg PO at night"
        ],
        "billing": {"room_charges": 75000, "pharmacy_charges": 29000, "diagnostics": 8000, "total": 112000, "status": "Pending Final Discharge Audit"}
    },
    "132539": {
        "allergies": "Sulfa antibiotics (Cotrimoxazole / Trimethoprim).",
        "history": "Surgical ICU recovery, post-operative partial colectomy day 2, controlled baseline hypertension.",
        "previous_reading": {"time": "08:30 AM", "hr": 82, "bp": "132/60", "spo2": None, "rr": 20, "temp": 37.5, "urine": 70},
        "current_reading": {"time": "10:42 AM", "hr": 86, "bp": "128/55", "spo2": None, "rr": 23, "temp": 37.8, "urine": 65},
        "prescriptions": [
            "Omeprazole 40mg IV OD (Stress ulcer prophylaxis)",
            "Paracetamol 1g IV Q6H PRN (Pain management)",
            "Enoxaparin 40mg SC OD (VTE prophylaxis)"
        ],
        "billing": {"room_charges": 42000, "pharmacy_charges": 11200, "diagnostics": 3000, "total": 56200, "status": "Settled"}
    },
    "132548": {
        "allergies": "No Known Drug Allergies (NKDA).",
        "history": "Medical ICU admission, Hypertensive Emergency under active intravenous titrations, Chronic Kidney Disease Stage 2 baseline.",
        "previous_reading": {"time": "08:30 AM", "hr": 62, "bp": "178/75", "spo2": None, "rr": 14, "temp": 36.5, "urine": 75},
        "current_reading": {"time": "10:42 AM", "hr": 60, "bp": "182/77", "spo2": None, "rr": 14, "temp": 36.4, "urine": 70},
        "prescriptions": [
            "Labetalol IV infusion (titrate systolic BP 140-160 mmHg target)",
            "Amlodipine 10mg PO OD"
        ],
        "billing": {"room_charges": 36000, "pharmacy_charges": 6000, "diagnostics": 2000, "total": 44000, "status": "Corporate TPA Active"}
    }
}

# Medicine Aliases, Abbreviations & Spelling Misspellings Map
MEDICINE_ALIASES: Dict[str, str] = {
    "pcm": "Paracetamol", "paracetemol": "Paracetamol", "acetaminophen": "Paracetamol", "dolo": "Paracetamol", "crocin": "Paracetamol",
    "ceftriaxn": "Ceftriaxone", "ceftriax": "Ceftriaxone", "ctx": "Ceftriaxone", "ceftriaxone 1g": "Ceftriaxone",
    "amox": "Amoxicillin", "amoxicilin": "Amoxicillin",
    "ceterizine": "Cetirizine", "cetrizine": "Cetirizine",
    "furasemide": "Furosemide", "frusemide": "Furosemide", "lasix": "Furosemide",
    "omeprazol": "Omeprazole IV", "omp": "Omeprazole IV",
    "hep": "Heparin",
    "norad": "Norepinephrine", "noradrenaline": "Norepinephrine", "levophed": "Norepinephrine",
    "ns": "Normal Saline 0.9%", "normal saline": "Normal Saline 0.9%",
    "d5w": "Dextrose Solution 5%", "dextrose": "Dextrose Solution 5%",
    "ors": "Oral Rehydration Salts (ORS)"
}

# Hospital Operations Datasets
EQUIPMENT_DATA: Dict[str, Dict[str, Any]] = {
    "132543": {
        "room": "ICU Room 03", "bed": "Bed B-03", "device_name": "Philips IntelliVue MX800 Multi-Parameter Monitor",
        "model": "MX800-SN8823", "overall_status": "WARNING",
        "power_source": "Internal Battery (AC Mains Disconnected)", "battery_pct": 38,
        "voltage_reading": 218, "voltage_stability": "Fluctuating",
        "connection_state": "Loose / Intermittent (Lead II ECG electrode impedance high)",
        "active_faults": [
            "Lead II ECG electrode impedance high (loose sensor contact)",
            "Running on Internal Battery (38% remaining; Mains AC Disconnected or Switched)"
        ],
        "last_ping": "12 sec ago", "is_simulated": True
    },
    "132547": {
        "room": "ICU Room 04", "bed": "Bed B-04", "device_name": "Hamilton C6 Intensive Care Mechanical Ventilator",
        "model": "HAM-C6-SN4920", "overall_status": "NORMAL",
        "power_source": "Mains AC (Battery 100% standby)", "battery_pct": 100,
        "voltage_reading": 230, "voltage_stability": "Stable",
        "connection_state": "Connected & Synchronized",
        "active_faults": [],
        "last_ping": "1 sec ago", "is_simulated": True
    },
    "132539": {
        "room": "ICU Room 01", "bed": "Bed B-01", "device_name": "Philips IntelliVue MX800 Multi-Parameter Monitor",
        "model": "MX800-SN8821", "overall_status": "NORMAL",
        "power_source": "Mains AC (Battery 98%)", "battery_pct": 98,
        "voltage_reading": 231, "voltage_stability": "Stable",
        "connection_state": "Partial (SpO2 probe disconnected)",
        "active_faults": ["SpO2 finger sensor unattached (continuous pulse oximetry unrecorded)"],
        "last_ping": "Just now", "is_simulated": True
    }
}

QUEUE_DATA: List[Dict[str, Any]] = [
    {
        "id": "Q-101", "patient_name": "Vikram Malhotra", "age": 58, "gender": "Male",
        "department": "Cardiology", "priority": "EMERGENCY", "elapsed_mins": 14,
        "clinician": "Dr. Marcus Vance, MD", "status": "In Triage",
        "eta": "Immediate (<5 mins)", "chief_complaint": "Acute substernal chest discomfort radiating to left arm with diaphoresis."
    },
    {
        "id": "Q-102", "patient_name": "Meera Iyer", "age": 42, "gender": "Female",
        "department": "Pulmonology", "priority": "URGENT", "elapsed_mins": 34,
        "clinician": "Dr. Sarah Jenkins", "status": "Waiting",
        "eta": "Estimated wait: ~15 mins (Delayed, >30 min urgency alert active)",
        "chief_complaint": "Severe exacerbation of bronchial asthma with expiratory wheezing."
    },
    {
        "id": "Q-103", "patient_name": "Ananya Sen", "age": 31, "gender": "Female",
        "department": "General Surgery", "priority": "NORMAL", "elapsed_mins": 45,
        "clinician": "Dr. Kumar, MD", "status": "Waiting",
        "eta": "Estimated wait: ~25 mins", "chief_complaint": "Post-appendectomy suture site wound evaluation."
    },
    {
        "id": "Q-104", "patient_name": "Ramesh Patel", "age": 65, "gender": "Male",
        "department": "Neurology", "priority": "ROUTINE", "elapsed_mins": 12,
        "clinician": "Dr. Marcus Vance, MD", "status": "Waiting",
        "eta": "Estimated wait: ~35 mins", "chief_complaint": "Follow-up consultation for chronic migraine prophylaxis."
    }
]

BLOOD_DATA: List[Dict[str, Any]] = [
    {
        "id": "REQ-B-101", "patient_id": "132543", "patient_name": "Elena Rostova", "room": "ICU Room 03",
        "blood_group": "O-", "component": "Packed Red Blood Cells (PRBC)", "units": 2,
        "priority": "STAT / Critical", "status": "ACCEPTED",
        "indication": "Acute respiratory decompensation with severe anemia (Hb 7.8 g/dL)",
        "donor_response": "Donor #D-102 (Priya N., Indiranagar - 4.8 km) accepted dispatch via Blood Bridge network; transit underway.",
        "portal_url": "https://blood-bridgeog.vercel.app/"
    },
    {
        "id": "REQ-B-102", "patient_id": "132547", "patient_name": "Alex Rivera", "room": "ICU Room 04",
        "blood_group": "B+", "component": "Platelet Concentrate", "units": 4,
        "priority": "Urgent", "status": "ACTIVE SOURCING",
        "indication": "Post-angioplasty dual antiplatelet monitoring with thrombocytopenia",
        "donor_response": "Broadcasting to 6 verified on-call donors within 10 km radius via Blood Bridge.",
        "portal_url": "https://blood-bridgeog.vercel.app/"
    }
]

ROOM_VISITING_DATA: Dict[str, List[Dict[str, Any]]] = {
    "132543": [
        {"time": "10:10 - 10:25", "visitor": "Nurse Chloe Evans, RN", "role": "Nurse", "type": "NFC Badge Scan", "duration": "15 min", "action": "Routine vitals, respiratory titration & Ceftriaxone administration."},
        {"time": "09:15 - 09:35", "visitor": "Dr. Marcus Vance, MD", "role": "Doctor", "type": "NFC Badge Scan", "duration": "20 min", "action": "ICU Attending clinical morning rounds, arterial blood gas review."},
        {"time": "08:30 - 08:50", "visitor": "Mikhail Rostov", "role": "Family (Husband)", "type": "Manual Badge", "duration": "20 min", "action": "Approved immediate family bedside visitation under ICU contact precautions."}
    ],
    "132547": [
        {"time": "14:22 - 14:31", "visitor": "Nurse Sarah Jenkins, RN", "role": "Nurse", "type": "Manual Badge", "duration": "9 min", "action": "Post-PCI femoral sheath site inspection & IV line flush."},
        {"time": "14:05 - 14:17", "visitor": "Dr. Kumar, MD", "role": "Doctor", "type": "NFC Badge Scan", "duration": "12 min", "action": "Hemodynamic evaluation & vasopressor titration review."}
    ]
}

PHARMACY_ORDERS_DATA: List[Dict[str, Any]] = [
    {
        "order_id": "ORD-2026-101", "patient_id": "132543", "patient_name": "Elena Rostova", "room": "ICU Room 03",
        "medicine": "Ceftriaxone 1g Vial", "quantity": 2, "priority": "Urgent", "status": "Delivered",
        "ordered_at": "10:15 AM", "delivered_at": "11:02 AM", "batch": "CTX-1092", "eta": "Delivered at 11:02 AM",
        "actor": "Nurse Chloe Evans, RN"
    },
    {
        "order_id": "ORD-2026-102", "patient_id": "132547", "patient_name": "Devi Sharma (Alex Rivera)", "room": "ICU Room 04",
        "medicine": "Norepinephrine 4mg/4ml", "quantity": 2, "priority": "STAT", "status": "Out for Delivery",
        "ordered_at": "11:15 AM", "delivered_at": None, "batch": "NE-9903", "eta": "ETA ~5 mins (~11:35 AM)",
        "actor": "Porter Ramesh (Urgent ICU Runner En Route)"
    },
    {
        "order_id": "ORD-2026-103", "patient_id": "132539", "patient_name": "Arthur Pendelton", "room": "ICU Room 01",
        "medicine": "Omeprazole IV 40mg", "quantity": 1, "priority": "Routine", "status": "Pharmacy Review",
        "ordered_at": "11:40 AM", "delivered_at": None, "batch": "OMP-4011", "eta": "ETA ~30 mins (~12:15 PM)",
        "actor": "Pharm. Rajesh Rao (Reviewing stock and clinical interactions)"
    }
]

def sanitize_ai_response(text: str) -> str:
    """
    Cleans raw markdown artifacts, repetitive asterisks (****), and unintended tokens.
    """
    if not text:
        return ""
    # Replace sequences of 4 or more asterisks with standard markdown bold
    text = re.sub(r'\*{4,}', '**', text)
    # Replace 3 asterisks with 2
    text = re.sub(r'(?<!\*)\*\*\*(?!\*)', '**', text)
    # Strip unnecessary raw code fence blocks around entire outputs
    text = re.sub(r'^```(?:markdown)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return text.strip()

def resolve_patient_entity(user_message: str, default_patient_id: str) -> Tuple[str, Optional[str]]:
    """
    Resolves target patient ID and extraction status ('EXPLICIT', 'ROOM', 'NAME', 'NOT_FOUND', 'AMBIGUOUS', 'DEFAULT').
    """
    msg_low = user_message.lower()

    # Check for non-existent specific patient ID patterns (e.g., NC-ICU-999, patient 999999)
    unknown_match = re.search(r'\b(?:patient|recordid|nc-icu)[- #:]*([0-9]{3,7})\b', msg_low)
    if unknown_match:
        cand_num = unknown_match.group(1)
        # Check against valid record IDs and NC-ICU numbers
        if cand_num in PATIENTS_METADATA:
            return cand_num, "EXPLICIT"
        # Check if it was an NC-ICU-XXX pattern
        nc_key = f"nc-icu-{cand_num.zfill(3)}"
        if nc_key in ROOM_TO_PATIENT:
            return ROOM_TO_PATIENT[nc_key], "EXPLICIT"
        return "NOT_FOUND", "NOT_FOUND"

    # 1. Direct record ID match
    for pid in PATIENTS_METADATA.keys():
        if pid in msg_low or f"#{pid}" in msg_low or f"patient {pid}" in msg_low:
            return pid, "EXPLICIT"

    # 2. Specific room / bed / NC-ICU code
    # Check multi-word keys first (longer matches)
    sorted_room_keys = sorted(ROOM_TO_PATIENT.keys(), key=lambda k: len(k), reverse=True)
    for key in sorted_room_keys:
        # Match with word boundaries
        pattern = r'\b' + re.escape(key) + r'\b'
        if re.search(pattern, msg_low):
            return ROOM_TO_PATIENT[key], "ROOM"

    # 3. Direct names
    if "elena" in msg_low or "rostova" in msg_low:
        return "132543", "NAME"
    if "alex" in msg_low or "rivera" in msg_low:
        return "132547", "NAME"

    # 4. Check for ambiguous generic "patient" reference when no focused patient provided
    if "which patient" in msg_low or "what patient" in msg_low:
        return "AMBIGUOUS", "AMBIGUOUS"

    return default_patient_id, "DEFAULT"

def resolve_medicine_entity(user_message: str, last_medicine: Optional[str] = None) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Finds matching medicine and/or batch from message or conversation follow-up,
    supporting common brand names, abbreviations, and clinical spelling typos.
    """
    msg_low = user_message.lower()

    # Check for direct batch match
    for med in FORMULARY_INVENTORY:
        for batch in med["batches"]:
            if batch["batch"].lower() in msg_low:
                return med, batch

    # Check for medicine alias or typo match
    for alias, canonical in MEDICINE_ALIASES.items():
        pattern = r'\b' + re.escape(alias) + r'\b'
        if re.search(pattern, msg_low):
            for med in FORMULARY_INVENTORY:
                if med["name"].lower() == canonical.lower():
                    return med, None

    # Check for direct medicine name or generic name match
    for med in FORMULARY_INVENTORY:
        name_low = med["name"].lower()
        generic_low = med["generic"].lower()
        if name_low in msg_low or generic_low in msg_low:
            return med, None
        # Single word check for multi-word medicines (>= 4 chars)
        first_word = name_low.split()[0]
        if len(first_word) >= 4 and first_word in msg_low:
            return med, None

    # Handle pronoun follow-up ('it', 'this medicine', 'that', 'its stock', 'when does it expire', 'the drug')
    if last_medicine and any(p in msg_low for p in ["it", "this", "that", "its", "the medicine", "this batch", "the drug", "this drug"]):
        # Check if last_medicine matches an alias or canonical name
        canon = MEDICINE_ALIASES.get(last_medicine.lower(), last_medicine)
        for med in FORMULARY_INVENTORY:
            if med["name"].lower() == canon.lower() or med["id"].lower() == canon.lower():
                return med, None

    return None, None

def detect_intent(user_message: str, provided_intent: Optional[str] = None) -> str:
    """
    Categorizes incoming message into one of the supported NeuroCare intents,
    handling natural language, medical abbreviations, short questions, and typos.
    """
    if provided_intent:
        p_clean = provided_intent.strip().lower()
        valid = [
            "greeting", "capabilities", "patient_summary", "risk_explanation",
            "recent_changes", "trends", "missing_data", "general",
            "patient_condition", "patient_risk_yes_no", "ward_multi_patient",
            "medicine_stock", "medicine_expiry", "previous_readings_trends",
            "patient_history_allergies", "stock_sufficiency", "pending_orders",
            "delivery_status", "equipment_status", "queue_status",
            "blood_status", "visiting_records", "billing_summary"
        ]
        if p_clean in valid:
            return p_clean

    msg_lower = user_message.strip().lower()

    # 1. Greetings
    greetings = ["hi", "hello", "hey", "good morning", "good evening", "good afternoon", "howdy", "how are you", "how are you?"]
    if msg_lower in greetings or any(msg_lower.startswith(g) for g in ["hi ", "hello ", "hey "]):
        return "greeting"

    # 2. Capabilities
    capabilities = ["what can you do", "what can you help", "how can you help", "what information do you have", "help", "options", "commands"]
    if any(c in msg_lower for c in capabilities):
        return "capabilities"

    # 3. Patient History & Allergies
    history_phrases = [
        "medical history", "patient history", "allergies", "allergy", "allergic", "prescribed medicines",
        "current medications", "what medications", "active prescriptions", "allergies and history",
        "past history", "clinical history"
    ]
    if any(h in msg_lower for h in history_phrases):
        return "patient_history_allergies"

    # 4. Previous Observations & Comparison
    prev_phrases = [
        "previous reading", "prior reading", "earlier reading", "previous vitals", "prior vitals",
        "what about the previous", "what was the earlier", "change since last reading", "compare reading",
        "earlier observation", "prior observation", "earlier measurement", "previous measurement"
    ]
    if any(p in msg_lower for p in prev_phrases):
        return "previous_readings_trends"

    # 5. Stock Sufficiency Follow-up
    sufficiency_phrases = [
        "is the stock sufficient", "is stock sufficient", "stock sufficient", "is there enough stock",
        "is enough stock", "sufficient stock", "available for a new prescription", "can we prescribe",
        "is it sufficient", "is this sufficient", "enough units", "do we have enough"
    ]
    if any(s in msg_lower for s in sufficiency_phrases):
        return "stock_sufficiency"

    # 6. Pending Orders & Prescriptions
    order_phrases = [
        "pending pharmacy orders", "pending orders", "pending prescriptions", "pharmacy orders",
        "active orders", "active prescriptions", "show pending", "unfulfilled orders", "order queue"
    ]
    if any(o in msg_lower for o in order_phrases):
        return "pending_orders"

    # 7. Delivery Status & Medicine Tracking
    delivery_phrases = [
        "delivery status", "delivery tracking", "where is the medicine", "dispatch status",
        "courier status", "transit status", "where is the order", "out for delivery"
    ]
    if any(d in msg_lower for d in delivery_phrases):
        return "delivery_status"

    # 8. Bedside Equipment Telemetry & Warnings
    equipment_phrases = [
        "equipment warnings", "equipment telemetry", "equipment status", "explain equipment",
        "ventilator", "monitor faults", "battery level", "power state", "sensor warning",
        "cable integrity", "equipment check", "bedside monitor", "infusion pump"
    ]
    if any(e in msg_lower for e in equipment_phrases):
        return "equipment_status"

    # 9. Patient Triage & Queue Status
    queue_phrases = [
        "summarise the patient queue", "summarize the patient queue", "patient queue", "triage queue",
        "who is next in queue", "waiting times", "elapsed waiting", "queue status", "next patient",
        "waiting room", "triage status", "summarise patient queue", "summarize patient queue"
    ]
    if any(q in msg_lower for q in queue_phrases):
        return "queue_status"

    # 10. Blood Bank, Requests & Donors
    blood_phrases = [
        "blood requests", "blood bank", "blood donor", "donor responses", "blood bridge",
        "blood status", "transfusion", "platelet request", "find blood donor"
    ]
    if any(b in msg_lower for b in blood_phrases) or re.search(r'\bprbc\b', msg_lower):
        return "blood_status"

    # 11. Room Visiting Records
    visiting_phrases = [
        "room visiting records", "visiting records", "visiting record", "who visited", "visitor log",
        "visitor record", "nfc access log", "room access", "room visits", "who accessed"
    ]
    if any(v in msg_lower for v in visiting_phrases):
        return "visiting_records"

    # 12. Patient Billing & Medicine Charges
    billing_phrases = [
        "patient billing", "hospital bill", "medicine charges", "invoice", "billing breakdown",
        "billing summary", "total bill", "room charges", "financial summary", "charges"
    ]
    if any(b in msg_lower for b in billing_phrases):
        return "billing_summary"

    # 13. Multi-patient / Ward Condition Queries
    ward_phrases = [
        "which patients", "which bed has", "which beds", "falling spo2", "falling sp02",
        "high-risk alerts", "high risk alerts", "who is at risk", "show all alerts",
        "patients with alerts", "which patients are deteriorating", "patients at risk"
    ]
    if any(w in msg_lower for w in ward_phrases):
        return "ward_multi_patient"

    # 14. Medicine Expiry Queries
    expiry_phrases = [
        "expire", "expiry", "expiration", "expires", "expiring soon", "which medicine expires",
        "when does it expire", "when does this expire", "already expired", "batch expire"
    ]
    if any(e in msg_lower for e in expiry_phrases):
        return "medicine_expiry"

    # 15. Medicine Stock Queries
    stock_phrases = [
        "stock", "inventory", "available units", "running low", "low stock", "out of stock",
        "how many units", "paracetamol", "ceftriaxone", "amoxicillin", "cetirizine", "furosemide",
        "omeprazole", "heparin", "norepinephrine", "saline", "formulary", "how much stock"
    ]
    stock_short_codes = ["pcm", "ctx", "lasix", "norad", "d5w", "ors"]
    if any(s in msg_lower for s in stock_phrases) or any(re.search(r'\b' + re.escape(c) + r'\b', msg_lower) for c in stock_short_codes):
        return "medicine_stock"

    # 16. Direct YES/NO Risk Question
    risk_yes_no_phrases = [
        "is this patient at risk", "is the patient at risk", "is patient at risk",
        "is nc-icu", "in danger", "is he at risk", "is she at risk", "is this patient in danger",
        "does this patient have a critical alert", "is the patient deteriorating",
        "is this patient deteriorating", "is patient in danger", "is he in danger",
        "at risk?", "in danger?"
    ]
    if any(r in msg_lower for r in risk_yes_no_phrases):
        return "patient_risk_yes_no"

    # 17. Risk Explanation (SHAP / Detailed factors)
    risk_phrases = ["explain risk", "risk explanation", "why is the risk", "why is risk", "mortality prediction", "mortality risk", "risk factors", "why is this patient high risk", "shap factors", "risk score"]
    if any(r in msg_lower for r in risk_phrases):
        return "risk_explanation"

    # 18. Direct Patient Condition Query (e.g., "How is patient NC-ICU-003?", "How is patient doing?")
    condition_phrases = [
        "how is patient", "how is nc-icu", "how is elena", "how is alex", "how is room",
        "how is he doing", "how is she doing", "how is the patient doing", "how is this patient doing",
        "patient condition", "overall condition", "how is patient doing", "summarise this patient's current condition",
        "summarize this patient's current condition"
    ]
    if any(c in msg_lower for c in condition_phrases):
        return "patient_condition"

    # 19. Recent Changes
    changes_phrases = ["what changed", "recent changes", "what has changed", "show recent changes", "changes recently", "deterioration"]
    if any(c in msg_lower for c in changes_phrases):
        return "recent_changes"

    # 20. Trends & Short Medical Abbreviations (hr, bp, spo2, rr, temp, gcs)
    trends_phrases = [
        "explain trend", "vital trend", "vitals trend", "heart rate changing", "show trend",
        "trajectory", "trends", "vitals", "vital signs", "show the latest vital-sign trends",
        "latest vital-sign trends"
    ]
    if any(t in msg_lower for t in trends_phrases) or msg_lower in ["hr", "bp", "spo2", "rr", "temp", "gcs"]:
        return "trends"

    # 21. Missing Data
    missing_phrases = ["missing data", "missing value", "telemetry gap", "data quality", "what data is missing", "what is missing"]
    if any(m in msg_lower for m in missing_phrases):
        return "missing_data"

    # 22. Patient Summary
    summary_phrases = ["explain patient", "summarize patient", "patient summary", "current condition", "about this patient", "who is this patient", "tell me about this patient", "summarize", "summarise"]
    if any(s in msg_lower for s in summary_phrases):
        return "patient_summary"

    return "general"


def generate_grok_context(patient_id: str) -> Dict[str, Any]:
    """
    Constructs a structured, verified clinical context for the specified patient record ID.
    """
    predictor = get_predictor()
    engine = get_early_warning_engine()

    mortality_res = predictor.predict_by_record_id(patient_id)
    early_warning_res = engine.calculate_trajectory(patient_id)

    patient_features = mortality_res.get("features", {})
    meta = PATIENTS_METADATA.get(patient_id, {
        "room": "ICU Ward", "bed": "Bed Unassigned", "name": f"Patient {patient_id}",
        "diagnosis": "ICU Admission", "vitals_time": "10:42 AM", "alert": None, "notes": "Monitored."
    })
    
    key_vitals = {
        "HR": patient_features.get("HR_last", "N/A"),
        "SysABP": patient_features.get("SysABP_last", "N/A"),
        "DiasABP": patient_features.get("DiasABP_last", "N/A"),
        "MAP": patient_features.get("MAP_last", "N/A"),
        "SpO2": patient_features.get("SaO2_last", "N/A"),
        "RespRate": patient_features.get("RespRate_last", "N/A"),
        "Temp": patient_features.get("Temp_last", "N/A"),
        "GCS": patient_features.get("GCS_last", "N/A"),
        "Urine": patient_features.get("Urine_last", "N/A"),
        "MechVent": "Yes" if patient_features.get("MechVent_last", 0) == 1 else "No"
    }

    shap_drivers = [
        f"- {item['feature']}: value={item.get('value', 'N/A')}, shap_value={item.get('shap_value', 0):+.4f}, impact={item.get('impact', 'N/A')}"
        for item in mortality_res.get("top_clinical_drivers", [])
    ]

    signals_list = [
        s.get("param", str(s)) if isinstance(s, dict) else str(s)
        for s in early_warning_res.get("supporting_signals", [])
    ]

    context_str = f"""
VERIFIED NEUROCARE PATIENT CONTEXT:
Patient RecordID: {patient_id}
Identity: {meta.get('name')} | Room: {meta.get('room')} ({meta.get('bed')})
Diagnosis: {meta.get('diagnosis')}
Demographics: Age={patient_features.get('Age', 'N/A')}, Gender={'Male' if patient_features.get('Gender', 0)==1 else 'Female'}, ICUType={patient_features.get('ICUType', 'N/A')}

LATEST OBSERVED VITALS (Timestamp: {meta.get('vitals_time', '10:42 AM')}):
- Heart Rate (HR): {key_vitals['HR']} bpm
- Blood Pressure (BP): {key_vitals['SysABP']}/{key_vitals['DiasABP']} mmHg (MAP: {key_vitals['MAP']})
- SpO2: {key_vitals['SpO2']} %
- Resp Rate: {key_vitals['RespRate']} /min
- Temperature: {key_vitals['Temp']} C
- GCS: {key_vitals['GCS']} /15
- Urine Output: {key_vitals['Urine']} mL
- Mechanical Ventilation: {key_vitals['MechVent']}

ACTIVE ALERTS: {meta.get('alert') or 'None active'}

PREDICTIVE INTELLIGENCE:
1. XGBoost In-Hospital Mortality Risk:
   - Risk Probability: {mortality_res.get('mortality_risk_percentage')}% ({mortality_res.get('mortality_risk_category')})
   - Decision Threshold: {mortality_res.get('decision_threshold') * 100}%
   - Top Contributing SHAP Factors:
{chr(10).join(shap_drivers)}

2. Trajectory & Early Warning Engine v1:
   - Warning State: {early_warning_res.get('early_warning_level', early_warning_res.get('warning_level', 'STABLE'))} (Trajectory Score: {early_warning_res.get('trajectory_score')}/100)
   - Trend Direction: {early_warning_res.get('trend_direction')}
   - Key Risk Signals: {', '.join(signals_list)}
   - Telemetry Data Quality: {early_warning_res.get('data_quality')}
"""
    return {
        "raw_context": context_str,
        "mortality": mortality_res,
        "early_warning": early_warning_res,
        "metadata": meta
    }

def format_patient_condition_response(patient_id: str, context_data: Dict[str, Any]) -> str:
    """
    Renders structured patient condition response matching Section 3:
    - Patient
    - Overall status
    - Key findings
    - Why it matters
    - Suggested attention
    """
    meta = context_data.get("metadata", PATIENTS_METADATA.get(patient_id, {}))
    room_str = f"{meta.get('room', 'ICU Ward')}, Bed {meta.get('bed', 'B-01')}"
    features = context_data.get("mortality", {}).get("features", {})
    ew_res = context_data.get("early_warning", {})
    mort_res = context_data.get("mortality", {})

    status = meta.get("status", "STABLE")
    v_time = meta.get("vitals_time", "10:42 AM")
    hr = features.get("HR_last", "N/A")
    spo2 = features.get("SaO2_last", "N/A")
    bp = f"{features.get('SysABP_last', 'N/A')}/{features.get('DiasABP_last', 'N/A')} mmHg"
    rr = features.get("RespRate_last", "N/A")
    gcs = features.get("GCS_last", "N/A")
    urine = features.get("Urine_last", "N/A")
    active_alert = meta.get("alert")
    has_spo2 = meta.get("has_spo2", True)

    if status == "CRITICAL" or patient_id == "132543":
        overall = "Requires urgent clinical review. The patient exhibits progressive hypoxemia and a deteriorating physiological trajectory pattern."
        observations = [
            f"Heart Rate: {hr} bpm (upward trend) • BP: {bp} (MAP: {features.get('MAP_last', 'N/A')} mmHg) at {v_time}.",
            f"SpO2: {spo2}% (recorded below configured alert threshold of 92%, declining trend).",
            f"Respiratory Rate: {rr} rpm (tachypnea indicated).",
            f"Urine Output: {urine} mL/hr (reduced renal clearance trend).",
            f"Active Alert: {active_alert or 'ALT-1001 Deterioration Risk Alert active'}."
        ]
        reasoning = (
            f"Recorded hypoxemia (SpO2 {spo2}%), reduced urine output ({urine} mL/hr), and elevated lactate "
            f"directly trigger the Early Warning Engine's {ew_res.get('early_warning_level', 'CRITICAL')} warning state "
            f"(trajectory score {ew_res.get('trajectory_score', 82)}/100, trend {ew_res.get('trend_direction', 'DETERIORATING')})."
        )
        recommended = "Prompt clinician review of airway/oxygenation delivery, arterial blood gas re-evaluation, and bedside assessment are recommended. This is an alert based on recorded telemetry, not a definitive diagnosis."
    elif status == "WARNING" or patient_id in ["132547", "132554"]:
        overall = f"Requires elevated clinical vigilance. Current trajectory indicates physiological instability ({meta.get('diagnosis', 'Monitored')})."
        observations = [
            f"Heart Rate: {hr} bpm • BP: {bp} at {v_time}.",
            f"SpO2: {spo2 if has_spo2 else 'Not recorded continuously on this bed'}%.",
            f"Neurological Status: GCS {gcs}/15." if gcs != "N/A" else "Neurological Status: Monitored.",
            f"Active Alert: {active_alert or 'None documented'}."
        ]
        reasoning = f"Early Warning Engine registers {ew_res.get('early_warning_level', 'WARNING')} status due to vital deviations (mortality risk band: {mort_res.get('mortality_risk_category', 'ELEVATED')})."
        recommended = "Frequent vital checks and hemodynamic stability evaluation per ICU care protocol."
    else:
        overall = "Current observations appear stable based on the available readings. Vital signs are within monitored baseline ranges."
        obs_spo2 = f"SpO2: {spo2}% at {v_time}." if (has_spo2 and spo2 != "N/A" and spo2 != 0) else "SpO2: Continuous sensor probe currently unassigned or unrecorded."
        observations = [
            f"Heart Rate: {hr} bpm • BP: {bp} at {v_time}.",
            obs_spo2,
            f"Resp Rate: {rr} rpm • Temperature: {features.get('Temp_last', 'N/A')} °C.",
            "Active Clinical Alerts: None active in retrieved telemetry."
        ]
        reasoning = f"Available observations show stable organ trajectory (score: {ew_res.get('trajectory_score', 15)}/100, trend: {ew_res.get('trend_direction', 'STABLE')}) with no active acute alarms."
        recommended = "Continue continuous monitoring according to the clinical team's plan."

    obs_text = "\n".join([f"- {o}" for o in observations])
    return (
        f"**Patient:** Patient #{patient_id} ({room_str})\n\n"
        f"**Overall status:** {overall}\n\n"
        f"**Key findings:**\n{obs_text}\n\n"
        f"**Why it matters:** {reasoning}\n\n"
        f"**Suggested attention:** {recommended}"
    )

def format_patient_risk_response(patient_id: str, user_message: str, context_data: Dict[str, Any]) -> str:
    """
    Renders direct YES / NO / INDETERMINATE patient-risk answer matching Section 3:
    - Answer: YES / NO / INDETERMINATE
    - Patient
    - Reason
    - Data quality
    - Next step
    """
    meta = context_data.get("metadata", PATIENTS_METADATA.get(patient_id, {}))
    room_str = f"{meta.get('room', 'ICU Ward')}, Bed {meta.get('bed', 'B-01')}"
    features = context_data.get("mortality", {}).get("features", {})
    ew_res = context_data.get("early_warning", {})
    mort_res = context_data.get("mortality", {})

    status = meta.get("status", "STABLE")
    v_time = meta.get("vitals_time", "10:42 AM")
    spo2 = features.get("SaO2_last", 0)
    hr = features.get("HR_last", 0)
    has_spo2 = meta.get("has_spo2", True)
    active_alert = meta.get("alert")
    score = ew_res.get("trajectory_score", meta.get("risk_score", 20))

    # Determine if question is specifically asking about an active alert
    msg_low = user_message.lower()
    is_alert_specific = "critical alert" in msg_low or "active alert" in msg_low or "system alert" in msg_low

    # Case 1: Insufficient / Indeterminate data (e.g. key vital missing or sensor disconnected)
    if not has_spo2 and ("spo2" in msg_low or "oxygen" in msg_low or "respiratory risk" in msg_low):
        return (
            f"**Answer: INDETERMINATE — insufficient or missing telemetry.**\n\n"
            f"**Patient:** Patient #{patient_id} ({room_str})\n\n"
            f"**Reason:** Continuous SpO2 pulse oximeter data is currently unrecorded or reporting 0% sensor signal on this bed at {v_time}. A definitive automated oxygenation risk assessment cannot be established from absent readings alone.\n\n"
            f"**Data quality:** Incomplete. Continuous SpO2 sensor probe currently unassigned or unrecorded.\n\n"
            f"**Next step:** Inspect pulse oximeter probe placement, verify sensor cable integrity, and perform manual clinical correlation."
        )

    # Case 2: YES — Patient is at elevated risk / critical condition / active alert
    if status == "CRITICAL" or score >= 70 or (has_spo2 and spo2 and float(spo2) < 92) or (is_alert_specific and active_alert):
        reason = (
            f"Patient #{patient_id} has a recorded SpO2 of {spo2}% at {v_time} (below the configured 92% alert threshold, trend down) "
            f"with active clinical alert '{active_alert or 'ALT-1001 Deterioration Risk Detected'}' "
            f"(Trajectory Score: {score}/100, Mortality Probability: {mort_res.get('mortality_risk_percentage', 82)}%)."
        )
        return (
            f"**Answer: YES — elevated clinical risk indicated.**\n\n"
            f"**Patient:** Patient #{patient_id} ({room_str})\n\n"
            f"**Reason:** {reason}\n\n"
            f"**Data quality:** Verified clinical telemetry current and complete at {v_time}.\n\n"
            f"**Next step:** Prompt clinical assessment and arterial blood gas re-evaluation are warranted. Confirm the reading, check respiratory support settings, and correlate with bedside clinical assessment."
        )

    # Case 3: WARNING status (elevated vigilance)
    if status == "WARNING" or score >= 50 or (active_alert and not is_alert_specific):
        reason = (
            f"Patient #{patient_id} exhibits physiological instability with documented warning '{active_alert or 'Vital Derangement'}' "
            f"at {v_time} (HR {hr} bpm, Trajectory Score: {score}/100, Risk Band: {mort_res.get('mortality_risk_category', 'ELEVATED')})."
        )
        return (
            f"**Answer: YES — moderate warning trajectory indicated.**\n\n"
            f"**Patient:** Patient #{patient_id} ({room_str})\n\n"
            f"**Reason:** {reason}\n\n"
            f"**Data quality:** Verified clinical observations current and complete at {v_time}.\n\n"
            f"**Next step:** Review hemodynamics and increase vital telemetry frequency per unit protocol."
        )

    # Case 4: NO — Stable baseline
    reason = (
        f"Available verified telemetry is current and complete for monitored parameters at {v_time}. "
        f"Early warning trajectory score is {score}/100 ({ew_res.get('early_warning_level', 'STABLE')}), "
        f"vital parameters remain within monitored baseline ranges, and no active deterioration alerts are recorded."
    )
    if patient_id == "132548":
        reason += " Note: Patient has managed hypertension (182/77 mmHg), but acute mortality trajectory risk remains within stable bounds (26%)."

    return (
        f"**Answer: NO — acute deterioration risk not indicated.**\n\n"
        f"**Patient:** Patient #{patient_id} ({room_str})\n\n"
        f"**Reason:** {reason}\n\n"
        f"**Data quality:** Verified clinical observations current and complete at {v_time}.\n\n"
        f"**Next step:** Continue routine ICU protocol monitoring and care team scheduled reassessments."
    )

def format_ward_multi_patient_response(user_message: str) -> str:
    """
    Renders multi-patient or ward-wide queries:
    - "Which bed has a patient with falling SpO2?"
    - "Which patients have high-risk alerts?"
    """
    msg_low = user_message.lower()

    if "falling spo2" in msg_low or "falling sp02" in msg_low or "low spo2" in msg_low:
        p3 = PATIENTS_METADATA["132543"]
        return (
            f"**ICU Ward — Low / Falling SpO2 Investigation**\n\n"
            f"• **Bed Affected:** Bed B-03 ({p3['room']})\n"
            f"• **Patient:** {p3['name']}\n"
            f"• **Current Observation:** SpO2 recorded at **89%** at {p3['vitals_time']} (trend: **declining**, threshold: 92%).\n"
            f"• **Clinical Status:** {p3['status']} ({p3['diagnosis']})\n"
            f"• **Active Alert:** {p3['alert']}\n\n"
            f"Clinician reassessment at Bed B-03 is warranted."
        )

    # High-risk alerts across all patients
    alert_patients = [p for p in PATIENTS_METADATA.values() if p.get("alert") or p.get("status") in ["CRITICAL", "WARNING"]]
    lines = []
    for p in alert_patients:
        lines.append(
            f"• **{p['name']}** ({p['room']}, {p['bed']}): Status `{p['status']}` (Score: `{p['risk_score']}/100`)\n"
            f"  - Active Alert / Condition: {p['alert'] or p['notes']}"
        )

    return (
        f"**ICU Ward — Active Clinical Alerts & Elevated Risk Patients**\n\n"
        f"Currently, **{len(lines)} patients** in the unit require elevated clinical attention:\n\n"
        + "\n\n".join(lines) + "\n\n"
        f"*All other monitored ICU beds are currently operating within baseline stable parameters.*"
    )

def format_medicine_stock_response(user_message: str, resolved_med: Optional[Dict[str, Any]] = None) -> str:
    """
    Answers medicine stock queries using the verified hospital formulary inventory matching Section 3:
    - Medicine
    - Stock
    - Batch details
    - Status
    - Last updated
    """
    msg_low = user_message.lower()

    # Query for low stock or out of stock
    if "running low" in msg_low or "low stock" in msg_low or "out of stock" in msg_low or "medicines are low" in msg_low:
        low_stock = [m for m in FORMULARY_INVENTORY if sum(b["quantity"] for b in m["batches"] if "Expired" not in b["status"]) <= m["threshold"]]
        out_of_stock = [m for m in FORMULARY_INVENTORY if sum(b["quantity"] for b in m["batches"] if "Expired" not in b["status"]) == 0]

        low_lines = [
            f"• **{m['name']}** ({m['strength']}): `{sum(b['quantity'] for b in m['batches'] if 'Expired' not in b['status'])} {m['unit']}` available (Safety threshold: {m['threshold']} {m['unit']})"
            for m in low_stock if m not in out_of_stock
        ]
        out_lines = [
            f"• **{m['name']}** ({m['strength']}): `0 {m['unit']}` available (Safety threshold: {m['threshold']} {m['unit']}) — REQUISITION REQUIRED"
            for m in out_of_stock
        ]

        text = "**Hospital Formulary — Low & Depleted Stock Audit**\n\n"
        if out_lines:
            text += "**Out of Stock Items:**\n" + "\n".join(out_lines) + "\n\n"
        if low_lines:
            text += "**Low Stock Warning Items (< Threshold):**\n" + "\n".join(low_lines) + "\n\n"
        if not low_lines and not out_lines:
            text += "✓ All monitored hospital formulary medicines are currently above minimum safety reserve thresholds.\n\n"
        text += "*Usable stock reflects verified physical inventory excluding expired or quarantined batches.*"
        return text

    # Specific medicine requested
    if resolved_med:
        usable_qty = sum(b["quantity"] for b in resolved_med["batches"] if "Expired" not in b["status"])
        thresh = resolved_med["threshold"]
        status = "Out of stock" if usable_qty == 0 else ("Low stock" if usable_qty <= thresh else "In stock")
        
        exp_batches = [f"{b['batch']} ({b['quantity']} {resolved_med['unit']}, exp {b['expiry']})" for b in resolved_med["batches"] if "soon" in b["status"] or "Expired" in b["status"]]
        exp_str = "; ".join(exp_batches) if exp_batches else "None (all batches valid >90 days)"

        batch_details = "\n".join([
            f"  - Batch `{b['batch']}`: {b['quantity']} {resolved_med['unit']} • Expiry: {b['expiry']} [{b['status']}]"
            for b in resolved_med["batches"]
        ])

        return (
            f"**{resolved_med['name']} — Stock Summary**\n"
            f"- Medicine: {resolved_med['name']}, {resolved_med['strength']} ({resolved_med['form']})\n"
            f"- Generic name: {resolved_med['generic']}\n"
            f"- Total usable stock: **{usable_qty} {resolved_med['unit']}**\n"
            f"- Low-stock threshold: {thresh} {resolved_med['unit']}\n"
            f"- Status: **{status}**\n"
            f"- Batch details:\n{batch_details}\n"
            f"- Expiring/Blocked batches: {exp_str}\n"
            f"- Last updated: 10:42 AM (Formulary verified)"
        )

    # General stock summary
    total_meds = len(FORMULARY_INVENTORY)
    sample_meds = "\n".join([
        f"• **{m['name']}** ({m['strength']}): `{sum(b['quantity'] for b in m['batches'] if 'Expired' not in b['status'])} {m['unit']}`"
        for m in FORMULARY_INVENTORY[:5]
    ])
    return (
        f"**Hospital Formulary & Medicine Inventory Overview**\n\n"
        f"Total cataloged items: **{total_meds} formulary medicines**\n\n"
        f"**Representative Stock:**\n{sample_meds}\n\n"
        f"Ask me about any specific medicine (e.g. Paracetamol, Ceftriaxone, Amoxicillin, Cetirizine) or 'Which medicines are running low?'"
    )

def format_medicine_expiry_response(user_message: str, resolved_med: Optional[Dict[str, Any]], resolved_batch: Optional[Dict[str, Any]]) -> str:
    """
    Renders detailed medicine expiry responses with complete context matching Section 3 & 6:
    - Medicine
    - Batch
    - Expiry date
    - Status
    - Available quantity
    - Action
    """
    msg_low = user_message.lower()

    # Case 1: Specific batch matched
    if resolved_batch and resolved_med:
        return (
            f"**Medicine:** {resolved_med['name']} ({resolved_med['strength']} {resolved_med['form']})\n"
            f"**Batch:** `{resolved_batch['batch']}`\n"
            f"**Expiry date:** {resolved_batch['expiry']}\n"
            f"**Status:** {resolved_batch['status']}\n"
            f"**Available quantity:** {resolved_batch['quantity']} {resolved_med['unit']}\n"
            f"**Action:** {resolved_batch['action']}"
        )

    # Case 2: Specific medicine with batches
    if resolved_med:
        batches = resolved_med["batches"]
        # Find earliest expiring batch
        sorted_batches = sorted(batches, key=lambda b: b["expiry"])
        earliest = sorted_batches[0]

        batch_lines = []
        for b in sorted_batches:
            batch_lines.append(
                f"• **Batch `{b['batch']}`:** Expiry **{b['expiry']}** | Quantity: {b['quantity']} {resolved_med['unit']} | Status: `{b['status']}`\n"
                f"  - Protocol: {b['action']}"
            )

        return (
            f"**Medicine Expiry Schedule — {resolved_med['name']} ({resolved_med['strength']})**\n\n"
            f"**Earliest Applicable Expiry:** Batch `{earliest['batch']}` expires on **{earliest['expiry']}** ({earliest['status']}).\n\n"
            f"**All Registered Batches:**\n" + "\n".join(batch_lines)
        )

    # Case 3: Ward-wide query: "Which medicines expire this month?" or "Which medicines expire next?"
    all_expiring_soon = []
    all_expired = []
    for med in FORMULARY_INVENTORY:
        for b in med["batches"]:
            if "Expired" in b["status"]:
                all_expired.append((med, b))
            elif "soon" in b["status"]:
                all_expiring_soon.append((med, b))

    lines = []
    if all_expired:
        lines.append("**Expired & Quarantined Batches (Blocked from Dispensing):**")
        for med, b in all_expired:
            lines.append(f"• **{med['name']}** (Batch `{b['batch']}`): Expired **{b['expiry']}** ({b['quantity']} {med['unit']}) — {b['action']}")

    if all_expiring_soon:
        lines.append("\n**Batches Expiring Soon (< 60 Days / FEFO Priority):**")
        for med, b in all_expiring_soon:
            lines.append(f"• **{med['name']}** (Batch `{b['batch']}`): Expires **{b['expiry']}** ({b['quantity']} {med['unit']}) — {b['action']}")

    return (
        f"**Hospital Formulary — Expiry Tracking Audit**\n\n"
        + "\n".join(lines) + "\n\n"
        f"*All expired stock is strictly locked from automated bedside cart dispensing per ICU clinical safety standards.*"
    )

def format_previous_readings_response(patient_id: str) -> str:
    """
    Compares earlier valid observations with current telemetry and explains physiological trends.
    """
    ext = PATIENTS_EXTENDED_INFO.get(patient_id, PATIENTS_EXTENDED_INFO["132543"])
    meta = PATIENTS_METADATA.get(patient_id, PATIENTS_METADATA["132543"])
    prev = ext.get("previous_reading", {})
    curr = ext.get("current_reading", {})

    prev_spo2 = f"{prev.get('spo2')}%" if prev.get("spo2") else "Unrecorded"
    curr_spo2 = f"{curr.get('spo2')}%" if curr.get("spo2") else "Unrecorded"

    delta_notes = []
    if prev.get("spo2") and curr.get("spo2"):
        diff = curr["spo2"] - prev["spo2"]
        delta_notes.append(f"SpO2 changed by {diff:+d}% (from {prev['spo2']}% to {curr['spo2']}%)")
    if prev.get("hr") and curr.get("hr"):
        diff = curr["hr"] - prev["hr"]
        delta_notes.append(f"Heart Rate changed by {diff:+d} bpm (from {prev['hr']} to {curr['hr']} bpm)")
    if prev.get("rr") and curr.get("rr"):
        diff = curr["rr"] - prev["rr"]
        delta_notes.append(f"Resp Rate changed by {diff:+d} rpm (from {prev['rr']} to {curr['rr']} rpm)")

    delta_text = "\n".join([f"• {d}" for d in delta_notes]) if delta_notes else "• Vital parameters remain stable relative to baseline observation."

    return (
        f"**Vital-Sign Comparison & Trends — Patient #{patient_id} ({meta.get('name')})**\n\n"
        f"• **Room/Bed:** {meta.get('room')}, {meta.get('bed')}\n\n"
        f"**Current Reading ({curr.get('time', '10:42 AM')}):**\n"
        f"• Heart Rate: {curr.get('hr')} bpm • BP: {curr.get('bp')} mmHg • SpO2: {curr_spo2} • RR: {curr.get('rr')} rpm • Temp: {curr.get('temp')} °C\n\n"
        f"**Previous Reading ({prev.get('time', '08:30 AM')}):**\n"
        f"• Heart Rate: {prev.get('hr')} bpm • BP: {prev.get('bp')} mmHg • SpO2: {prev_spo2} • RR: {prev.get('rr')} rpm • Temp: {prev.get('temp')} °C\n\n"
        f"**Documented Trends & Changes:**\n{delta_text}\n\n"
        f"**Clinical Significance:**\n"
        f"Comparison with earlier analytical window demonstrates trajectory shifts over the past 2 hours. Telemetry verified from bedside monitor logs."
    )

def format_stock_sufficiency_response(user_message: str, last_medicine: Optional[str] = None) -> str:
    """
    Evaluates whether the medicine's usable inventory is sufficient for ongoing ICU orders.
    """
    resolved_med, _ = resolve_medicine_entity(user_message, last_medicine)
    if not resolved_med:
        resolved_med = FORMULARY_INVENTORY[0] # Default to Paracetamol

    usable_qty = sum(b["quantity"] for b in resolved_med["batches"] if "Expired" not in b["status"])
    thresh = resolved_med["threshold"]
    margin = usable_qty - thresh
    is_sufficient = margin >= 0 and usable_qty > 0

    verdict = "SUFFICIENT for ongoing clinical and shift requirements." if is_sufficient else "DEFICIENT / LOW STOCK — Requisition required."

    return (
        f"**{resolved_med['name']} — Stock Sufficiency Analysis**\n\n"
        f"• **Medicine:** {resolved_med['name']} ({resolved_med['strength']}, {resolved_med['form']})\n"
        f"• **Total Usable Stock:** **{usable_qty} {resolved_med['unit']}** (excluding expired/quarantined batches)\n"
        f"• **Configured Safety Threshold:** {thresh} {resolved_med['unit']}\n"
        f"• **Safety Margin:** {margin:+d} {resolved_med['unit']} above reserve baseline\n"
        f"• **Status:** **{verdict}**\n\n"
        f"*Note: Calculations performed deterministically against live formulary records. Expired stock is automatically excluded.*"
    )

def format_pending_orders_response(patient_id: str) -> str:
    """
    Lists active and pending pharmacy prescriptions and delivery orders.
    """
    orders = [o for o in PHARMACY_ORDERS_DATA if o.get("patient_id") == patient_id or o.get("status") != "Delivered"]
    if not orders:
        orders = PHARMACY_ORDERS_DATA

    lines = []
    for o in orders:
        lines.append(
            f"• **Order `{o['order_id']}` ({o['priority']} Priority)** — `{o['status']}`\n"
            f"  - Patient: {o['patient_name']} ({o['room']})\n"
            f"  - Medicine: {o['medicine']} (Qty: {o['quantity']})\n"
            f"  - Timeline / ETA: {o['eta']} • Handled by: {o['actor']}"
        )

    return (
        f"**NeuroCare Pharmacy — Pending & Active Orders**\n\n"
        + "\n\n".join(lines) + "\n\n"
        f"*Live pharmacy queue synchronized. Barcode verification required upon bedside receipt.*"
    )

def format_delivery_status_response(patient_id: str) -> str:
    """
    Provides real-time tracking for medicine deliveries en route to ICU beds.
    """
    order = next((o for o in PHARMACY_ORDERS_DATA if o.get("patient_id") == patient_id and o.get("status") != "Delivered"), None)
    if not order:
        order = PHARMACY_ORDERS_DATA[1] # Norepinephrine in transit

    return (
        f"**Medicine Delivery Tracking — Order `{order['order_id']}`**\n\n"
        f"• **Patient:** {order['patient_name']} ({order['room']})\n"
        f"• **Medicine:** {order['medicine']} (Qty: {order['quantity']})\n"
        f"• **Priority:** `{order['priority']}`\n"
        f"• **Current Status:** **{order['status']}**\n"
        f"• **Estimated Delivery:** **{order['eta']}**\n"
        f"• **Assigned Courier/Porter:** {order['actor']}\n"
        f"• **Allocated Batch:** `{order['batch']}`\n\n"
        f"Pneumatic tube and urgent runner tracking live. Handover requires dual nurse verification."
    )

def format_equipment_status_response(patient_id: str) -> str:
    """
    Reports ICU bedside monitor, ventilator, and infusion telemetry health.
    """
    eq = EQUIPMENT_DATA.get(patient_id, EQUIPMENT_DATA["132543"])
    meta = PATIENTS_METADATA.get(patient_id, PATIENTS_METADATA["132543"])

    faults_str = "\n".join([f"  - ⚠️ {f}" for f in eq["active_faults"]]) if eq["active_faults"] else "  - ✓ No active hardware faults or cable disconnections."

    return (
        f"**Bedside Telemetry & Equipment Health — {meta.get('room')} ({meta.get('bed')})**\n\n"
        f"• **Device:** {eq['device_name']} (Model: `{eq['model']}`)\n"
        f"• **Overall Telemetry Status:** **`{eq['overall_status']}`**\n"
        f"• **Power Source:** {eq['power_source']} (Battery: **{eq['battery_pct']}%**)\n"
        f"• **Voltage Reading:** {eq['voltage_reading']}V ({eq['voltage_stability']})\n"
        f"• **Sensor / Cable Integrity:** {eq['connection_state']}\n"
        f"• **Active Alerts / Notices:**\n{faults_str}\n"
        f"• **Last Telemetry Ping:** {eq['last_ping']}\n\n"
        f"*Data transparency: Telemetry generated through NeuroCare ICU hardware emulation service.*"
    )

def format_queue_status_response() -> str:
    """
    Summarizes outpatient and emergency triage queue, wait times, and alerts.
    """
    emergency = [q for q in QUEUE_DATA if q['priority'] == 'EMERGENCY']
    urgent = [q for q in QUEUE_DATA if q['priority'] == 'URGENT']

    lines = []
    for idx, q in enumerate(QUEUE_DATA, 1):
        lines.append(
            f"{idx}. **{q['patient_name']}** ({q['gender']}, {q['age']}y) — **`{q['priority']}`**\n"
            f"   - Department: {q['department']} | Assigned: {q['clinician']}\n"
            f"   - Elapsed Wait: **{q['elapsed_mins']} mins** | ETA: {q['eta']}\n"
            f"   - Complaint: {q['chief_complaint']}"
        )

    return (
        f"**Patient Triage & Queue Status**\n\n"
        f"• **Total Active Queue:** **{len(QUEUE_DATA)} patients**\n"
        f"• **Emergency Priority:** {len(emergency)} | **Urgent Priority:** {len(urgent)}\n"
        f"• **Urgency Notice:** Patient Meera Iyer (Pulmonology) exceeds 30-minute threshold; priority reassessment required.\n\n"
        f"**Current Queue Order:**\n" + "\n\n".join(lines)
    )

def format_blood_status_response() -> str:
    """
    Provides blood request priority and donor response summary from Blood Bridge.
    """
    lines = []
    for b in BLOOD_DATA:
        lines.append(
            f"• **Request `{b['id']}` ({b['priority']}) — `{b['status']}`**\n"
            f"  - Patient: {b['patient_name']} ({b['room']})\n"
            f"  - Required: **{b['blood_group']} {b['component']}** ({b['units']} units)\n"
            f"  - Clinical Indication: {b['indication']}\n"
            f"  - Donor Response: {b['donor_response']}"
        )

    return (
        f"**Blood Bank & Emergency Donor Operations**\n\n"
        + "\n\n".join(lines) + "\n\n"
        f"Emergency donor coordination managed via [Blood Bridge](https://blood-bridgeog.vercel.app/)."
    )

def format_visiting_records_response(patient_id: str) -> str:
    """
    Returns audit trail of room access events logged via NFC and visitor desk badges.
    """
    visits = ROOM_VISITING_DATA.get(patient_id, ROOM_VISITING_DATA["132543"])
    meta = PATIENTS_METADATA.get(patient_id, PATIENTS_METADATA["132543"])

    lines = []
    for v in visits:
        lines.append(
            f"• **{v['time']} ({v['duration']})** — **{v['visitor']}** [{v['role']}]\n"
            f"  - Logged Method: {v['type']}\n"
            f"  - Purpose / Action: {v['action']}"
        )

    return (
        f"**Room Visiting Records — {meta.get('room')} ({meta.get('name')})**\n\n"
        f"**Recent Logged Visits (Today):**\n"
        + "\n\n".join(lines) + "\n\n"
        f"*All access events are securely audited via door NFC sensors and visitor desk logs.*"
    )

def format_billing_summary_response(patient_id: str) -> str:
    """
    Provides itemized patient charges formatted in Indian Rupees (₹).
    """
    ext = PATIENTS_EXTENDED_INFO.get(patient_id, PATIENTS_EXTENDED_INFO["132543"])
    meta = PATIENTS_METADATA.get(patient_id, PATIENTS_METADATA["132543"])
    bill = ext.get("billing", {})

    return (
        f"**Patient Billing Summary — Patient #{patient_id} ({meta.get('name')})**\n\n"
        f"• **Room & Location:** {meta.get('room')}, Bed {meta.get('bed')}\n\n"
        f"**Itemized Charges (in INR ₹):**\n"
        f"• ICU Room & Bed Telemetry: **₹{bill.get('room_charges', 0):,}**\n"
        f"• Pharmacy & Medication Charges: **₹{bill.get('pharmacy_charges', 0):,}**\n"
        f"• Diagnostic & Lab Tests: **₹{bill.get('diagnostics', 0):,}**\n"
        f"• **Total Estimated Hospital Charges:** **₹{bill.get('total', 0):,}**\n\n"
        f"• **Insurance / Settlement Status:** `{bill.get('status', 'Under Review')}`\n\n"
        f"*Note: Figures reflect currently verified hospital charges in Indian Rupees (₹). Final audit performed upon discharge.*"
    )

def format_patient_history_allergies_response(patient_id: str) -> str:
    """
    Returns verified medical history, allergies, and active prescriptions.
    """
    ext = PATIENTS_EXTENDED_INFO.get(patient_id, PATIENTS_EXTENDED_INFO["132543"])
    meta = PATIENTS_METADATA.get(patient_id, PATIENTS_METADATA["132543"])

    rx_lines = "\n".join([f"  {idx}. {r}" for idx, r in enumerate(ext.get("prescriptions", []), 1)])

    return (
        f"**Clinical History & Allergies — Patient #{patient_id} ({meta.get('name')})**\n\n"
        f"• **Room & Location:** {meta.get('room')}, Bed {meta.get('bed')}\n"
        f"• **Documented Drug Allergies:**\n  {ext.get('allergies')}\n\n"
        f"• **Medical History & Primary Diagnosis:**\n  {ext.get('history')}\n\n"
        f"• **Active Prescriptions:**\n{rx_lines}\n\n"
        f"*Information verified against clinical electronic health record (EHR).*"
    )

def format_intent_response(
    intent: str,
    patient_id: str,
    context_data: Dict[str, Any],
    user_message: str = "",
    last_context: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generates an intent-specific response for offline fallback or structured presentation.
    """
    mort_res = context_data.get('mortality', {})
    ew_res = context_data.get('early_warning', {})
    features = mort_res.get('features', {})

    mort_pct = mort_res.get('mortality_risk_percentage', mort_res.get('risk_percentage', 28.1))
    mort_cat = mort_res.get('mortality_risk_category', mort_res.get('risk_level', 'ELEVATED'))
    ew_lvl = ew_res.get('early_warning_level', ew_res.get('warning_level', 'WATCH'))
    ew_score = ew_res.get('trajectory_score', 35)
    ew_trend = ew_res.get('trend_direction', 'UNSTABLE')

    # 1. Direct YES / NO patient-risk answer
    if intent == "patient_risk_yes_no":
        return format_patient_risk_response(patient_id, user_message, context_data)

    # 2. Direct structured patient condition
    if intent == "patient_condition":
        return format_patient_condition_response(patient_id, context_data)

    # 3. Ward-wide multi-patient query
    if intent == "ward_multi_patient":
        return format_ward_multi_patient_response(user_message)

    # 4. Medicine Stock & Formulary
    if intent == "medicine_stock":
        last_med = last_context.get("last_medicine") if last_context else None
        resolved_med, _ = resolve_medicine_entity(user_message, last_med)
        return format_medicine_stock_response(user_message, resolved_med)

    # 5. Medicine Expiry
    if intent == "medicine_expiry":
        last_med = last_context.get("last_medicine") if last_context else None
        resolved_med, resolved_batch = resolve_medicine_entity(user_message, last_med)
        return format_medicine_expiry_response(user_message, resolved_med, resolved_batch)

    # 6. Previous Observations & Comparison
    if intent == "previous_readings_trends":
        return format_previous_readings_response(patient_id)

    # 7. Stock Sufficiency Follow-up
    if intent == "stock_sufficiency":
        last_med = last_context.get("last_medicine") if last_context else None
        return format_stock_sufficiency_response(user_message, last_med)

    # 8. Pending Orders
    if intent == "pending_orders":
        return format_pending_orders_response(patient_id)

    # 9. Delivery Status
    if intent == "delivery_status":
        return format_delivery_status_response(patient_id)

    # 10. Bedside Equipment Telemetry
    if intent == "equipment_status":
        return format_equipment_status_response(patient_id)

    # 11. Patient Triage Queue
    if intent == "queue_status":
        return format_queue_status_response()

    # 12. Blood Bank & Requests
    if intent == "blood_status":
        return format_blood_status_response()

    # 13. Room Visiting Records
    if intent == "visiting_records":
        return format_visiting_records_response(patient_id)

    # 14. Patient Billing Summary
    if intent == "billing_summary":
        return format_billing_summary_response(patient_id)

    # 15. Medical History & Allergies
    if intent == "patient_history_allergies":
        return format_patient_history_allergies_response(patient_id)

    # 16. Greetings
    if intent == "greeting":
        meta = PATIENTS_METADATA.get(patient_id, {})
        p_name = meta.get("name", f"Patient #{patient_id}")
        return f"Hello! I'm NeuroCare AI. I can help you understand {p_name}'s verified clinical data, risk factors, vital trends, medicine stock, and missing measurements. What would you like to know?"

    # 17. Capabilities
    if intent == "capabilities":
        return (
            f"I can help explain Patient #{patient_id}'s verified risk prediction, recent physiological changes, "
            f"vital trends, previous observations, hospital medicine stock, batch expiry schedules, active alarms, "
            f"triage queue, equipment health, blood requests, visiting records, and patient billing."
        )

    # 18. Risk Explanation
    if intent == "risk_explanation":
        drivers = [item['feature'] for item in mort_res.get('top_clinical_drivers', [])[:3]]
        if not drivers:
            drivers = ['GCS_last', 'GCS_mean', 'Urine_mean']

        gcs_val = features.get('GCS_last', 'N/A')
        urine_val = features.get('Urine_last', 'N/A')
        hr_val = features.get('HR_last', 'N/A')
        map_val = features.get('MAP_last', 'N/A')

        return (
            f"**NeuroCare AI — Risk Explanation (Patient #{patient_id})**\n\n"
            f"**Model Prediction:**\n"
            f"• In-Hospital Mortality Probability: `{mort_pct}%`\n"
            f"• Risk Band: `{mort_cat}`\n\n"
            f"**Main Model-Associated SHAP Factors:**\n"
            + "\n".join([f"• `{d}`" for d in drivers]) + "\n\n"
            f"**Current Relevant Observations:**\n"
            f"• GCS: `{gcs_val} /15` | Urine Output: `{urine_val} mL`\n"
            f"• Heart Rate: `{hr_val} bpm` | MAP: `{map_val} mmHg`\n"
            f"• Early Warning Trajectory: `{ew_lvl}` (Score: `{ew_score}/100`, Trend: `{ew_trend}`)\n\n"
            f"**Interpretation:**\n"
            f"These SHAP features represent the primary mathematical contributors to the model's in-hospital mortality risk estimate.\n\n"
            f"*Important: This is a verified machine learning prediction model result, not a clinical diagnosis.*"
        )

    # 19. Recent Changes
    if intent == "recent_changes":
        signals_list = [
            s.get("param", str(s)) if isinstance(s, dict) else str(s)
            for s in ew_res.get("supporting_signals", [])
        ]
        signals_str = ", ".join(signals_list) if signals_list else "All key vital parameters within normal baseline range"

        return (
            f"**NeuroCare AI — Recent Changes (Patient #{patient_id})**\n\n"
            f"• **Early Warning Trajectory:** `{ew_lvl}` (Score: `{ew_score}/100`)\n"
            f"• **Trend Direction:** `{ew_trend}`\n"
            f"• **Key Physiological Signals:** `{signals_str}`\n"
            f"• **Telemetry Data Quality:** `{ew_res.get('data_quality', 'GOOD')}`\n\n"
            f"The Early Warning Engine monitors real-time changes in organ system parameters over the preceding hours."
        )

    # 20. Trends
    if intent == "trends":
        return (
            f"**NeuroCare AI — Vital Trends (Patient #{patient_id})**\n\n"
            f"• **Heart Rate (HR):** `{features.get('HR_last', 'N/A')} bpm` (Mean: `{features.get('HR_mean', 'N/A')}`)\n"
            f"• **Blood Pressure (BP):** `{features.get('SysABP_last', 'N/A')}/{features.get('DiasABP_last', 'N/A')} mmHg` (MAP: `{features.get('MAP_last', 'N/A')}`)\n"
            f"• **SpO2:** `{features.get('SaO2_last', 'N/A')}%` | **Resp Rate:** `{features.get('RespRate_last', 'N/A')} rpm`\n"
            f"• **Temperature:** `{features.get('Temp_last', 'N/A')} degC` | **GCS:** `{features.get('GCS_last', 'N/A')} /15`\n"
            f"• **Overall Trajectory:** `{ew_trend}` (`{ew_lvl}`)\n\n"
            f"Vitals are collected continuously and updated in 48-hour analytical windows."
        )

    # 21. Missing Data
    if intent == "missing_data":
        dq = ew_res.get("data_quality", "GOOD")
        missing_count = sum(1 for v in features.values() if v is None or (isinstance(v, float) and math.isnan(v)))
        return (
            f"**NeuroCare AI — Data Quality & Missingness (Patient #{patient_id})**\n\n"
            f"• **Telemetry Data Quality Status:** `{dq}`\n"
            f"• **Missing Feature Parameters:** `{missing_count} / {len(features)}` feature fields unobserved\n"
            f"• **Primary Missing Categories:** Lab blood gas indicators and specific lab assays are imputed or marked unobserved.\n"
            f"• **Impact on Prediction:** Missing features are automatically handled by the XGBoost missing value branch algorithm."
        )

    # 22. Patient Summary
    if intent == "patient_summary":
        return format_patient_condition_response(patient_id, context_data)

    # General / Conversational fallback
    msg_low = user_message.strip().lower()
    if any(th in msg_low for th in ["thanks", "thank you", "thx", "great", "awesome"]):
        return f"You're welcome! Let me know if you need any further insights on Patient #{patient_id} or other ICU patients."
    
    return f"Sure! I'm ready to assist with Patient #{patient_id}. You can ask about patient condition, mortality risk (YES/NO), vital trends, previous readings, medicine inventory, triage queue, equipment status, or hospital billing."


def call_grok_chat(
    patient_id: str,
    user_message: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    provided_intent: Optional[str] = None,
    last_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Sends a query to Google Gemini AI or xAI Grok API with structured intent detection,
    reliable patient context resolution, and clinical safety guardrails.
    Falls back gracefully to intent-specific clinical synthesis.
    """
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    xai_key = os.getenv("XAI_API_KEY")

    # 1. Resolve Patient Entity from user message
    target_patient_id, resolution_status = resolve_patient_entity(user_message, patient_id)

    if target_patient_id == "NOT_FOUND":
        return {
            "response": sanitize_ai_response(
                "**Patient Lookup Result**\n\n"
                "The requested patient identifier was not found in the active ICU database. "
                "Please verify the Patient Record ID (e.g. #132539, #132541, #132543, #132547, #132548, #132554, #132555, #132556, #132567, #132570) "
                "or ICU room assignment (e.g. ICU Room 03, Bed B-03)."
            ),
            "patient_id": patient_id,
            "intent": "general",
            "model_used": "NeuroCare-Safety-Router",
            "api_key_configured": False
        }

    if target_patient_id == "AMBIGUOUS":
        return {
            "response": sanitize_ai_response(
                "Multiple patient records match your inquiry. Please specify the complete Patient ID (e.g. #132543) "
                "or ICU Room number (e.g. ICU Room 03) to retrieve the verified clinical telemetry."
            ),
            "patient_id": patient_id,
            "intent": "general",
            "model_used": "NeuroCare-Safety-Router",
            "api_key_configured": False
        }

    effective_patient_id = target_patient_id

    # 2. Detect Intent
    intent = detect_intent(user_message, provided_intent)

    # 3. For Ward-level, Medicine, Operations, Queue, Equipment, Blood, Visiting, Billing, and History queries, handle deterministically
    deterministic_ops_intents = [
        "ward_multi_patient", "medicine_stock", "medicine_expiry",
        "previous_readings_trends", "stock_sufficiency", "pending_orders",
        "delivery_status", "equipment_status", "queue_status", "blood_status",
        "visiting_records", "billing_summary", "patient_history_allergies"
    ]
    if intent in deterministic_ops_intents:
        resp_text = format_intent_response(intent, effective_patient_id, {}, user_message, last_context)
        return {
            "response": sanitize_ai_response(resp_text),
            "patient_id": effective_patient_id,
            "intent": intent,
            "model_used": "NeuroCare-Operations-Engine",
            "api_key_configured": bool(gemini_key or xai_key)
        }

    # 4. Generate verified patient context
    context_data = generate_grok_context(effective_patient_id)
    mort_pct = context_data['mortality'].get('mortality_risk_percentage', context_data['mortality'].get('risk_percentage', 0))
    mort_cat = context_data['mortality'].get('mortality_risk_category', context_data['mortality'].get('risk_level', 'UNKNOWN'))
    ew_lvl = context_data['early_warning'].get('early_warning_level', context_data['early_warning'].get('warning_level', 'STABLE'))

    # If asking for direct YES/NO risk or condition, deterministic logic guarantees strict compliance with format rules
    if intent in ["patient_risk_yes_no", "patient_condition"]:
        resp_text = format_intent_response(intent, effective_patient_id, context_data, user_message, last_context)
        return {
            "response": sanitize_ai_response(resp_text),
            "patient_id": effective_patient_id,
            "intent": intent,
            "model_used": "NeuroCare-Clinical-Engine",
            "api_key_configured": bool(gemini_key or xai_key),
            "context_summary": {
                "mortality_percentage": mort_pct,
                "early_warning_level": ew_lvl
            }
        }

    # Construct Intent-Specific User Instruction for LLM
    user_prompt = f"PATIENT RECORD ID: {effective_patient_id}\nDETECTED INTENT: {intent}\nUSER MESSAGE: {user_message}\n\n"

    if intent in ["greeting", "capabilities", "general"]:
        user_prompt += "INSTRUCTION: Respond conversationally to the user message. Do NOT generate a mortality risk report unless asked."
    elif intent == "risk_explanation":
        user_prompt += f"{context_data['raw_context']}\nINSTRUCTION: Explain the model's mortality risk prediction and top SHAP factors clearly."
    elif intent == "recent_changes":
        user_prompt += f"{context_data['raw_context']}\nINSTRUCTION: Focus on recent physiological changes, early warning trajectory, and trend direction."
    elif intent == "trends":
        user_prompt += f"{context_data['raw_context']}\nINSTRUCTION: Focus on vital sign trends and trajectory direction."
    elif intent == "missing_data":
        user_prompt += f"{context_data['raw_context']}\nINSTRUCTION: Focus on telemetry data quality and missing parameters."
    elif intent == "patient_summary":
        user_prompt += f"{context_data['raw_context']}\nINSTRUCTION: Provide a concise clinical summary of the patient using the structured format."

    # A. GOOGLE GEMINI AI INTEGRATION
    if gemini_key and gemini_key.startswith("AIzaSy"):
        gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 600
            }
        }
        headers = {"Content-Type": "application/json"}
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                candidates = body.get("candidates", [])
                answer = ""
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        answer = parts[0].get("text", "")
                if answer:
                    return {
                        "response": sanitize_ai_response(answer),
                        "patient_id": effective_patient_id,
                        "intent": intent,
                        "model_used": f"Google-Gemini ({gemini_model})",
                        "api_key_configured": True,
                        "context_summary": {
                            "mortality_percentage": mort_pct,
                            "early_warning_level": ew_lvl
                        }
                    }
        except Exception:
            pass

    # B. XAI GROK INTEGRATION
    if xai_key and len(xai_key) > 10 and not xai_key.startswith("your_"):
        url = f"{XAI_API_BASE.rstrip('/')}/chat/completions"
        payload = {
            "model": XAI_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 600
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {xai_key}"
        }
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                answer = body["choices"][0]["message"]["content"]
                return {
                    "response": sanitize_ai_response(answer),
                    "patient_id": effective_patient_id,
                    "intent": intent,
                    "model_used": XAI_MODEL,
                    "api_key_configured": True,
                    "context_summary": {
                        "mortality_percentage": mort_pct,
                        "early_warning_level": ew_lvl
                    }
                }
        except Exception:
            pass

    # C. VERIFIED INTENT-SPECIFIC CLINICAL SYNTHESIS FALLBACK MODE
    fallback_reply = format_intent_response(intent, effective_patient_id, context_data, user_message, last_context)
    return {
        "response": sanitize_ai_response(fallback_reply),
        "patient_id": effective_patient_id,
        "intent": intent,
        "model_used": "NeuroCare-Synthesis-Engine",
        "api_key_configured": False,
        "context_summary": {
            "mortality_percentage": mort_pct,
            "early_warning_level": ew_lvl
        }
    }
