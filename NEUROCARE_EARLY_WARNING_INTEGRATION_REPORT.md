# NEUROCARE — EARLY-WARNING ENGINE INTEGRATION REPORT

---

## 1. Architecture Implemented

The **NeuroCare** platform integrates two distinct AI analysis engines:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              NEUROCARE AI LAYER                               │
├──────────────────────────────────────────────────┬────────────────────────────┤
│ A. IN-HOSPITAL MORTALITY RISK ENGINE             │ B. EARLY-WARNING ENGINE    │
│ Powered by: XGBoost-ICU-v1                       │ Powered by:                │
│ Model Type: Supervised XGBoost Classifier        │ NeuroCare Early Warning    │
│ Target: inHospitalDeath (In-hospital mortality)  │ Engine v1                  │
│ Test AUROC: 0.7952 | Decision Threshold: 0.120   │ Engine Type: Rule-Based    │
│ Output: Calibrated Mortality Probability (%)     │ Trajectory Scoring Engine  │
│                                                  │ Output: Trajectory Score   │
│                                                  │ (0-100) & Warning Level    │
└──────────────────────────────────────────────────┴────────────────────────────┘
```

- **Separation of Concepts**: The Mortality Risk Engine (`XGBoost-ICU-v1`) predicts overall in-hospital mortality risk over the ICU stay. The Early Warning Engine (`early_warning_engine.py`) continuously tracks acute vital sign trajectories up to time $T$ ($t \le T$).

---

## 2. Files Created or Modified

| File Path | Description of Changes | Rationale |
| :--- | :--- | :--- |
| `ai-engine/inference/early_warning_engine.py` | Created rule-based time-series trajectory scoring engine | Analyzes real-time vital trends, sensor spikes, and cross-signal consistency up to time $T$. |
| `backend/api/main.py` | Integrated `/patient/{id}/early-warning`, `/patient/{id}/trajectory`, `/early-warning`, `/rooms/risk-overview` | Exposes Early Warning trajectory scores and room status via FastAPI. |
| `src/services/aiEngine.ts` | Added `fetchEarlyWarningData` TypeScript service function | Connects frontend React views to backend Early Warning endpoints. |
| `src/components/PatientProfileView.tsx` | Added dedicated `Current Trajectory / Early Warning` card and vital trajectory charts | Displays trajectory level, top signals, data quality, and time range selectors. |
| `src/components/DoctorDashboardView.tsx` | Updated assigned patient table with separate Mortality Risk and Early Warning columns | Allows doctors to filter and sort patients by Early Warning warning level. |
| `tests/test_early_warning_engine.py` | Created 20-point automated test suite for Early Warning Engine | Verifies time cutoff $t \le T$, spike filtering, unknown patients, and schema validity. |
| `tests/test_qa_and_safety.py` | Created 6-point automated test suite for risk QA and safety | Validates central risk configuration, non-causal SHAP language, and 404 responses. |

---

## 3. Feature-Engineering Methods
- **Vital Signals**: Heart Rate (HR), Mean Arterial Pressure (MAP), Systolic & Diastolic BP, Respiratory Rate (RR), Oxygen Saturation (SpO2), Temperature.
- **Renal & Neurological Indicators**: Glasgow Coma Scale (GCS), Hourly Urine Output.
- **Laboratory Indicators**: Serum Lactate, Creatinine, BUN, WBC, Platelets, Sodium (Na), Potassium (K), Bicarbonate (HCO3), pH, PaO2, PaCO2, FiO2.
- **Calculations**: Latest value, previous value, delta ($\Delta$), rate of change ($\text{slope}$), rolling mean, min, max, std, abnormal duration, time since last reading, missingness indicators.
- **Time Windows**: $1\text{h}$, $3\text{h}$, $6\text{h}$, $12\text{h}$, $24\text{h}$, $48\text{h}$ post-admission.

---

## 4. Warning-Score Calculation
- **Base Score**: Starts at baseline `10` points.
- **Vital Trend Penalties**:
  - Tachycardia ($\text{HR} > 100 \text{ bpm}$): $+10\text{ to } +15$ pts.
  - Hypotension ($\text{MAP} < 65 \text{ mmHg}$): $+12\text{ to } +20$ pts.
  - Desaturation ($\text{SpO2} < 93\%$): $+15\text{ to } +25$ pts.
  - Tachypnea ($\text{RR} > 22 \text{ rpm}$): $+10\text{ to } +15$ pts.
  - Neurological Decline ($\text{GCS} < 15$): $+15\text{ to } +25$ pts.
  - Hyperlactatemia ($\text{Lactate} > 2.0 \text{ mmol/L}$): $+15$ pts.
- **Cross-Signal Consistency Multiplier**: When $\ge 3$ independent physiological vital systems show concurrent worsening, points are multiplied by $1.35\times$.

---

## 5. Centrally Defined Warning-Level Thresholds

```python
DISPLAY_BANDS = {
    "STABLE": (0, 24),
    "WATCH": (25, 44),
    "ELEVATED": (45, 69),
    "CRITICAL": (70, 100),
    "INSUFFICIENT_DATA": None
}
```

---

## 6. Data-Quality & Telemetry Protection
- **Isolated Spike Filter**: Single-reading spikes (e.g. $92 \rightarrow 93 \rightarrow 250 \rightarrow 94$) are filtered and flagged as `SENSOR_ARTIFACT`.
- **Quality Status**: `GOOD` (0 artifacts), `DEGRADED` (1 artifact filtered), `POOR` ($>1$ artifacts filtered), `INSUFFICIENT_DATA` ($<2$ observations available).
- **Insufficient Data Handling**: Patients with fewer than 2 readings return `INSUFFICIENT_DATA` rather than defaulting to normal or generating fake values.

---

## 7. API Endpoints Verified (`http://127.0.0.1:8000`)

