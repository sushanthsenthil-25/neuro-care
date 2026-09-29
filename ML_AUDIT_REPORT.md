# NeuroCare ML Audit Report

## 1. Executive Summary

A comprehensive end-to-end Machine Learning, Data Integrity, and Clinical MLOps audit was conducted on the trained **NeuroCare ICU AI Engine**. 

The core predictive model (`XGBoost-ICU-v1`) was evaluated on a completely unseen, held-out test set of 480 patients. All metrics, data integrity checks, split isolation checks, SHAP additivity checks, and API latency benchmarks reported in this document were empirically measured directly from the active code base and dataset.

**Key Findings:**
1. **Model & Target:** The core model is an XGBoost binary classifier (`xgboost_icu_v1.joblib`) trained on 48-hour ICU patient observation windows to predict **in-hospital mortality probability** (`inHospitalDeath`). It is **NOT** a validated short-term (e.g. 2-hour or 4-hour) acute deterioration event prediction model.
2. **Data Leakage & Split Integrity:** Zero patient leakage exists across the dataset splits ($2,239$ train, $481$ validation, $480$ test patients). Patient ID intersections across all splits are strictly empty ($0$). Temporal leakage is prevented by truncating all observation series to $t \le 48.0$ hours.
3. **Test Set Performance:** Evaluated on the held-out test set at the calibrated decision threshold ($t = 0.120$), the model achieves an **AUROC of 0.7952**, **AUPRC of 0.4328**, **Sensitivity/Recall of 72.73%**, **Specificity of 71.50%**, **Precision/PPV of 28.92%**, **F1 Score of 0.4138**, and a **Brier Score of 0.1078**.
4. **Operational Impact of False Positives:** At decision threshold $0.120$, the model produces 118 False Positives against 48 True Positives out of 480 test patients. Thus, approximately $71\%$ of positive flags are false alarms ($28.92\%$ precision).
5. **Threshold & Risk Band Consistency:** The decision threshold is $0.120$ ($12.0\%$). Risk categories are aligned across backend (`risk_config.py`), API (`main.py`), and frontend (`riskConfig.ts`):
   - `LOW`: $[0.0, 0.120)$
   - `WATCH`: $[0.120, 0.250)$
   - `ELEVATED`: $[0.250, 0.450)$ (e.g. Patient #132547 at $28.14\%$)
   - `HIGH`: $[0.450, 1.000]$

---

## 2. Current Model

- **Model Type:** Gradient Boosted Decision Trees (`XGBClassifier`, XGBoost 2.x)
- **Model Version:** `XGBoost-ICU-v1`
- **Saved Model File:** `ai-engine/models/xgboost_icu_v1.joblib` (Size: 657 KB)
- **Metadata File:** `ai-engine/models/xgboost_model_metadata.json`
- **Primary Target Variable:** `inHospitalDeath` (Binary 0/1 outcome from PhysioNet Outcomes-train)
- **Training Hyperparameters:** `n_estimators=300`, `max_depth=5`, `learning_rate=0.03`, `subsample=0.8`, `colsample_bytree=0.8`, `scale_pos_weight=6.2226`
- **Feature Count:** 233 derived features (derived from 36 active ICU clinical parameters up to 48 hours)
- **Training Set:** 2,239 patients (310 deaths, 1,929 survivors)
- **Validation Set:** 481 patients (67 deaths, 414 survivors)
- **Test Set:** 480 patients (66 deaths, 414 survivors)

---

## 3. What the Model Actually Predicts

```
===================================================================================
Current model predicts in-hospital mortality probability. 
It is NOT a validated short-term deterioration prediction model.
===================================================================================
```

- **Target Definition:** Binary indicator (`1` = patient died during ICU/hospital admission, `0` = patient survived to discharge).
- **Target Source:** `Outcomes-train.txt` column `In-hospital_death`.
- **Temporal Window:** Derived features use observations from ICU admission up to $t = 48.0$ hours.
- **Deterioration Distinction:** The PhysioNet dataset does not contain precise timestamped minute-by-minute acute event labels (e.g. cardiac arrest timestamp, intubation timestamp, or sepsis onset timestamp). Therefore, the model estimates overall in-hospital mortality probability from 48-hour ICU telemetry rather than predicting acute deterioration $N$ hours prior to an event.

---

## 4. Data Integrity

- **Raw Dataset:** PhysioNet ICU Challenge Dataset 2 (Set A)
- **Total Patients:** 3,200 unique ICU patients
- **Total Raw Observations:** 1,286,014 clinical measurements
- **Unique Parameters:** 36 parameters with non-zero observations in raw files (out of 42 defined schema parameters)
- **Outcome Distribution:** 443 deaths ($13.84\%$), 2,757 survivors ($86.16\%$)
- **Missing Data:** Overall feature matrix missingness across the 233 feature columns is **12.75%**. Missing values are naturally handled by XGBoost default split direction.
- **Duplicate Observations:** 0 duplicate timestamps detected after duckdb normalization.
- **Artifact Filtering:** Spike detection filter removes physiologically impossible values (e.g., HR $< 20$ or $> 250$, Temp $< 30^\circ\text{C}$ or $> 45^\circ\text{C}$, $\text{SaO}_2 < 40\%$).
- **Data Leakage Check:**
  - `intersection(train, validation)` = 0 patients (**PASS**)
  - `intersection(train, test)` = 0 patients (**PASS**)
  - `intersection(validation, test)` = 0 patients (**PASS**)
  - `Time_Hours` $\le 48.0$ truncation enforced in feature extraction (**PASS**)

---

## 5. Feature Engineering Audit

- **Feature Matrix Shape:** $3,200 \times 234$ (233 feature columns + `RecordID` / Target)
- **Feature Categories:**
  1. **Demographics (5):** `Age`, `Gender`, `Height`, `Weight`, `ICUType`
  2. **Signal Summaries (225):** For 25 frequent parameters (`HR`, `Temp`, `RespRate`, `SaO2`, `GCS`, `Urine`, `SysABP`, `DiasABP`, `MAP`, `Glucose`, `Na`, `K`, `Mg`, `HCO3`, `BUN`, `Creatinine`, `HCT`, `WBC`, `Platelets`, `PaO2`, `PaCO2`, `pH`, `FiO2`, `Lactate`, `MechVent`), 9 statistical features are extracted:
     - `_last`, `_min`, `_max`, `_mean`, `_std`, `_count`, `_time_since_last`, `_delta`, `_pct_change`, `_slope`, `_is_missing`
  3. **Cross-Sensor Ratios (3):** `PaO2_FiO2_Ratio`, `Shock_Index` ($\text{HR}/\text{MAP}$), `Lactate_MAP_Interaction`
- **Leakage Assessment:**
  - **Safe Features:** All 233 features strictly use observations recorded at $t \le 48.0$ hours.
  - **Excluded Columns:** `RecordID` is explicitly excluded from feature columns during model fitting (`feature_cols = [c for c in df.columns if c not in ['RecordID', PRIMARY_TARGET]]`).

---

## 6. Test Set Performance

The saved model (`xgboost_icu_v1.joblib`) was evaluated on the 480 held-out test set patients.

### **Primary Metrics at Calibrated Decision Threshold ($t = 0.120$)**

| Metric | Value | Reference / Notes |
| :--- | :--- | :--- |
| **AUROC** | **0.7952** | Good discrimination capacity |
| **AUPRC** | **0.4328** | Evaluated on 13.8% baseline prevalence |
| **Accuracy** | **71.67%** | $344 / 480$ correct classifications |
| **Sensitivity (Recall)** | **72.73%** | $48 / 66$ mortality cases caught |
| **Specificity** | **71.50%** | $296 / 414$ survivors correctly identified |
| **Precision (PPV)** | **28.92%** | $48 / 166$ positive predictions are true deaths |
| **Negative Predictive Value (NPV)** | **94.27%** | $296 / 314$ negative predictions are true survivors |
| **F1 Score** | **0.4138** | Harmonic mean of precision and recall |
| **Brier Score** | **0.1078** | Probability calibration accuracy |
| **Log Loss** | **0.3481** | Cross-entropy loss |

### **Confusion Matrix ($t = 0.120$)**

```
                     Actual Negative (Survivor)   Actual Positive (Death)
Predicted Negative              296 (TN)                     18 (FN)
Predicted Positive              118 (FP)                     48 (TP)
```

### **Comparison at Standard Threshold ($t = 0.500$)**
- **Accuracy:** 86.46%
- **Sensitivity:** 34.85% ($23 / 66$) — *Misses 43 out of 66 deaths*
- **Specificity:** 94.69% ($392 / 414$)
- **Precision:** 51.11% ($23 / 45$)
- **F1 Score:** 0.4144
- **Confusion Matrix:** $\text{TN}=392, \text{FP}=22, \text{FN}=43, \text{TP}=23$

---

## 7. Calibration

- **Brier Score:** $0.1078$ (XGBoost), $0.1055$ (LightGBM).
- **Reliability Assessment:** Predicted probabilities align well with empirical outcome frequencies in lower risk bands ($< 12\%$). For patients predicted between $20\%$ and $30\%$ mortality risk, observed mortality rate is approximately $24.5\%$.

---

## 8. Threshold / Risk-Level Audit

The system uses a calibrated decision threshold $t = 0.120$ ($12.0\%$) based on Youden's J index ($J = \text{Sensitivity} + \text{Specificity} - 1 = 0.4423$).

### **Risk Band Definitions**

| Category | Probability Range | Risk Score % | Actionable Interpretation |
| :--- | :--- | :--- | :--- |
| **LOW** | $0.000 - 0.119$ | $0.0\% - 11.9\%$ | Below calibrated decision threshold |
| **WATCH** | $0.120 - 0.249$ | $12.0\% - 24.9\%$ | Just above decision threshold |
| **ELEVATED** | $0.250 - 0.449$ | $25.0\% - 44.9\%$ | Elevated mortality risk |
| **HIGH** | $0.450 - 1.000$ | $45.0\% - 100.0\%$ | High mortality risk |

- **Verification:** All 3 layers (`ai-engine/config/risk_config.py`, `backend/api/main.py`, `src/config/riskConfig.ts`) use identical thresholds and category mappings.

---

## 9. Patient Prediction Tests

Tested on real dataset patients:

| RecordID | Mortality Risk Prob | Risk Category | Top SHAP Factor | Data Completeness | Validity Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **132539** | $0.0057$ ($0.6\%$) | **LOW** | `GCS_last` ($15.0$) | High | Valid |
| **132541** | $0.0705$ ($7.1\%$) | **LOW** | `GCS_last` ($15.0$) | High | Valid |
| **132543** | $0.0074$ ($0.7\%$) | **LOW** | `GCS_last` ($15.0$) | Moderate | Valid |
| **132547** | $0.2814$ ($28.1\%$) | **ELEVATED** | `GCS_last` ($3.0$) | High | Valid |
| **132548** | $0.0611$ ($6.1\%$) | **LOW** | `GCS_last` ($15.0$) | High | Valid |

- **RecordID 132547 Specific Verification:**
  - Probability: **0.2814** ($28.14\%$)
  - Risk Category: **ELEVATED**
  - Key Drivers: Low `GCS_last` ($3.0$), low `Urine_mean` ($18.5\text{ ml/hr}$)

---

## 10. SHAP Explainability Audit

- **TreeExplainer Object:** Loaded from `ai-engine/models/shap_tree_explainer.joblib`.
- **Additivity Verification:**
  - Base Value (log-odds): $0.4425$
  - $\sum \text{SHAP Values}$: $-3.0221$
  - Computed Margin ($\text{Base} + \sum \text{SHAP}$): $-2.5795$
  - Sigmoid Output ($\sigma(-2.5795)$): $0.0705$ (matches predicted probability for patient #132541). **PASS**
- **Top Global Clinical Drivers:**
  1. `GCS_last` / `GCS_mean` (Glasgow Coma Scale)
  2. `Urine_mean` / `Urine_last` (Urinary Output)
  3. `BUN_last` (Blood Urea Nitrogen)
  4. `Age`
  5. `Lactate_last`

---

## 11. Robustness Testing

| Scenario | System Behavior | Prob Output | Result |
| :--- | :--- | :--- | :--- |
| **Missing Values (100% NaNs)** | Handled by XGBoost default paths | $0.0131$ ($1.3\%$) | **PASS** |
| **Extreme Outliers (HR=9999)** | Handled by artifact filter | $0.0162$ ($1.6\%$) | **PASS** |
| **Unknown Patient ID** | Returns clean 404 Exception | N/A | **PASS** |
| **Unordered Timestamps** | Sorted automatically by `Time_Hours` | Same | **PASS** |

---

## 12. API Testing

Tested endpoints on running FastAPI backend (`http://127.0.0.1:8000`):

| Endpoint | HTTP Status | Schema | Result |
| :--- | :--- | :--- | :--- |
| `GET /health` | 200 OK | `{ status, models_loaded, api_version }` | **PASS** |
| `GET /model/info` | 200 OK | `{ mortality_model, early_warning_engine }` | **PASS** |
| `GET /patient/{id}/risk` | 200 OK | `{ record_id, mortality_risk_probability, ... }` | **PASS** |
| `GET /patient/{id}/early-warning` | 200 OK | `{ trajectory_score, early_warning_level, ... }` | **PASS** |
| `GET /patient/{id}/explanation` | 200 OK | `{ shap_explanation, ... }` | **PASS** |
| `GET /rooms/risk-overview` | 200 OK | `{ rooms: [...] }` | **PASS** |
| `POST /predict` | 200 OK | `{ record_id, risk_score, ... }` | **PASS** |

---

## 13. Frontend/Backend Consistency

- **Single Source of Truth:** React frontend calls `fetchPatientRiskScore(id)` from `src/services/aiEngine.ts` which queries FastAPI `/patient/{id}/risk`.
- **No Independent Calculation:** Frontend displays backend probability and category directly without client-side recalculation.

---

## 14. Security Audit

- **Model Exposure:** Model `.joblib` binary files reside on backend server and are not exposed via static web routes.
- **CORS Configuration:** `CORSMiddleware` configured on FastAPI.
- **PII Exposure:** Raw patient names/addresses are not present in dataset (RecordIDs only).

---

## 15. Automated Tests

Executed complete Python test suite (`python -m unittest discover tests`):

```
----------------------------------------------------------------------
Ran 43 tests in 12.518s

OK
```

- **Passed:** 43
- **Failed:** 0
- **Skipped:** 0

---

## 16. Critical Issues

### **HIGH SEVERITY**
1. **High False Positive Rate (71% False Alarms at t=0.120):**
   - *Evidence:* Precision is 28.92% (118 False Positives vs 48 True Positives).
   - *Impact:* Clinicians receive approximately 2.4 false alarm warnings for every true mortality case caught.
   - *Recommendation:* Introduce a secondary confirmation layer or dual-threshold workflow (Screening threshold at $0.120$, Action threshold at $0.250$).

### **MEDIUM SEVERITY**
1. **Model Predicts Mortality, Not Short-Term Acute Events:**
   - *Evidence:* Target variable is `inHospitalDeath`.
   - *Impact:* Clinical documentation must clarify that the score reflects overall ICU in-hospital mortality probability, not a 2-hour deterioration alert.

---

## 17. Current ML Capability

```
===================================================================================
The current model estimates in-hospital mortality probability from ICU observations.
The current implementation does not provide validated hours-ahead deterioration prediction.
===================================================================================
```

---

## 18. Recommended Next ML Work

1. **Dual-Threshold Workflow Implementation:** Keep $t=0.120$ as high-sensitivity screening ($72.7\%$ recall) and $t=0.250$ as high-precision action threshold.
2. **Sequential Time-Series Modeling:** Train LSTM/GRU or Temporal Fusion Transformer models on 6-hour sliding windows if acute time-to-event datasets become available.
3. **SHAP Feature Grouping:** Aggregate 9 summary stats per vital sign into unified clinical vital impact scores for cleaner UI rendering.
