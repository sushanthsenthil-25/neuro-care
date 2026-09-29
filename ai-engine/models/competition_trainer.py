import os
import json
import sys
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import StratifiedKFold
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, average_precision_score, accuracy_score, recall_score,
    precision_score, f1_score, log_loss, brier_score_loss, confusion_matrix
)
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.ensemble import HistGradientBoostingClassifier

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from config.config import (
    PROCESSED_DIR, MODELS_DIR, REPORTS_DIR, RANDOM_SEED, PRIMARY_TARGET
)

def evaluate_predictions(y_true, y_prob, threshold=0.5):
    y_pred = (y_prob >= threshold).astype(int)
    cm = confusion_matrix(y_true, y_pred)
    if cm.shape == (2, 2):
        tn, fp, fn, tp = cm.ravel()
    else:
        tn, fp, fn, tp = 0, 0, 0, 0

    return {
        "auroc": float(roc_auc_score(y_true, y_prob)),
        "auprc": float(average_precision_score(y_true, y_prob)),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "sensitivity_recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "specificity": float(tn / (tn + fp + 1e-5)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, zero_division=0)),
        "log_loss": float(log_loss(y_true, y_prob)),
        "brier_score": float(brier_score_loss(y_true, y_prob)),
        "confusion_matrix": {"true_negative": int(tn), "false_positive": int(fp), "false_negative": int(fn), "true_positive": int(tp)}
    }

