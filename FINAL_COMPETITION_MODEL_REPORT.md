# Final Competition Model Report — NeuroCare Calibrated XGBoost v2.0

## 1. Model & System Identification
- **Model Name**: NeuroCare Calibrated XGBoost ICU Predictor (`Calibrated-XGBoost-ICU-v2`).
- **Version**: `NeuroCare-Competition-v2.0`
- **Target**: `inHospitalDeath` (Binary target: 0 = Survived, 1 = In-Hospital Mortality).
- **Target Definition**: Predicted probability of in-hospital mortality $P(\text{inHospitalDeath}=1) \in [0.0, 1.0]$.
- **Features Count**: 533 leakage-free temporal, windowed, recency, trajectory, and interaction features.
- **Training Population**: 2,720 development patients (used in 5-fold cross validation).
- **Validation Population**: 544 patients per fold in 5-fold CV.
- **Holdout Test Population**: 480 untouched test patients.
- **Model File**: `submission_ml/models/final_model.joblib`
- **Feature Schema File**: `submission_ml/config/feature_schema.json`
- **Preprocessing Version**: `v2.0` (vectorized artifact bounds cleaner + DuckDB window extractor).

## 2. Baseline vs Final Model Comparison

| Metric | Previous Baseline | Final Model | Difference |
| :--- | :--- | :--- | :--- |
| **AUROC** | 0.7952 | **0.8192** | **+0.0240** |
| **AUPRC** | 0.4328 | **0.4572** | **+0.0244** |
| **Brier Score** | 0.1410 | **0.0992** | **-0.0418 (Calibration Improvement)** |
| **Log Loss** | 0.3842 | **0.3341** | **-0.0501** |
| **Precision** | 0.4571 | **0.4898** | **+0.0327** |
| **Recall / Sensitivity** | 0.7273 | **0.7273** | **0.0000** |
| **Specificity** | 0.7150 | **0.7585** | **+0.0435** |
| **F1 Score** | 0.5614 | **0.5854** | **+0.0240** |
| **CV Mean AUROC** | 0.7952 | **0.8454** | **+0.0502** |
| **CV AUROC Std** | N/A | **0.0330** | **Tight Fold Stability** |

## 3. Overfitting Audit
- **Development OOF CV AUROC**: `0.8454`
- **Holdout Test AUROC**: `0.8192`
- **Variance Gap**: `0.0262` (within 1-standard deviation expectation of fold variance `0.0330`).
- **Overfitting Assessment**: PASS. No extreme training-to-validation performance collapse observed.

## 4. Leakage Control Audit
- [x] **No Patient Overlap**: Verified zero overlap across training, validation, and test patient `RecordID` sets.
- [x] **No Future Observations**: Observations filtered strictly at $t \le 48.0$ hours.
- [x] **No Outcome Leakage**: Outcome labels are never loaded or accessed during inference.
- [x] **RecordID Excluded**: `RecordID` is excluded from all model feature matrices.
- [x] **No Test Tuning**: All hyperparameter selection and calibration derived exclusively from OOF cross-validation.

## 5. Prediction Distribution Analysis
- **Min Probability**: `0.0397`
- **Max Probability**: `0.7704`
- **Mean Probability**: `0.1332`
- **Median Probability**: `0.0592`
- **Standard Deviation**: `0.1562`
- **Percentiles**:
  - `1%`: `0.0405`
  - `5%`: `0.0415`
  - `25%`: `0.0449`
  - `50%`: `0.0592`
  - `75%`: `0.1391`
  - `95%`: `0.5457`
  - `99%`: `0.6952`

## 6. Class Separation Diagnostic
- **Mean Positive Class Probability**: `0.2925` (Median: `0.2178`)
- **Mean Negative Class Probability**: `0.1078` (Median: `0.0549`)
- **Separation Ratio**: Positive class probability is $\approx 2.7\times$ higher than negative class on average.

## 7. Multi-Seed Model Stability
- **Seed 42 OOF AUROC**: `0.8432` | AUPRC: `0.4885`
- **Seed 123 OOF AUROC**: `0.8515` | AUPRC: `0.4926`
- **Seed 2026 OOF AUROC**: `0.8536` | AUPRC: `0.5037`
- **Multi-Seed Summary**: Mean AUROC = `0.8494` (std: `0.0045`), Mean AUPRC = `0.4949` (std: `0.0064`). Low seed variance confirms high stability.

## 8. Inference Benchmark
- **Batch Inference Time (480 Patients)**: `209.52 ms`
- **Per-Patient Inference Speed**: `0.44 ms / patient`
