import os
import json
import sys
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

# Path setup
SUBMISSION_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SUBMISSION_DIR.parent / "ai-engine"))

from features.advanced_feature_engineering import build_vectorized_advanced_features

MODEL_PATH = SUBMISSION_DIR / "models" / "final_model.joblib"
SCHEMA_PATH = SUBMISSION_DIR / "config" / "feature_schema.json"

class CompetitionEvaluatorPredictor:
    def __init__(self):
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
        self.model = joblib.load(MODEL_PATH)
        
        if not SCHEMA_PATH.exists():
            raise FileNotFoundError(f"Schema file not found at {SCHEMA_PATH}")
        with open(SCHEMA_PATH, "r") as f:
            self.schema = json.load(f)
            
        self.feature_names = self.schema["feature_names"]

    def predict_from_dataframes(self, df_obs: pd.DataFrame, df_patients: pd.DataFrame, max_time_hours: float = 48.0) -> pd.DataFrame:
        """
        Takes raw evaluation dataframes and returns prediction DataFrame with RecordID and prediction_probability.
        """
        # Extract advanced features (clean bounds applied internally)
        df_features = build_vectorized_advanced_features(df_obs, df_patients, max_time_hours=max_time_hours)
        df_features['RecordID'] = df_features['RecordID'].astype(str)

        patient_ids = df_features['RecordID'].values
        
        # 3. Align with feature schema
        X_eval = df_features.reindex(columns=self.feature_names).copy()

        # 4. Generate predictions
        probs = self.model.predict_proba(X_eval)[:, 1]

        # 5. Build clean output format
        res_df = pd.DataFrame({
            "patient_id": patient_ids,
            "prediction_probability": np.round(probs, 6)
        })

        return res_df

def predict_competition_submission(obs_parquet_or_df, patients_parquet_or_df, max_time_hours: float = 48.0) -> pd.DataFrame:
    predictor = CompetitionEvaluatorPredictor()
    
    if isinstance(obs_parquet_or_df, (str, Path)):
        df_obs = pd.read_parquet(obs_parquet_or_df)
    else:
        df_obs = obs_parquet_or_df

    if isinstance(patients_parquet_or_df, (str, Path)):
        df_pat = pd.read_parquet(patients_parquet_or_df)
    else:
        df_pat = patients_parquet_or_df

    return predictor.predict_from_dataframes(df_obs, df_pat, max_time_hours=max_time_hours)
