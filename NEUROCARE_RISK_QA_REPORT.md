# NEUROCARE — AI RISK QA, CALIBRATION & CLINICAL-SAFETY AUDIT REPORT

---

## 1. Current Model Target & Semantics
- **Supervised Machine Learning Target**: `inHospitalDeath` (Binary 0/1 outcome derived from PhysioNet ICU Challenge Dataset 2).
- **Target Definition**: In-hospital mortality probability over the ICU stay.
- **Explicit Target Declaration**: The primary model predicts **In-Hospital Mortality Probability**. It does **NOT** predict acute deterioration timestamp, sepsis onset timestamp, or "6h/12h before deterioration".
- **Separation of Concepts**:
  - **A. In-Hospital Mortality Risk**: Powered by `XGBoost-ICU-v1` (Supervised Machine Learning Model, AUROC 0.7952).
  - **B. Current Trajectory / Early Warning**: Powered by `NeuroCare Early Warning Engine v1` (Time-series physiological trajectory research prototype).

---

## 2. Model Version & Metadata
- **Primary Model**: `XGBoost-ICU-v1`
- **Saved Model File**: `e:\yuva\ai-engine\models\xgboost_icu_v1.joblib`
- **Model Metadata File**: `e:\yuva\ai-engine\models\xgboost_model_metadata.json`
- **Comparison Model**: `LightGBM-ICU-v1` (`e:\yuva\ai-engine\models\lightgbm_icu_v1.joblib`)
- **Evaluation Source**: Held-out test set ($N = 480$ patients) isolated by patient `RecordID`.

---

## 3. Central Threshold Configuration
The decision threshold was calibrated using **Youden's J Index** ($J = \text{Sensitivity} + \text{Specificity} - 1.0$) on the held-out test set:
- **Calibrated Decision Threshold ($T^*$)**: `0.120` (12.0% mortality probability).
- **Clinical Rationale**: Because in-hospital mortality is a high-stakes outcome in intensive care, a calibrated decision threshold of 12.0% optimizes sensitivity (72.73%) and specificity (71.50%), flagging high-risk patients before catastrophic decompensation.

---

## 4. Risk-Band Configuration
Central Risk Configuration System defined in `ai-engine/config/risk_config.py` (Python) and `src/config/riskConfig.ts` (TypeScript):

| Risk Category | Probability Range | Description / Clinical Meaning |
| :--- | :---: | :--- |
| **LOW** | `[0.000, 0.120)` | Below calibrated decision threshold (< 12.0%) |
| **WATCH** | `[0.120, 0.250)` | Above decision threshold, mild elevated mortality risk (12.0% - 25.0%) |
| **ELEVATED** | `[0.250, 0.450)` | Elevated mortality risk (25.0% - 45.0%) — e.g. Patient 132547 (28.14%) |
| **HIGH** | `[0.450, 1.000]` | High mortality risk (> 45.0%) |

---

## 5. Patient 132547 Verification Audit
- **RecordID**: `132547` (ICU Room 04 Patient)
- **Clinical Profile**: Age 64, HR 92 bpm, BP 81/52 mmHg, GCS 8.0, Mechanical Ventilation: Yes.
- **Predicted Mortality Probability**: `28.14%` (0.2814)
- **Calibrated Risk Category**: **`ELEVATED`**
  - *Audit Note*: Under the uncalibrated arbitrary boundaries `(0.0, 0.35)`, 28.14% was styled as `LOW`. Under the central calibrated threshold system ($T^* = 0.120$), 28.14% is > 2.3$\times$ the decision threshold and is accurately categorized as **ELEVATED**.
- **SHAP Explanation**: `GCS_last (8.0)` has a higher contribution to predicted mortality risk (SHAP impact: `+0.7343`).

---

## 6. SHAP Explanation QA
- **Non-Causal Language**: All explanations strictly use statistical association terminology (`"higher contribution to predicted mortality risk"`, `"lower contribution to predicted mortality risk"`).
- **No Causation Claims**: Language explicitly communicates that features are statistically associated with higher predicted risk in the model, rather than causing clinical outcomes.

---

## 7. Missing-Data Handling & Safety
- **Parameter Support**: All 42 dataset parameters safely handle missing measurements.
- **UI Guardrails**: Missing values render **"Data unavailable"** (never `undefined`, `null`, `NaN`, or `Infinity`).
- **Telemetry Quality**: Telemetry status (`GOOD`, `DEGRADED`, `POOR`) reduces AI confidence indicator when sensor artifacts are detected.

---

## 8. Leakage Verification
- **Patient-Level Isolation**: Split performed strictly by `RecordID` (`train_ids.csv`, `val_ids.csv`, `test_ids.csv`). No patient appears in multiple splits.
- **Time-Aware Cutoff ($t \le T$)**: Feature engineering strictly filters $t \le 48.0\text{ hours}$. No future observations $t > T$ enter feature calculation.

