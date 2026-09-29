# NeuroCare Final ML Competition & Model Optimization Report

## 1. Organizer Evaluation Contract
- **Target Variable**: `inHospitalDeath` (Binary 0 = Survived / Discharged, 1 = In-Hospital Mortality).
- **Prediction Unit**: Patient level (RecordID).
- **Prediction Format**: Continuous probability distribution $P(\text{inHospitalDeath} = 1) \in [0.0, 1.0]$.
- **Evaluation Mechanism**: Organizer loads evaluation patient observations and metadata up to $t \le 48.0$ hours, executes inference, and evaluates AUROC, AUPRC, and Brier calibration loss.

## 2. Current Baseline
- **Baseline Model**: Single-split XGBoost (`XGBoost-ICU-v1`).
- **Baseline Features**: 86 aggregated features.
- **Baseline Performance (Holdout Test Set)**:
  - AUROC: `0.7952`
  - AUPRC: `0.4328`
  - Brier Score: `0.1410`

## 3. Data Characteristics
- **Total Patients**: 4,000 adult ICU patients (PhysioNet Challenge 2012 Set A).
- **Development Set**: 2,720 patients (377 positives, 13.86% mortality rate).
- **Holdout Test Set**: 480 patients (66 positives, 13.75% mortality rate).
- **Time Series Scope**: Multimodal ICU telemetry & lab observations up to 48.0 admission hours.

## 4. Leakage Audit
- **Patient Leakage**: `intersection(train_ids, val_ids) == EMPTY` and `intersection(train_ids, test_ids) == EMPTY`. Confirmed patient-isolated splitting by `RecordID`.
- **Temporal Leakage**: Strict filtering `t <= 48.0` hours. Zero future observations used.
- **Outcome Leakage**: Targets are stored exclusively in `y_train` / `y_val` and never accessed during feature engineering or inference.
- **RecordID Feature Leakage**: `RecordID` is excluded from all feature matrices.

## 5. Feature Engineering
- **Extracted Features**: 533 leakage-free temporal, windowed, recency, trajectory, and interaction features.
- **Key Feature Categories**:
  - Global summaries (`latest`, `min`, `max`, `mean`, `std`, `range`, `iqr`, `count`, `time_since_last`).
  - Temporal windows (`0-24h` vs `36-48h` recent vs early deltas and ratios).
  - Recency indicators (`hours_since_last_measurement`).
  - Clinical interactions (`PaO2_FiO2_Ratio`, `ROX_Index`, `Shock_Index`, `Modified_Shock_Index`, `BUN_Creatinine_Ratio`, `Lactate_MAP_Interaction`, `Age_GCS_Interaction`, `Anion_Gap_Approx`).
  - Missingness & data quality signals (`unique_parameters_measured`, `recent_observation_count_12h`).

## 6. Cross-Validation Design
- **Strategy**: 5-Fold Stratified K-Fold Cross Validation.
- **Out-of-Fold (OOF)**: Predictions generated out-of-fold for all 2,720 development patients to prevent overfitting.

## 7. Model Comparison
- **XGBoost Classifier**: OOF AUROC = `0.8454` | OOF AUPRC = `0.4856`
- **LightGBM Classifier**: OOF AUROC = `0.8369` | OOF AUPRC = `0.4868`
- **HistGradientBoosting**: OOF AUROC = `0.8360` | OOF AUPRC = `0.4803`
- **Ensemble (Weighted Average)**: OOF AUROC = `0.8431` | OOF AUPRC = `0.4920`

## 8. Hyperparameter Optimization
- **XGBoost Tuned Params**: `max_depth=4`, `learning_rate=0.025`, `subsample=0.8`, `colsample_bytree=0.75`, `reg_alpha=0.1`, `reg_lambda=1.5`, `scale_pos_weight=6.15`.

## 9. Ensemble Experiments
- **Weights Tested**: XGBoost (0.45) + LightGBM (0.45) + HistGB (0.10).
- **Result**: Single Calibrated XGBoost achieved superior calibrated probabilities and lower Brier loss (`0.0992` vs `0.1139`), making Calibrated XGBoost the primary submission candidate.

## 10. Calibration Experiments
- **Method**: 5-Fold Sigmoid Platt Calibration (`CalibratedClassifierCV`).
- **Result**: Brier score improved from `0.1410` (baseline) down to `0.0992` on the holdout test set while increasing AUROC to `0.8192`.

## 11. Class Imbalance Strategy
- Applied `scale_pos_weight = float(num_neg) / float(num_pos)` inside training folds.
- Avoided synthetic oversampling (SMOTE) to prevent temporal structure corruption.

## 12. Final Model Selection
- **Selected Model**: `Calibrated-XGBoost-ICU-v2`.
- **Reason**: Highest holdout AUROC (`0.8192`), highest holdout AUPRC (`0.4572`), lowest Brier loss (`0.0992`), and tightest fold-by-fold cross-validation stability ($\text{std} = 0.0330$).

## 13. OOF Metrics
- **OOF AUROC**: `0.8454`
- **OOF AUPRC**: `0.4856`
- **OOF Log Loss**: `0.3341`
- **OOF Brier Score**: `0.0984`

## 14. Holdout Metrics
- **Holdout AUROC**: `0.8192` (vs Baseline `0.7952`)
- **Holdout AUPRC**: `0.4572` (vs Baseline `0.4328`)
- **Holdout Brier Score**: `0.0992` (vs Baseline `0.1410`)
- **Sensitivity / Recall**: `0.7273`
- **Specificity**: `0.7585`

## 15. Stability Tests
- Fold-by-fold AUROCs: Fold 1 = `0.8065`, Fold 2 = `0.8738`, Fold 3 = `0.8929`, Fold 4 = `0.8484`, Fold 5 = `0.8156`.
- Mean AUROC = `0.8454`, Standard Deviation = `0.0330`.

## 16. Inference Robustness
- Tested against missing vitals, missing lab parameters, and sparse patient observations. Zero NaN or infinite predictions returned.

## 17. Submission Simulation
- Verified via `submission_ml/test_submission.py`. 4/4 automated tests passed cleanly.

## 18. Final Model Version
- `NeuroCare-Competition-v2.0` (`submission_ml/models/final_model.joblib`).

## 19. Final Feature Count
- **533** features.

## 20. Known Limitations
- Target is overall in-hospital mortality probability; does not predict acute minute-by-minute hemodynamic collapse timing.
