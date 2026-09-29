# NeuroCare ML Prediction Hardening & Clinical Decision Support Report

## 1. Current Model
- **Model Architecture:** Gradient Boosted Decision Trees (`XGBClassifier`)
- **Model Version:** `XGBoost-ICU-v1`
- **Saved Model Location:** `ai-engine/models/xgboost_icu_v1.joblib`
- **Metadata Location:** `ai-engine/models/xgboost_model_metadata.json`
- **Hyperparameters:** `n_estimators=300`, `max_depth=5`, `learning_rate=0.03`, `scale_pos_weight=6.2226`
- **Feature Vector:** 233 derived features from 36 active ICU clinical parameters up to 48 hours

---

## 2. Target Definition
- **Primary Target Variable:** `inHospitalDeath` (Binary 0/1 outcome from PhysioNet Outcomes-train)
- **Target Label:** `Predicted in-hospital mortality risk`
- **Target Definition:** Probability that a patient will experience in-hospital death during their ICU/hospital stay based on observations recorded up to 48.0 hours.
- **Clinical Distinction:** The model measures **in-hospital mortality risk** and is **NOT** a validated short-term acute deterioration event (e.g. 2-hour or 4-hour) alarm.

---

## 3. Prediction Flow
```
Raw Clinical Observations (set-a / parquet)
  ↓
Spike Artifact Filter & 48h Time Window Cutoff
  ↓
233-Feature Matrix Extraction
  ↓
XGBoost-ICU-v1 Model Inference (predict_proba)
  ↓
Strict Probability Validation (0.0 <= prob <= 1.0, not NaN/Inf)
  ↓
Central Risk Engine Thresholding (0.120 Decision Threshold)
  ↓
SHAP TreeExplainer Feature Contribution Calculation
  ↓
FastAPI JSON Snapshot (/patient/{id}/risk, /predict)
  ↓
React UI / Doctor Dashboard / ICU Floor Layout Rendering
```

---

## 4. Risk Thresholds
The centralized risk engine (`ai-engine/config/risk_config.py` and `src/config/riskConfig.ts`) enforces the calibrated decision threshold $t = 0.120$ ($12.0\%$):

| Risk Category | Probability Range | Description |
| :--- | :--- | :--- |
| **LOW** | $0.000 - 0.119$ | Below calibrated decision threshold ($< 12\%$) |
| **WATCH** | $0.120 - 0.249$ | Just above decision threshold ($12\% - 25\%$) |
| **ELEVATED** | $0.250 - 0.449$ | Elevated mortality risk ($25\% - 45\%$) |
| **HIGH** | $0.450 - 1.000$ | High mortality risk ($> 45\%$) |

- **Clinical Notice:** *Risk bands are calibrated engineering decision thresholds and are not independent medical diagnoses.*

---

## 5. RecordID 132547 Investigation
- **Patient Profile:** 64Y Female in ICU Room 04, Hypotension (81/52 mmHg), GCS 8, Mechanical Ventilation.
- **Raw Prob Output:** `0.2814` ($28.14\%$)
- **Mapped Category:** **ELEVATED** ($0.250 \le 0.2814 < 0.450$)
- **Root Cause Analysis:** Previously reported "LOW" status in draft UI mocks occurred when standard $0.50$ threshold was evaluated ($0.2814 < 0.500$) or when percentage scale $28.14$ was compared to decimal $0.120$.
- **Fix & Regression Test:** Centralized risk engine strictly converts probabilities to float $0.0 - 1.0$ before thresholding. Regression test `test_07_record_132547_regression` in `tests/test_prediction_hardening.py` confirms `0.2814` is permanently mapped to **ELEVATED**.

---

## 6. Patient-Specific Validation
Tested on real dataset patients:

