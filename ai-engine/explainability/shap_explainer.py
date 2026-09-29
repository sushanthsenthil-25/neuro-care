import os
import json
import sys
from pathlib import Path

# Add global site-packages to sys.path for IDE analysis
site_pkg = r"C:\Users\susha\AppData\Local\Programs\Python\Python314\Lib\site-packages"
if site_pkg not in sys.path and os.path.exists(site_pkg):
    sys.path.insert(0, site_pkg)

import joblib  # type: ignore
import numpy as np  # type: ignore
import pandas as pd  # type: ignore
import shap  # type: ignore

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from config.config import (
    PROCESSED_DIR, MODELS_DIR, EVALUATION_DIR, PRIMARY_TARGET
)

def generate_shap_explanations():
    print("--- SHAP Explainability Generator ---")
    model_path = MODELS_DIR / "xgboost_icu_v1.joblib"
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found at {model_path}")

    model = joblib.load(model_path)
    feat_file = PROCESSED_DIR / "icu_patient_features.parquet"
    df = pd.read_parquet(feat_file)
    df['RecordID'] = df['RecordID'].astype(str)
    test_ids = pd.read_csv(PROCESSED_DIR / "test_ids.csv")['RecordID'].astype(str).values

    feature_cols = [c for c in df.columns if c not in ['RecordID', PRIMARY_TARGET]]
    X_test = df[df['RecordID'].isin(test_ids)][feature_cols]

    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X_test)

    # Save explainer object
    explainer_path = MODELS_DIR / "shap_tree_explainer.joblib"
    joblib.dump(explainer, explainer_path)
    print(f"SHAP TreeExplainer saved to {explainer_path}")

    # Compute global feature importance
    mean_abs_shap = np.abs(shap_values.values).mean(axis=0)
    importance_df = pd.DataFrame({
        'feature': feature_cols,
        'importance': mean_abs_shap
    }).sort_values('importance', ascending=False)

    top_features = importance_df.head(20).to_dict('records')
    with open(EVALUATION_DIR / "shap_top_features.json", "w") as f:
        json.dump(top_features, f, indent=2)

    print("SHAP analysis completed successfully!")

if __name__ == "__main__":
    generate_shap_explanations()
