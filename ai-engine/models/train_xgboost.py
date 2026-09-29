import os
import json
import sys
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from config.config import (
    PROCESSED_DIR, MODELS_DIR, RANDOM_SEED, TRAIN_RATIO, VAL_RATIO, TEST_RATIO, PRIMARY_TARGET
)

def train_xgboost_model():
    print("--- Starting XGBoost Training Pipeline ---")
    feat_file = PROCESSED_DIR / "icu_patient_features.parquet"
    if not feat_file.exists():
        raise FileNotFoundError(f"Feature file not found at {feat_file}. Run feature_engineering.py first.")

    df = pd.read_parquet(feat_file)
    print(f"Loaded feature matrix: {df.shape[0]} patients, {df.shape[1]} columns")

    # Drop target and RecordID from X
    feature_cols = [c for c in df.columns if c not in ['RecordID', PRIMARY_TARGET]]
    X = df[feature_cols]
    y = df[PRIMARY_TARGET].to_numpy()
    patient_ids = np.array(df['RecordID'].values)
    train_val_ids, test_ids, y_train_val, y_test = train_test_split(
        patient_ids, y, test_size=TEST_RATIO, random_state=RANDOM_SEED, stratify=y
    )

    val_relative_ratio = VAL_RATIO / (TRAIN_RATIO + VAL_RATIO)
    train_ids, val_ids, y_train, y_val = train_test_split(
        train_val_ids, y_train_val, test_size=val_relative_ratio, random_state=RANDOM_SEED, stratify=y_train_val
    )

    # Save split IDs for reproducibility
    pd.Series(train_ids).to_csv(PROCESSED_DIR / "train_ids.csv", index=False, header=['RecordID'])
    pd.Series(val_ids).to_csv(PROCESSED_DIR / "val_ids.csv", index=False, header=['RecordID'])
    pd.Series(test_ids).to_csv(PROCESSED_DIR / "test_ids.csv", index=False, header=['RecordID'])

    X_train = df[df['RecordID'].isin(train_ids)][feature_cols]
    X_val = df[df['RecordID'].isin(val_ids)][feature_cols]
    X_test = df[df['RecordID'].isin(test_ids)][feature_cols]

    y_train = df[df['RecordID'].isin(train_ids)][PRIMARY_TARGET]
    y_val = df[df['RecordID'].isin(val_ids)][PRIMARY_TARGET]
    y_test = df[df['RecordID'].isin(test_ids)][PRIMARY_TARGET]

    print(f"Train set: {len(X_train)} samples (Positives: {y_train.sum()})")
    print(f"Val set:   {len(X_val)} samples (Positives: {y_val.sum()})")
    print(f"Test set:  {len(X_test)} samples (Positives: {y_test.sum()})")

    # Compute scale_pos_weight for class imbalance
    num_neg = (y_train == 0).sum()
    num_pos = (y_train == 1).sum()
    scale_pos_weight = float(num_neg) / float(num_pos + 1e-5)

    model = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        random_state=RANDOM_SEED,
        eval_metric="logloss",
        early_stopping_rounds=30
    )

    print("Training XGBoost Classifier...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train), (X_val, y_val)],
        verbose=50
    )

    model_path = MODELS_DIR / "xgboost_icu_v1.joblib"
    joblib.dump(model, model_path)
    print(f"Saved XGBoost model to {model_path}")

    # Save feature metadata
    metadata = {
        "model_type": "XGBoost",
        "feature_names": feature_cols,
        "num_features": len(feature_cols),
        "scale_pos_weight": scale_pos_weight,
        "n_train": len(X_train),
        "n_val": len(X_val),
        "n_test": len(X_test),
        "primary_target": PRIMARY_TARGET
    }

    with open(MODELS_DIR / "xgboost_model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print("XGBoost training completed successfully!")

if __name__ == "__main__":
    train_xgboost_model()
