# NeuroCare Alert Engine Audit

## 1. Model Target

- **Trained Model Architecture**: XGBoost Classifier (`XGBoost-ICU-v1`).
- **Target Variable**: `inHospitalDeath` (Binary target: 0 = Survived / Discharged, 1 = In-Hospital Mortality).
- **Target Interpretation**: The model outputs a predicted probability of **In-Hospital Mortality Risk** based on ICU admission observations and patient vitals/telemetry.
- **Clinical Distinction**: The model does NOT predict acute 6-hour clinical deterioration or time-to-event outcomes. All system alerts, predictions, and UI displays explicitly label this metric as **"Model-Estimated In-Hospital Mortality Risk"** and strictly avoid diagnostic or deterioration claims unless supported by independent clinical telemetry.

## 2. Prediction History

- **Snapshot Data Model**: Stored per prediction in `predictionHistory/{predictionId}`.
- **Schema**:
  - `predictionId`: Unique identifier (`pred_...`).
  - `patientId`: Associated patient RecordID.
  - `modelVersion`: `XGBoost-ICU-v1`.
  - `target`: `inHospitalDeath`.
  - `probability`: Float (e.g. `0.281`).
  - `percentage`: Formatted string (`"28.1%"`).
  - `riskLevel`: Categorical (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
  - `dataCutoff`: Timestamp of the latest clinical observation used.
  - `generatedAt`: ISO 8601 creation timestamp.
  - `featureCount`: Integer count of evaluated features.
  - `dataQuality`: Object containing missing feature count, quality score, and status (`EXCELLENT`, `FAIR`, `POOR`).
  - `topContributors`: Array of top SHAP feature attribution objects (`{ feature, value, shapValue }`).
- **Patient Isolation**: All query operations require explicit `patientId` filtering.

## 3. Risk Thresholds

- **Centralized Threshold Engine**: `ai-engine/inference/thresholds.py`.
- **Threshold Mapping**:
  - `LOW`: Probability $< 0.050$ ($< 5.0\%$).
  - `MEDIUM`: $0.050 \le \text{Probability} < 0.120$ ($5.0\% - 11.9\%$).
  - `HIGH`: $0.120 \le \text{Probability} < 0.250$ ($12.0\% - 24.9\%$).
  - `CRITICAL`: Probability $\ge 0.250$ ($\ge 25.0\%$).
- **Primary Decision Threshold**: $0.120$ ($12.0\%$) based on validated ROC curve operating points.

## 4. Alert Rules

Alerts are generated across 4 standardized rules:
1. **`MODEL_RISK_THRESHOLD`**: Triggered when a patient's model risk crosses from Low/Medium to High ($\ge 12.0\%$) or Critical ($\ge 25.0\%$).
2. **`MODEL_RISK_INCREASE`**: Triggered when model probability increases by $\ge 5.0$ percentage points from the previous stored prediction snapshot.
3. **`DATA_QUALITY_WARNING`**: Triggered when data quality drops to `POOR` (missing $>25\%$ required vitals/labs).
4. **`TELEMETRY_WARNING`**: Triggered when sensor disconnects or signal noise degraded feature reliability.

## 5. Deduplication

- **Suppression Window**: 15 minutes (configurable).
- **Rule**: If a new prediction is generated for a patient with the same alert type and same risk state within 15 minutes, and the probability change is $< 3.0$ percentage points, duplicate alert creation is suppressed.
- **Exception**: Genuinely new risk transitions (e.g., Medium to High) or probability jumps $\ge 3.0$ percentage points immediately generate a new active alert regardless of window elapsed.

## 6. Alert Lifecycle

- **States**: `ACTIVE` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `RESOLVED`.
- **Authorization**: Only authorized roles (`Doctor`, `Intensivist`, `Physician`, `Nurse`) can acknowledge alerts via `POST /alerts/{alert_id}/acknowledge`. Unauthorized requests are rejected with HTTP 403.
- **Audit Logging**: Acknowledgments permanently record `user_id`, `role`, and `acknowledged_at` ISO timestamp.
- **Resolution**: Alerts transition to `RESOLVED` automatically when subsequent predictions drop below alert thresholds or via explicit clinical intervention logging.

## 7. Patient Isolation

- **Storage & Query Scope**: All prediction snapshots and alerts are key-indexed and strictly filtered by `patientId`.
- **Automated Verification**: Unit tests verify that requesting `GET /patient/132543/prediction-history` never returns items belonging to `patientId` `145892` or any other patient. Unknown patient IDs return structured HTTP 404 responses.

## 8. SHAP Association

- **Traceable Attribution**: SHAP values calculated during model inference are saved directly into the `predictionHistory` snapshot and associated alert object.
- **Immutable Explanation**: Alerts display the exact top feature contributors (`GCS`, `BUN`, `Temp`, `HR`, `SysBP`) from the exact snapshot that triggered the alert, preventing post-hoc attribution discrepancies.

## 9. Data Quality

- **Quality Indexing**: Evaluates missing features, sensor telemetry health, and sample freshness.
- **Safety Rule**: When data quality is `POOR`, model predictions are flagged with `dataQualityWarning: true`. Probabilities are never artificially lowered or altered; instead, alert explanations explicitly state: *"Model risk score evaluated under POOR data quality (missing vitals/telemetry)."*

## 10. Model Versioning

- **Version Identifier**: `XGBoost-ICU-v1`.
- **Historical Immutability**: Historical predictions and alerts permanently retain `modelVersion: XGBoost-ICU-v1`. If a future model version is introduced, historical records remain tagged to their generating model version and are never re-labeled or retroactively computed.

## 11. Firebase Security

- **Security Rules**: Security rules enforce read/write access based on patient authorization and clinician role.
- **Credential Protection**: Firebase admin service-account keys are restricted to backend environment files (`.env`) and never exposed to the client bundle.

## 12. Frontend Integration

- **Patient Profile View (`src/components/PatientProfileView.tsx`)**:
  - Displays **Active Clinical Model Alerts** card with severity badges, change metrics, and clinician acknowledgment controls.
  - Displays **Prediction History Timeline** graph showing chronological risk trajectory without fake historical interpolation.
- **Patient Switching**: Switching active patients in the UI instantly clears and reloads patient-isolated alerts, SHAP attributions, prediction history, and Grok assistant context.

## 13. Doctor Dashboard Integration

- **Active Alerts Overview (`src/components/DoctorDashboardView.tsx`)**:
  - Displays a dedicated **Active Model Alerts** list showing patient ID, room number, alert type, risk severity, current probability, and creation timestamp.
  - Clicking any alert card navigates directly to the corresponding patient's details page.

## 14. ICU Overview Integration

- **3D Floor Plan Indicators**:
  - Patients with `CRITICAL` or `HIGH` active alerts display subtle red/orange status pulse indicators on their bed cards.
  - Visual indicators adhere to accessibility guidelines (no aggressive flashing; clear color-contrast badges).

## 15. Test Results

- **Automated Test Suite**: `tests/`
- **Total Executed Tests**: 60
- **Passed**: 60
- **Failed**: 0
- **Test Categories Verified**:
  1. Model prediction persistence and schema validation.
  2. Patient isolation and cross-patient leakage prevention.
  3. Risk threshold evaluation ($12.0\%$ decision threshold).
  4. Alert rule generation (`MODEL_RISK_INCREASE`, `MODEL_RISK_THRESHOLD`, etc.).
  5. Alert deduplication within suppression windows.
  6. Role-based alert acknowledgment and authorization controls.
  7. Unknown patient 404 error handling.
  8. Model failure handling (prevents false LOW fallback).
  9. Stale telemetry data detection.
  10. SHAP attribution preservation in snapshots.

## 16. Known Limitations

- **Mortality Target Only**: The ML model predicts overall in-hospital mortality risk, not acute 6-hour hemodynamic collapse or sepsis onset. Clinical users must pair model alerts with continuous bedside monitor telemetry.
- **In-Memory Store Fallback**: In non-Firebase local testing environments, predictions and alerts persist in-memory within backend memory stores and persist across API invocations until server restart.

## 17. Files Changed

- `ai-engine/inference/alert_engine.py`: Core alert engine, prediction store, deduplication logic, and lifecycle management.
- `ai-engine/inference/predictor.py`: Integrated automatic snapshot recording and alert evaluation into prediction flow.
- `backend/api/main.py`: Added REST endpoints `/patient/{id}/prediction-history`, `/patient/{id}/alerts`, `/alerts/active-overview`, `/alerts/{id}/acknowledge`.
- `src/services/aiEngine.ts`: Exported frontend TypeScript interfaces and API client calls.
- `src/components/PatientProfileView.tsx`: Integrated Active Clinical Alerts section and Prediction History timeline.
- `src/components/DoctorDashboardView.tsx`: Integrated Active Model Alerts overview widget.
- `tests/test_alert_engine.py`: Unit test suite covering alerts, history, deduplication, and authorization.
- `NEUROCARE_ALERT_ENGINE_AUDIT.md`: Created audit documentation report.
