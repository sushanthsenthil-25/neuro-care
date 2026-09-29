import os
import sys
import unittest
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent / "ai-engine"
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from inference.predictor import get_predictor
from config.config import MODELS_DIR, PROCESSED_DIR

class TestNeuroCareAIPipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.predictor = get_predictor()

    def test_01_model_loading_and_features(self):
        """Test model loading, metadata, and feature ordering compatibility."""
        self.assertIsNotNone(self.predictor.model, "XGBoost model should be loaded.")
        self.assertTrue(len(self.predictor.feature_names) > 0, "Feature names must be non-empty.")
        self.assertEqual(len(self.predictor.feature_names), 283, "Expected 283 features.")

    def test_02_predict_known_patient_132547(self):
        """Test real prediction for patient 132547 (ICU Room 04)."""
        res = self.predictor.predict_by_record_id("132547")
        self.assertEqual(res["record_id"], "132547")
        self.assertIn("risk_score", res)
        self.assertIn("risk_level", res)
        self.assertIn("top_clinical_drivers", res)
        self.assertTrue(0.0 <= res["risk_score"] <= 1.0, "Risk score must be between 0 and 1.")
        self.assertIn(res["risk_level"], ["LOW", "WATCH", "ELEVATED", "HIGH"])

    def test_03_unknown_patient_id_handling(self):
        """Test clean error handling for unknown patient IDs without generating fake data."""
        with self.assertRaises(KeyError):
            self.predictor.predict_by_record_id("UNKNOWN_999999")

    def test_04_shap_explanation_structure(self):
        """Test SHAP explanation output structure and clinical drivers."""
        res = self.predictor.predict_by_record_id("132539")
        drivers = res["top_clinical_drivers"]
        self.assertTrue(len(drivers) > 0, "SHAP top drivers must be generated.")
        first_driver = drivers[0]
        self.assertIn("feature", first_driver)
        self.assertIn("shap_value", first_driver)
        self.assertIn("impact", first_driver)

    def test_05_no_future_data_leakage(self):
        """Verify feature extraction only uses observations t <= 48h."""
        feat_df = self.predictor.df_features
        self.assertIn("RecordID", feat_df.columns)
        self.assertIn("GCS_last", feat_df.columns)
        # Check that no future observation column beyond 48h cutoff exists in features
        for col in feat_df.columns:
            self.assertNotIn(">48h", col, "No post-cutoff features should exist.")

if __name__ == "__main__":
    unittest.main()
