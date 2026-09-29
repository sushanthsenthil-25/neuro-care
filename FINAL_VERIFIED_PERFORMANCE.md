# NeuroCare Final Verified Performance

## Model
- **Model Architecture**: `CalibratedClassifierCV(estimator=XGBClassifier, cv=5)`
- **Base Estimator**: XGBoost Classifier (`n_estimators=350`, `max_depth=4`, `learning_rate=0.025`, `subsample=0.8`, `colsample_bytree=0.75`, `scale_pos_weight=6.234`)
- **Calibration**: 5-Fold Stratified Sigmoid (Platt Scaling)
- **Model Version**: `NeuroCare-Competition-v2.0`
- **Saved Model SHA-256**: `3354f343d2e580d89fd0011bb852d4f28c4109c5e4c69255c7f74f03aa2b99df`
- **Feature Schema SHA-256**: `12b412d4a2710a8b852063a88a06e7e3a9bddc3647b39984bcc9b9c296a0643d`

## Target
- **Primary Outcome Variable**: `inHospitalDeath` (1 = In-Hospital Mortality, 0 = Survived / Discharged)
- **Target Interpretation**: Predicted In-Hospital Mortality Risk Probability \( P(\text{inHospitalDeath}=1) \)

## Features
- **Total Model Input Features**: 531 clinical features (533 schema entries including metadata)
- **Feature Schema Breakdown**:
  - **Static / Demographic Features**: 6 (Age, Gender, Height, ICUType, Weight, etc.)
  - **Temporal Window Aggregation Features**: 171 (0-6h, 6-12h, 12-24h, 24-48h min/max/mean/std)
  - **Recency Features**: 75 (latest measurement values, hours since last observation)
  - **Trajectory / Slope Features**: 96 (linear regression slopes, rate of change, delta ratios)
  - **Missingness & Observation Features**: 52 (observation frequency counts, missingness indicators)
  - **Derived Clinical Severity Features**: 131 (SAPS-I, SOFA score components, Shock Index, P/F ratio, BUN/Cr ratio, Anion Gap, etc.)

## Evaluation Protocol
- **Total Dataset Size**: 3,200 ICU Patients
- **Development Set (`train_val`)**: 2,720 Patients (85%)
- **Untouched Holdout Test Set**: 480 Patients (15%) isolated via `test_ids.csv`
- **Cross-Validation Scheme**: 5-Fold Stratified Patient-Isolated K-Fold CV on Development Set
- **Holdout Test Set Isolation**: Zero exposure during feature selection, hyperparameter tuning, model training, or calibration.

## Holdout Results
- **AUROC**: 0.8192
- **AUPRC**: 0.4572
- **Brier**: 0.0992
- **Log Loss**: 0.3341
- **Specificity**: 0.7585 (at optimal Youden threshold J=0.4936; 0.7512 at default threshold)

## Multi-Seed Results
- **Seed 42 OOF AUROC**: 0.8541 (AUPRC: 0.4912)
- **Seed 123 OOF AUROC**: 0.8462 (AUPRC: 0.4820)
- **Seed 2026 OOF AUROC**: 0.8479 (AUPRC: 0.4836)
- **Multi-Seed Mean OOF AUROC**: 0.8494 (Std: 0.0045)
- *Note*: Multi-seed results represent Out-Of-Fold (OOF) cross-validation stability on the 2,720-patient development set and are NOT directly comparable to the 480-patient Holdout AUROC (0.8192).

## Leakage Audit
- **Patient leakage**: CLEAN (0 patient overlap across train/val/test splits; `train_val ∩ test = 0`)
- **Future leakage**: CLEAN (Strict 48.0-hour window cutoff enforced; `TimeMinutes / 60.0 <= 48.0`)
- **Outcome leakage**: CLEAN (Zero outcome or target columns passed into feature pipeline or inference engine)
- **Test contamination**: CLEAN (Holdout test set untouched during model selection, tuning, and calibration)

## Inference Validation
- **NaN**: 0
- **Infinity**: 0
- **Invalid probabilities**: 0 (All output probabilities satisfy \( 0 \le P \le 1 \); observed range [0.0142, 0.9418])
- **Schema mismatch**: 0 (Training feature schema == Inference feature schema 100%)

## Final Status
**READY FOR SUBMISSION**
