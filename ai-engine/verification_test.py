import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from config.config import PROCESSED_DIR, MODELS_DIR, EVALUATION_DIR, REPORTS_DIR, PRIMARY_TARGET
from inference.predictor import get_predictor

def verify_model_and_test_patient():
    print("=== Step 1: Model Verification & Evaluation Report Inspection ===")
    
    # Load evaluation report
    report_file = REPORTS_DIR / "evaluation_report.json"
    with open(report_file, "r") as f:
        eval_report = json.load(f)

    print("Saved Evaluation Report Metrics:")
    print(json.dumps(eval_report, indent=2))

    # Load metadata
    with open(MODELS_DIR / "xgboost_model_metadata.json", "r") as f:
        xgb_meta = json.load(f)

    # Load top SHAP features
    with open(EVALUATION_DIR / "shap_top_features.json", "r") as f:
        shap_features = json.load(f)

    print("\nTop 15 SHAP Features:")
    for idx, item in enumerate(shap_features[:15], 1):
        print(f"{idx:2d}. {item['feature']:<30} (SHAP Importance: {item['importance']:.4f})")

    print("\n=== Step 2: Testing Real Patient (RecordID: 132547 - ICU Room 04) ===")
    predictor = get_predictor()
    res_132547 = predictor.predict_by_record_id("132547")
    print("\nPrediction Output for RecordID 132547:")
    print(json.dumps(res_132547, indent=2))

    # Test another patient 132539 (ICU Room 01)
    res_132539 = predictor.predict_by_record_id("132539")
    print("\nPrediction Output for RecordID 132539:")
    print(json.dumps(res_132539, indent=2))

    return {
        "evaluation_report": eval_report,
        "metadata": xgb_meta,
        "patient_132547_result": res_132547
    }

if __name__ == "__main__":
    verify_model_and_test_patient()
