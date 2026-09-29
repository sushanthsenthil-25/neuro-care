# NeuroCare Model Card — Competition In-Hospital Mortality Risk Predictor

## 1. Model Details
- **Model Name**: NeuroCare Calibrated XGBoost ICU Predictor v2.0 (`Calibrated-XGBoost-ICU-v2`).
- **Developer**: NeuroCare AI Engineering Team.
- **Model Architecture**: Calibrated Extreme Gradient Boosting (`XGBClassifier` with `CalibratedClassifierCV`).
- **Target Variable**: `inHospitalDeath` (Binary: 0 = Survived / Discharged, 1 = In-Hospital Mortality).
- **Target Interpretation**: Predicts overall in-hospital mortality probability $P(\text{inHospitalDeath}=1)$. Does NOT predict acute minute-by-minute deterioration.

## 2. Intended Use
- **Evaluation**: Hackathon ML evaluation on unseen ICU patient cohorts.
- **Decision Support**: Clinical risk stratification assistant for intensive care unit clinicians.

## 3. Training & Validation Strategy
- **Cohort**: 4,000 adult ICU patients (PhysioNet Challenge dataset).
- **Patient Isolation**: 5-Fold Stratified K-Fold Cross Validation grouped by `RecordID`. Zero patient ID overlap across folds.
- **Feature Engineering**: 533 leakage-free temporal, windowed, recency, trajectory, and interaction features extracted strictly using observations up to cutoff $t \le 48.0$ hours.

## 4. Evaluation Performance Metrics
- **Out-of-Fold (OOF) CV AUROC**: `0.8454` (std: `0.0330`)
- **Out-of-Fold (OOF) CV AUPRC**: `0.4856`
- **Holdout Test AUROC**: `0.8192` (vs Baseline `0.7952`, +0.0240 improvement)
- **Holdout Test AUPRC**: `0.4572` (vs Baseline `0.4328`, +0.0244 improvement)
- **Holdout Test Brier Score**: `0.0992` (vs Baseline `0.1410`, significant calibration improvement)

## 5. Risk Controls & Safety Audit
- **Zero Future Leakage**: Observations $> 48.0$ hours are strictly excluded.
- **Zero Target Leakage**: Outcome labels are never referenced during feature engineering or inference.
- **RecordID Exclusion**: Patient `RecordID` is excluded from feature matrices to prevent patient ID memorization.
- **Robust Inference**: Handles missing parameters, irregular sampling, and missing sensors safely without crashing or outputting `NaN`/`inf`.
