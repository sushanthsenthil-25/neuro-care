# NeuroCare ML Submission Instructions

## Overview
This package contains the submission-ready inference engine for the NeuroCare ICU Mortality Prediction Model.

## Directory Layout
```text
submission_ml/
├── inference/
│   └── predict.py               # Main prediction pipeline for evaluator
├── models/
│   └── final_model.joblib       # Winning Calibrated XGBoost model artifact
├── config/
│   ├── feature_schema.json      # Feature names & schema definition
│   └── training_config.json     # Hyperparameters & CV configuration
├── test_submission.py           # Simulation verification test
├── MODEL_CARD.md                # Comprehensive model card
└── SUBMISSION_README.md         # This instructions file
```

## Evaluator Quick Start

To generate predictions for unseen test patients:

```python
from submission_ml.inference.predict import predict_competition_submission

# Pass evaluation dataframes (observations & patients metadata)
df_predictions = predict_competition_submission(df_eval_observations, df_eval_patients, max_time_hours=48.0)

# Returns pandas DataFrame with columns:
# ['patient_id', 'prediction_probability']
```

## Running Verification Test

```bash
python submission_ml/test_submission.py
```