| RecordID | Mortality Prob | Risk Category | Data Quality | Top Model Contributor |
| :--- | :--- | :--- | :--- | :--- |
| **132539** | $0.0057$ ($0.6\%$) | **LOW** | GOOD | `GCS_last` ($15.0$) |
| **132541** | $0.0705$ ($7.1\%$) | **LOW** | GOOD | `GCS_last` ($15.0$) |
| **132543** | $0.0074$ ($0.7\%$) | **LOW** | GOOD | `GCS_last` ($15.0$) |
| **132547** | $0.2814$ ($28.1\%$) | **ELEVATED** | GOOD | `GCS_last` ($3.0$) |
| **132548** | $0.0611$ ($6.1\%$) | **LOW** | GOOD | `GCS_last` ($15.0$) |

- **Patient Isolation:** Patient A features generate Patient A prediction; Patient B features generate Patient B prediction. No shared object mutation.

---

## 7. Data Cutoff Validation
- Every prediction snapshot explicitly records `"data_cutoff": "48.0 Hours ICU Admission Window"`.
- Features strictly enforce $t \le 48.0$ hours. No future observations are included.

---

## 8. Data Quality Validation
- **Missingness Score:** Evaluated per patient feature vector.
  - **GOOD:** Missing features $< 15\%$
  - **DEGRADED:** Missing features $15\% - 40\%$
  - **POOR:** Missing features $> 40\%$
- Data quality is reported independently from model mortality risk.

---

## 9. SHAP Validation
- **Additivity Check:** $\text{Base Value} + \sum \text{SHAP} = \text{Model Margin Output}$ ($\sigma(-2.5795) = 0.0705$).
- **Clinical Language:** Uses non-causal statistical contribution wording ("higher contribution to predicted mortality risk" / "lower contribution to predicted mortality risk").

---

## 10. Calibration Status
- **Brier Score:** $0.1078$ on held-out test set.
- **Reliability:** Well-calibrated in lower and elevated risk bands. Probabilities reflect population mortality rates rather than subjective confidence.

---

## 11. Stale Prediction Handling
- UI detects telemetry data age and provides `"Live Telemetry"` vs `"Prediction Data Cutoff"` timestamp badges so clinicians know if newer observations are present.

---

## 12. Frontend/Backend Consistency
- Frontend consumes FastAPI `/patient/{id}/risk` directly.
- Shared threshold definition ($0.120$). Zero client-side risk score recalculation.

---

## 13. Doctor Dashboard Consistency
- Assigned Patient Clinical Priority Roster in Doctor Dashboard uses identical `p.deteriorationRisk` / backend mortality risk output.

---

## 14. ICU Overview Consistency
- ICU Floor Layout map uses identical patient RecordID mapping and backend risk categories across all 10 ICU rooms.

---

## 15. Security
- Model joblib files are hosted securely on backend server.
- No PII is logged in prediction audit logs (RecordID, Prob, Category, Cutoff logged only).

---

## 16. Automated Tests
- Ran full test suite (`python -m unittest discover tests`):
  - **60 out of 60 tests passed** ($100\%$ pass rate).

---

## 17. Issues Found
1. **Unsafe Pseudo-Confidence Wording:** Previous UI rendered `"Confidence Rating: HIGH (94%)"`.
2. **Mock Data Mismatch:** Hardcoded initial patient risk values differed from backend ML outputs prior to API fetch.

---

## 18. Fixes Implemented
1. **Replaced Pseudo-Confidence with Data Quality Rating:** Rendered `"Data Quality Rating: GOOD"` or `"DEGRADED"`.
2. **Hardened Prediction Endpoint:** Added probability validation (`0.0 <= prob <= 1.0`), ISO timestamp (`generated_at`), `data_cutoff`, and safe prediction audit logging.
3. **Added `/model/health` Endpoint:** Returns operational health indicators for model file, metadata, and prediction service.
4. **Created Regression Test Suite:** Added 17 unit tests in `tests/test_prediction_hardening.py`.

---

## 19. Remaining Limitations
1. **Target Limitation:** Current model predicts overall in-hospital mortality probability, not acute 2-hour deterioration events.
2. **Precision at Decision Threshold:** Precision is $28.92\%$ at $t = 0.120$ ($71.08\%$ false alarm rate), requiring clinicians to use the score as a screening alert alongside bedside assessment.
