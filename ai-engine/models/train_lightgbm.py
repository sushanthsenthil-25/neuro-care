import os
import json
import sys
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from lightgbm import LGBMClassifier

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from config.config import (
    PROCESSED_DIR, MODELS_DIR, RANDOM_SEED, PRIMARY_TARGET
)

def train_lightgbm_model():
    print("--- Starting LightGBM Training Pipeline ---")
    feat_file = PROCESSED_DIR / "icu_patient_features.parquet"
    df = pd.read_parquet(feat_file)
    df['RecordID'] = df['RecordID'].astype(str)
    train_ids = pd.read_csv(PROCESSED_DIR / "train_ids.csv")['RecordID'].astype(str).values
    val_ids = pd.read_csv(PROCESSED_DIR / "val_ids.csv")['RecordID'].astype(str).values
    test_ids = pd.read_csv(PROCESSED_DIR / "test_ids.csv")['RecordID'].astype(str).values

    feature_cols = [c for c in df.columns if c not in ['RecordID', PRIMARY_TARGET]]

    X_train = df[df['RecordID'].isin(train_ids)][feature_cols]
    y_train = df[df['RecordID'].isin(train_ids)][PRIMARY_TARGET].to_numpy()

    X_val = df[df['RecordID'].isin(val_ids)][feature_cols]
    y_val = df[df['RecordID'].isin(val_ids)][PRIMARY_TARGET].to_numpy()

    num_neg = (y_train == 0).sum()
    num_pos = (y_train == 1).sum()
    scale_pos_weight = float(num_neg) / float(num_pos + 1e-5)

    model = LGBMClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.03,
        scale_pos_weight=scale_pos_weight,
        random_state=RANDOM_SEED,
        verbose=-1
    )

    print("Training LightGBM Classifier...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[]
    )

    model_path = MODELS_DIR / "lightgbm_icu_v1.joblib"
    joblib.dump(model, model_path)
    print(f"Saved LightGBM model to {model_path}")

    metadata = {
        "model_type": "LightGBM",
        "feature_names": feature_cols,
        "num_features": len(feature_cols),
        "scale_pos_weight": scale_pos_weight
    }

    with open(MODELS_DIR / "lightgbm_model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print("LightGBM training completed successfully!")

if __name__ == "__main__":
    train_lightgbm_model()