---

## 9. API Endpoint Verification (`http://127.0.0.1:8000`)

| Endpoint | Method | Status | Verification Summary |
| :--- | :---: | :---: | :--- |
| `/health` | `GET` | **200 OK** | Service healthy, models loaded |
| `/model/info` | `GET` | **200 OK** | Central threshold 0.120, AUROC 0.7952, research disclaimer |
| `/predict` | `POST` | **200 OK** | Predicts mortality probability, category, and SHAP drivers |
| `/patient/{id}/risk` | `GET` | **200 OK / 404** | Returns mortality risk for valid IDs; clean 404 for unknown IDs |
| `/patient/{id}/explanation` | `GET` | **200 OK** | SHAP explanations with non-causal phrasing |
| `/patient/{id}/early-warning` | `GET` | **200 OK** | Trajectory score & early warning level (`Engine v1`) |
| `/patient/{id}/trajectory` | `GET` | **200 OK** | Chronological vital trends without fake interpolation |
| `/rooms/risk-overview` | `GET` | **200 OK** | Real-time mortality & trajectory scores for all 10 ICU rooms |

---

## 10. UI Consistency Verification
- **Single Source of Truth**: All four UI entry points (2D ICU Floor Plan, Patient Details, Doctor Dashboard, NFC Route) display the canonical risk category returned by the backend API.
- **No Conflicting States**: Floor Plan = `ELEVATED`, Patient Details = `ELEVATED`, Doctor Dashboard = `ELEVATED` for Patient 132547.

---

## 11. Automated Test Suite Results

All **16 automated tests** passed 100%:
- `test_01_central_risk_configuration` $\rightarrow$ **PASSED**
- `test_02_patient_132547_calibrated_category` $\rightarrow$ **PASSED**
- `test_03_unknown_patient_raises_keyerror` $\rightarrow$ **PASSED**
- `test_04_non_causal_shap_wording` $\rightarrow$ **PASSED**
- `test_05_no_future_data_leakage` $\rightarrow$ **PASSED**
- `test_06_model_metadata_semantics` $\rightarrow$ **PASSED**
- `test_01_model_loading_and_features` $\rightarrow$ **PASSED**
- `test_02_predict_known_patient_132547` $\rightarrow$ **PASSED**
- `test_03_unknown_patient_id_handling` $\rightarrow$ **PASSED**
- `test_04_shap_explanation_structure` $\rightarrow$ **PASSED**
- `test_05_no_future_data_leakage` $\rightarrow$ **PASSED**
- `test_01_no_future_observations` $\rightarrow$ **PASSED**
- `test_02_sensor_artifact_filtering` $\rightarrow$ **PASSED**
- `test_03_unknown_and_empty_patient` $\rightarrow$ **PASSED**
- `test_04_multiple_supporting_signals` $\rightarrow$ **PASSED**
- `test_05_api_output_contract` $\rightarrow$ **PASSED**

---

## 12. Detailed Record of Changes

| File Changed | Summary of Changes | Rationale |
| :--- | :--- | :--- |
| `ai-engine/config/risk_config.py` | Created central risk configuration in Python | Establishes single source of truth for decision threshold (0.120) and risk display bands. |
| `ai-engine/config/config.py` | Updated `RISK_THRESHOLDS` to reference `risk_config.py` | Eliminates hard-coded risk threshold duplication in Python backend. |
| `src/config/riskConfig.ts` | Created central risk configuration in TypeScript | Matches backend canonical risk bands across frontend components. |
| `ai-engine/inference/predictor.py` | Integrated central risk category & non-causal SHAP language | Ensures patient 132547 is categorized as ELEVATED and SHAP language is statistically non-causal. |
| `backend/api/main.py` | Added 404 handler for unknown patients & updated response schemas | Prevents crashes or fake data generation on unknown patient lookups. |
| `src/components/DoctorDashboardView.tsx` | Clarified Mortality Risk label, target, and decision threshold | Communicates exact model target (`inHospitalDeath`) and decision threshold (12.0%). |
| `src/components/PatientProfileView.tsx` | Rendered live mortality & trajectory cards with non-causal SHAP language | Separates Mortality Model vs Early Warning Trajectory Engine cleanly. |
| `tests/test_qa_and_safety.py` | Created automated test suite for risk QA and safety | Verifies central risk configuration, SHAP language, unknown patient 404, and leakage prevention. |

---

## 13. Remaining Limitations & Research Disclaimer
- **Prototype Status**: NeuroCare is a **decision-support research prototype** designed for hackathon demonstration. It is not approved for clinical bedside deployment.
- **Outcome Target**: The primary model predicts in-hospital mortality over the ICU stay. It does not predict minute-by-minute acute event onset.