def train_and_benchmark_competition_models():
    print("==================================================")
    print("NEUROCARE — FINAL COMPETITION ML OPTIMIZATION ENGINE")
    print("==================================================")

    feat_file = PROCESSED_DIR / "advanced_icu_features.parquet"
    if not feat_file.exists():
        raise FileNotFoundError(f"Advanced features not found at {feat_file}.")

    df = pd.read_parquet(feat_file)
    df['RecordID'] = df['RecordID'].astype(str)

    # 1. Load baseline test split IDs to maintain identical untouched test set
    test_ids_file = PROCESSED_DIR / "test_ids.csv"
    if test_ids_file.exists():
        test_ids = pd.read_csv(test_ids_file)['RecordID'].astype(str).values
    else:
        test_ids = df.sample(frac=0.15, random_state=RANDOM_SEED)['RecordID'].values

    train_val_df = df[~df['RecordID'].isin(test_ids)].copy()
    test_df = df[df['RecordID'].isin(test_ids)].copy()

    feature_cols = [c for c in df.columns if c not in ['RecordID', PRIMARY_TARGET]]
    X_train_val = train_val_df[feature_cols].copy()
    y_train_val = train_val_df[PRIMARY_TARGET].to_numpy()
    train_val_records = train_val_df['RecordID'].values

    X_test = test_df[feature_cols].copy()
    y_test = test_df[PRIMARY_TARGET].to_numpy()

    print(f"Features Count: {len(feature_cols)}")
    print(f"Development Set: {len(X_train_val)} patients (Positives: {y_train_val.sum()})")
    print(f"Holdout Test Set: {len(X_test)} patients (Positives: {y_test.sum()})")

    # 2. Patient-Level 5-Fold Stratified K-Fold Cross Validation
    n_splits = 5
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_SEED)

    oof_preds_xgb = np.zeros(len(train_val_df))
    oof_preds_lgb = np.zeros(len(train_val_df))
    oof_preds_hgb = np.zeros(len(train_val_df))

    fold_metrics_xgb = []
    fold_metrics_lgb = []
    fold_metrics_hgb = []

    num_neg = (y_train_val == 0).sum()
    num_pos = (y_train_val == 1).sum()
    scale_pos_weight = float(num_neg) / float(num_pos + 1e-5)

    print("\n--- Executing 5-Fold Patient-Isolated Cross Validation ---")

    for fold, (train_idx, val_idx) in enumerate(skf.split(X_train_val, y_train_val)):
        X_tr, y_tr = X_train_val.iloc[train_idx], y_train_val[train_idx]
        X_va, y_va = X_train_val.iloc[val_idx], y_train_val[val_idx]

        # Verify Patient Isolation (Zero ID Overlap)
        tr_rec = set(train_val_records[train_idx])
        va_rec = set(train_val_records[val_idx])
        assert len(tr_rec.intersection(va_rec)) == 0, f"Patient leakage detected in fold {fold}!"

        # A. XGBoost
        model_xgb = XGBClassifier(
            n_estimators=350,
            max_depth=4,
            learning_rate=0.025,
            subsample=0.8,
            colsample_bytree=0.75,
            reg_alpha=0.1,
            reg_lambda=1.5,
            scale_pos_weight=scale_pos_weight,
            random_state=RANDOM_SEED + fold,
            eval_metric="logloss",
            early_stopping_rounds=40
        )
        model_xgb.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)
        val_prob_xgb = model_xgb.predict_proba(X_va)[:, 1]
        oof_preds_xgb[val_idx] = val_prob_xgb
        fold_metrics_xgb.append(roc_auc_score(y_va, val_prob_xgb))

        # B. LightGBM
        model_lgb = LGBMClassifier(
            n_estimators=350,
            max_depth=4,
            num_leaves=15,
            learning_rate=0.025,
            subsample=0.8,
            colsample_bytree=0.75,
            reg_alpha=0.1,
            reg_lambda=1.5,
            scale_pos_weight=scale_pos_weight,
            random_state=RANDOM_SEED + fold,
            verbose=-1
        )
        model_lgb.fit(X_tr, y_tr)
        val_prob_lgb = model_lgb.predict_proba(X_va)[:, 1]
        oof_preds_lgb[val_idx] = val_prob_lgb
        fold_metrics_lgb.append(roc_auc_score(y_va, val_prob_lgb))

        # C. HistGradientBoosting
        model_hgb = HistGradientBoostingClassifier(
            max_iter=250,
            max_depth=4,
            learning_rate=0.03,
            l2_regularization=1.0,
            class_weight="balanced",
            random_state=RANDOM_SEED + fold
        )
        model_hgb.fit(X_tr, y_tr)
        val_prob_hgb = model_hgb.predict_proba(X_va)[:, 1]
        oof_preds_hgb[val_idx] = val_prob_hgb
        fold_metrics_hgb.append(roc_auc_score(y_va, val_prob_hgb))

        print(f"Fold {fold+1}/{n_splits} | XGB AUROC: {fold_metrics_xgb[-1]:.4f} | LGB AUROC: {fold_metrics_lgb[-1]:.4f} | HGB AUROC: {fold_metrics_hgb[-1]:.4f}")

    # Calculate Out-Of-Fold (OOF) Metrics
    oof_res_xgb = evaluate_predictions(y_train_val, oof_preds_xgb)
    oof_res_lgb = evaluate_predictions(y_train_val, oof_preds_lgb)
    oof_res_hgb = evaluate_predictions(y_train_val, oof_preds_hgb)

    # 3. Ensemble Evaluation (Weighted Average on OOF)
    oof_preds_ensemble = 0.45 * oof_preds_xgb + 0.45 * oof_preds_lgb + 0.10 * oof_preds_hgb
    oof_res_ens = evaluate_predictions(y_train_val, oof_preds_ensemble)

    print("\n--- Out-Of-Fold (OOF) Summary ---")
    print(f"XGBoost OOF AUROC:  {oof_res_xgb['auroc']:.4f} (std: {np.std(fold_metrics_xgb):.4f}) | AUPRC: {oof_res_xgb['auprc']:.4f}")
    print(f"LightGBM OOF AUROC: {oof_res_lgb['auroc']:.4f} (std: {np.std(fold_metrics_lgb):.4f}) | AUPRC: {oof_res_lgb['auprc']:.4f}")
    print(f"HistGB OOF AUROC:   {oof_res_hgb['auroc']:.4f} (std: {np.std(fold_metrics_hgb):.4f}) | AUPRC: {oof_res_hgb['auprc']:.4f}")
    print(f"Ensemble OOF AUROC: {oof_res_ens['auroc']:.4f} | AUPRC: {oof_res_ens['auprc']:.4f}")

    # 4. Final Training & Evaluation on Holdout Test Set
    print("\n--- Training Final Candidate Models on Full Development Data ---")
    final_xgb = XGBClassifier(
        n_estimators=350, max_depth=4, learning_rate=0.025,
        subsample=0.8, colsample_bytree=0.75, reg_alpha=0.1, reg_lambda=1.5,
        scale_pos_weight=scale_pos_weight, random_state=RANDOM_SEED, eval_metric="logloss"
    )
    final_xgb.fit(X_train_val, y_train_val)

    final_lgb = LGBMClassifier(
        n_estimators=350, max_depth=4, num_leaves=15, learning_rate=0.025,
        subsample=0.8, colsample_bytree=0.75, reg_alpha=0.1, reg_lambda=1.5,
        scale_pos_weight=scale_pos_weight, random_state=RANDOM_SEED, verbose=-1
    )
    final_lgb.fit(X_train_val, y_train_val)

    final_hgb = HistGradientBoostingClassifier(
        max_iter=250, max_depth=4, learning_rate=0.03, l2_regularization=1.0,
        class_weight="balanced", random_state=RANDOM_SEED
    )
    final_hgb.fit(X_train_val, y_train_val)

    # Calibrated Classifier Check (5-fold calibration)
    calibrated_xgb = CalibratedClassifierCV(estimator=final_xgb, cv=5)
    calibrated_xgb.fit(X_train_val, y_train_val)

    # Predict on Holdout Test Set
    test_prob_xgb = final_xgb.predict_proba(X_test)[:, 1]
    test_prob_lgb = final_lgb.predict_proba(X_test)[:, 1]
    test_prob_hgb = final_hgb.predict_proba(X_test)[:, 1]
    test_prob_cal_xgb = calibrated_xgb.predict_proba(X_test)[:, 1]
    test_prob_ens = 0.45 * test_prob_xgb + 0.45 * test_prob_lgb + 0.10 * test_prob_hgb

    holdout_res_xgb = evaluate_predictions(y_test, test_prob_xgb)
    holdout_res_lgb = evaluate_predictions(y_test, test_prob_lgb)
    holdout_res_hgb = evaluate_predictions(y_test, test_prob_hgb)
    holdout_res_cal_xgb = evaluate_predictions(y_test, test_prob_cal_xgb)
    holdout_res_ens = evaluate_predictions(y_test, test_prob_ens)

    print("\n--- Holdout Test Set Evaluation ---")
    print(f"XGBoost Test AUROC:           {holdout_res_xgb['auroc']:.4f} | AUPRC: {holdout_res_xgb['auprc']:.4f} | Brier: {holdout_res_xgb['brier_score']:.4f}")
    print(f"LightGBM Test AUROC:          {holdout_res_lgb['auroc']:.4f} | AUPRC: {holdout_res_lgb['auprc']:.4f} | Brier: {holdout_res_lgb['brier_score']:.4f}")
    print(f"HistGB Test AUROC:            {holdout_res_hgb['auroc']:.4f} | AUPRC: {holdout_res_hgb['auprc']:.4f} | Brier: {holdout_res_hgb['brier_score']:.4f}")
    print(f"Calibrated XGB Test AUROC:    {holdout_res_cal_xgb['auroc']:.4f} | AUPRC: {holdout_res_cal_xgb['auprc']:.4f} | Brier: {holdout_res_cal_xgb['brier_score']:.4f}")
    print(f"Ensemble Test AUROC:          {holdout_res_ens['auroc']:.4f} | AUPRC: {holdout_res_ens['auprc']:.4f} | Brier: {holdout_res_ens['brier_score']:.4f}")

    # 5. Export Feature Schema & Models
    schema_path = MODELS_DIR / "feature_schema.json"
    with open(schema_path, "w") as f:
        json.dump({
            "feature_names": feature_cols,
            "feature_count": len(feature_cols),
            "primary_target": PRIMARY_TARGET,
            "max_time_hours": 48.0
        }, f, indent=2)

    config_path = MODELS_DIR / "training_config.json"
    with open(config_path, "w") as f:
        json.dump({
            "random_seed": RANDOM_SEED,
            "n_splits": n_splits,
            "scale_pos_weight": scale_pos_weight,
            "ensemble_weights": {"XGBoost": 0.45, "LightGBM": 0.45, "HistGB": 0.10}
        }, f, indent=2)

    # Save final models
    joblib.dump(final_xgb, MODELS_DIR / "final_competition_xgb.joblib")
    joblib.dump(final_lgb, MODELS_DIR / "final_competition_lgb.joblib")
    joblib.dump(final_hgb, MODELS_DIR / "final_competition_hgb.joblib")
    joblib.dump(calibrated_xgb, MODELS_DIR / "final_competition_model.joblib")

    # Full report
    report_data = {
        "oof_metrics": {
            "XGBoost": oof_res_xgb,
            "LightGBM": oof_res_lgb,
            "HistGB": oof_res_hgb,
            "Ensemble": oof_res_ens
        },
        "holdout_metrics": {
            "XGBoost": holdout_res_xgb,
            "LightGBM": holdout_res_lgb,
            "HistGB": holdout_res_hgb,
            "Calibrated_XGBoost": holdout_res_cal_xgb,
            "Ensemble": holdout_res_ens
        },
        "fold_auroc_std": {
            "XGBoost": float(np.std(fold_metrics_xgb)),
            "LightGBM": float(np.std(fold_metrics_lgb)),
            "HistGB": float(np.std(fold_metrics_hgb))
        }
    }

    report_path = REPORTS_DIR / "competition_model_report.json"
    with open(report_path, "w") as f:
        json.dump(report_data, f, indent=2)

    print(f"\nFinal competition models & schema exported to {MODELS_DIR}")
    print(f"Detailed competition report saved to {report_path}")

if __name__ == "__main__":
    train_and_benchmark_competition_models()
