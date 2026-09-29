import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from config.config import MODELS_DIR, PROCESSED_DIR
from config.risk_config import MORTALITY_MODEL_CONFIG, get_mortality_risk_category

class ICURiskPredictor:
    def __init__(self):
        self.model_path = MODELS_DIR / "xgboost_icu_v1.joblib"
        self.explainer_path = MODELS_DIR / "shap_tree_explainer.joblib"
        self.meta_path = MODELS_DIR / "xgboost_model_metadata.json"

        if not self.model_path.exists():
            raise FileNotFoundError(f"Model file missing at {self.model_path}")

        self.model = joblib.load(self.model_path)
        self.explainer = joblib.load(self.explainer_path) if self.explainer_path.exists() else None
        
        with open(self.meta_path, "r") as f:
            self.metadata = json.load(f)
            
        self.feature_names = self.metadata["feature_names"]
        
        # Load dataset cache for fast record lookup
        self.feat_file = PROCESSED_DIR / "icu_patient_features.parquet"
        if self.feat_file.exists():
            self.df_features = pd.read_parquet(self.feat_file)
            self.df_features['RecordID'] = self.df_features['RecordID'].astype(str)
        else:
            self.df_features = pd.DataFrame()

    def predict_by_record_id(self, record_id: str):
        import datetime
        import logging
        logger = logging.getLogger("NeuroCareML")

        record_id = str(record_id)
        if self.df_features.empty:
            raise KeyError(f"Feature store empty")

        row = self.df_features[self.df_features['RecordID'].astype(str) == str(record_id)]
        if row.empty:
            raise KeyError(f"Patient RecordID {record_id} not found")

        X_patient = row[self.feature_names]
        
        # 1. Feature availability & missingness calculation
        total_feats = len(self.feature_names)
        missing_count = int(X_patient.isnull().sum().sum())
        missing_ratio = float(missing_count) / float(total_feats) if total_feats > 0 else 0.0

        if missing_ratio < 0.15:
            data_quality = "GOOD"
        elif missing_ratio < 0.40:
            data_quality = "DEGRADED"
        else:
            data_quality = "POOR"

        # 2. Model probability inference & strict validation
        prob_raw = self.model.predict_proba(X_patient)[0, 1]
        prob = float(prob_raw)

        if np.isnan(prob) or np.isinf(prob) or prob < 0.0 or prob > 1.0:
            raise ValueError(f"Invalid model prediction probability computed for RecordID {record_id}: {prob}")

        risk_level = get_mortality_risk_category(prob)
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # 3. Compute SHAP feature contributions using EXACT same X_patient vector
        top_drivers = []
        if self.explainer is not None:
            shap_vals = self.explainer(X_patient).values[0]
            top_indices = np.argsort(np.abs(shap_vals))[::-1][:5]
            
            for idx in top_indices:
                feat_name = self.feature_names[idx]
                val = float(X_patient.iloc[0, idx])
                shap_v = float(shap_vals[idx])
                
                impact_label = "higher_contribution" if shap_v > 0 else "lower_contribution"
                direction_label = "increases" if shap_v > 0 else "decreases"
                direction_text = "higher contribution to predicted mortality risk" if shap_v > 0 else "lower contribution to predicted mortality risk"
                
                top_drivers.append({
                    "feature": feat_name,
                    "value": round(val, 2) if not np.isnan(val) else None,
                    "shap_value": round(shap_v, 4),
                    "contribution": round(shap_v, 4),
                    "direction": direction_label,
                    "impact": impact_label,
                    "clinical_significance": f"{feat_name} ({val if not np.isnan(val) else 'N/A'}) has {direction_text} (SHAP contribution: {shap_v:+.4f})."
                })

        feat_dict = {}
        for k, v in row.iloc[0].to_dict().items():
            if pd.notnull(v):
                feat_dict[k] = float(v) if isinstance(v, (int, float, np.number)) else v
            else:
                feat_dict[k] = None

        # 4. Safe audit log
        logger.info(f"[ML_AUDIT_LOG] RecordID={record_id} Prob={prob:.4f} Level={risk_level} Version={MORTALITY_MODEL_CONFIG['model_version']} Quality={data_quality} Cutoff=48.0h")

        res_obj = {
            "record_id": record_id,
            "patient_id": record_id,
            "mortality_risk_probability": round(prob, 4),
            "mortality_risk_percentage": round(prob * 100, 1),
            "mortality_risk_category": risk_level,
            "risk_score": round(prob, 4), # Backward compatibility
            "risk_percentage": round(prob * 100, 1),
            "risk_level": risk_level,
            "decision_threshold": MORTALITY_MODEL_CONFIG["decision_threshold"],
            "model_target": MORTALITY_MODEL_CONFIG["primary_target"],
            "model_target_label": "Predicted in-hospital mortality risk",
            "top_clinical_drivers": top_drivers,
            "features": feat_dict,
            "model_version": MORTALITY_MODEL_CONFIG["model_version"],
            "evaluation_auroc": MORTALITY_MODEL_CONFIG["eval_auroc"],
            "generated_at": now_iso,
            "data_cutoff": "48.0 Hours ICU Admission Window",
            "feature_count": total_feats,
            "missing_feature_count": missing_count,
            "data_quality": data_quality,
            "disclaimer": "Decision-support prototype — not a substitute for clinical judgment."
        }

        # 5. Record prediction in Alert Engine & history store
        try:
            from inference.alert_engine import get_alert_engine
            get_alert_engine().record_prediction(res_obj)
        except Exception as e:
            logger.warning(f"Could not record prediction snapshot in alert engine: {e}")

        return res_obj

predictor_instance = None

def get_predictor():
    global predictor_instance
    if predictor_instance is None:
        predictor_instance = ICURiskPredictor()
    return predictor_instance
