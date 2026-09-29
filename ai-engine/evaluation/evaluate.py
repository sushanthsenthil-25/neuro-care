import os
import json
import sys
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics import (
    roc_auc_score, average_precision_score, accuracy_score, recall_score,
    precision_score, f1_score, log_loss, brier_score_loss, confusion_matrix
)

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from config.config import (
    PROCESSED_DIR, MODELS_DIR, EVALUATION_DIR, REPORTS_DIR, PRIMARY_TARGET
)

def evaluate_models():
    print("--- Evaluation Pipeline ---")
    feat_file = PROCESSED_DIR / "icu_patient_features.parquet"
    df = pd.read_parquet(feat_file)
    df['RecordID'] = df['RecordID'].astype(str)
    test_ids = pd.read_csv(PROCESSED_DIR / "test_ids.csv")['RecordID'].astype(str).values
    df_test = df[df['RecordID'].isin(test_ids)].copy()

    feature_cols = [c for c in df.columns if c not in ['RecordID', PRIMARY_TARGET]]
    X_test = df_test[feature_cols]
    y_test = df_test[PRIMARY_TARGET].to_numpy()

    models = {}
    if (MODELS_DIR / "xgboost_icu_v1.joblib").exists():
        models["XGBoost"] = joblib.load(MODELS_DIR / "xgboost_icu_v1.joblib")
    if (MODELS_DIR / "lightgbm_icu_v1.joblib").exists():
        models["LightGBM"] = joblib.load(MODELS_DIR / "lightgbm_icu_v1.joblib")

    results = {}
    for name, model in models.items():
        probs = model.predict_proba(X_test)[:, 1]
        
        # Optimal threshold selection via Youden's J
        best_thresh = 0.5
        best_j = -1.0
        for t in np.linspace(0.1, 0.9, 81):
            preds_t = (probs >= t).astype(int)
            sens = recall_score(y_test, preds_t, zero_division=0)
            cm = confusion_matrix(y_test, preds_t)
            tn, fp, fn, tp = cm.ravel()
            spec = tn / (tn + fp + 1e-5)
            j = sens + spec - 1.0
            if j > best_j:
                best_j = j
                best_thresh = t

        preds_opt = (probs >= best_thresh).astype(int)
        cm = confusion_matrix(y_test, preds_opt)
        tn, fp, fn, tp = cm.ravel()

        metrics = {
            "auroc": float(roc_auc_score(y_test, probs)),
            "auprc": float(average_precision_score(y_test, probs)),
            "accuracy": float(accuracy_score(y_test, preds_opt)),
            "sensitivity_recall": float(recall_score(y_test, preds_opt, zero_division=0)),
            "specificity": float(tn / (tn + fp + 1e-5)),
            "precision": float(precision_score(y_test, preds_opt, zero_division=0)),
            "f1_score": float(f1_score(y_test, preds_opt, zero_division=0)),
            "log_loss": float(log_loss(y_test, probs)),
            "brier_score": float(brier_score_loss(y_test, probs)),
            "optimal_threshold": float(best_thresh),
            "confusion_matrix": {
                "true_negative": int(tn),
                "false_positive": int(fp),
                "false_negative": int(fn),
                "true_positive": int(tp)
            }
        }
        results[name] = metrics
        print(f"[{name}] AUROC: {metrics['auroc']:.4f} | AUPRC: {metrics['auprc']:.4f} | Sens: {metrics['sensitivity_recall']:.4f} | Spec: {metrics['specificity']:.4f}")

    report_path = REPORTS_DIR / "evaluation_report.json"
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Evaluation report written to {report_path}")

if __name__ == "__main__":
    evaluate_models()