| Endpoint | Method | Status | Payload Description |
| :--- | :---: | :---: | :--- |
| `GET /health` | `GET` | **200 OK** | Service health & loaded models |
| `GET /model/info` | `GET` | **200 OK** | Model parameters, test AUROC (0.7952), research disclaimer |
| `GET /patient/{id}/early-warning` | `GET` | **200 OK** | Trajectory score, warning level, supporting signals, data quality |
| `GET /patient/{id}/trajectory` | `GET` | **200 OK** | Chronological trends (last value, prev value, trend direction) |
| `GET /early-warning` | `GET` | **200 OK** | Overview of early warning states for all patients |
| `GET /patient/{id}/risk` | `GET` | **200 OK / 404** | In-Hospital Mortality Risk Score (`XGBoost-ICU-v1`) |
| `GET /patient/{id}/explanation` | `GET` | **200 OK** | SHAP explanations with non-causal statistical language |
| `GET /rooms/risk-overview` | `GET` | **200 OK** | Combined mortality & trajectory scores for 10 ICU floor plan rooms |

---

## 8. Frontend Integration
- **2D ICU Floor Plan**: Displays Occupied Rooms with backend canonical `early_warning_level` (`STABLE`, `WATCH`, `ELEVATED`, `CRITICAL`), `trend_direction`, and `mortality_risk_category`. Room click opens Patient Details.
- **Patient Details**: Features separate cards for **A. In-Hospital Mortality Risk** (XGBoost) and **B. Current Trajectory / Early Warning** (Engine v1) with vital trend charts and selectable time ranges ($1\text{h}$ to $48\text{h}$). Missing vitals show **"Data unavailable"**.
- **Doctor Dashboard**: Assigned patient table displays `Early Warning`, `Mortality Risk`, `Trend Direction`, `Key Signals`, `Data Quality`, and `Last Measurement Time`.

---

## 9. Firebase Changes
- Firebase continues to store application state (Doctor assignments, NFC tag bindings, alert acknowledgements, patient RecordID mappings). Raw clinical observations remain in Parquet/DuckDB.

---

## 10. Automated Test Results (31 / 31 Tests PASSED)

Ran 31 tests in 3.137s — **100% PASSED**:
- `TestNeuroCareAIPipeline` (5/5 PASSED)
- `TestNeuroCareQAAndSafety` (6/6 PASSED)
- `TestNeuroCareEarlyWarningEngineComplete` (20/20 PASSED)

---

## 11. Real-Patient Verification Audit (RecordID: 132547)

- **RecordID**: `132547` (ICU Room 04)
- **Cutoff Time**: $t \le 48.0\text{ hours}$
- **In-Hospital Mortality Risk (`XGBoost-ICU-v1`)**:
  - Probability: `28.14%` (0.2814)
  - Category: **`ELEVATED`** (Decision Threshold: 12.0%)
- **Current Trajectory / Early Warning (`Engine v1`)**:
  - Trajectory Score: `35 / 100`
  - Warning Level: **`WATCH`**
  - Trend Direction: `UNSTABLE`
  - Telemetry Data Quality: `DEGRADED` (1 isolated sensor artifact filtered in Urine series)
  - Supporting Signals: GCS reduced to 8.0 (`NEUROLOGICAL_DECLINE`), MAP decreased from 95 to 76 mmHg (`DECREASING_HYPOTENSION`).

---

## 12. Engine Characterization & Limitations
- **Engine Type**: `NeuroCare Early Warning Engine v1` is a **rule-based trajectory scoring engine**. It is **not** a machine-learning probability classifier.
- **Measured Metrics**: The AUROC of `0.7952` belongs strictly to the **XGBoost In-Hospital Mortality Model**, not the Early Warning Trajectory Engine.
- **Clinical Lead-Time Disclaimer**: PhysioNet ICU dataset outcomes do not contain exact acute deterioration timestamps. The platform does **not** claim to predict deterioration 6h or 12h in advance. It is an **AI-assisted ICU risk and trajectory monitoring research prototype**.
