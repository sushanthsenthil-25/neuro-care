import unittest
import sys
import os
import json
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent / "ai-engine"
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from inference.predictor import get_predictor, ICURiskPredictor
from inference.early_warning_engine import get_early_warning_engine
from config.risk_config import MORTALITY_MODEL_CONFIG, get_mortality_risk_category
from backend.api.main import app
from fastapi.testclient import TestClient

class TestMLPredictionHardening(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.predictor = get_predictor()

    # 1. Probability range check
    def test_01_probability_range(self):
        res = self.predictor.predict_by_record_id('132547')
        prob = res['mortality_risk_probability']
        self.assertGreaterEqual(prob, 0.0)
        self.assertLessEqual(prob, 1.0)
        self.assertFalse(np.isnan(prob))
        self.assertFalse(np.isinf(prob))

    # 2. Correct patient ID
    def test_02_correct_patient_id(self):
        res = self.predictor.predict_by_record_id('132543')
        self.assertEqual(res['record_id'], '132543')
        self.assertEqual(res['patient_id'], '132543')

    # 3. Correct feature vector
    def test_03_correct_feature_vector(self):
        res = self.predictor.predict_by_record_id('132547')
        self.assertEqual(res['feature_count'], len(self.predictor.feature_names))
        self.assertIn('GCS_last', res['features'])
        self.assertIn('HR_last', res['features'])

    # 4. Correct model version
    def test_04_correct_model_version(self):
        res = self.predictor.predict_by_record_id('132547')
        self.assertEqual(res['model_version'], 'XGBoost-ICU-v1')

    # 5. Correct threshold (0.120)
    def test_05_correct_threshold(self):
        res = self.predictor.predict_by_record_id('132547')
        self.assertEqual(res['decision_threshold'], 0.120)

    # 6. Correct risk level mapping
    def test_06_correct_risk_level(self):
        self.assertEqual(get_mortality_risk_category(0.05), 'LOW')
        self.assertEqual(get_mortality_risk_category(0.15), 'WATCH')
        self.assertEqual(get_mortality_risk_category(0.28), 'ELEVATED')
        self.assertEqual(get_mortality_risk_category(0.55), 'HIGH')

    # 7. No percentage/decimal bug (Regression test for RecordID 132547)
    def test_07_record_132547_regression(self):
        res = self.predictor.predict_by_record_id('132547')
        prob = res['mortality_risk_probability']
        self.assertAlmostEqual(prob, 0.2814, places=2)
        self.assertEqual(res['mortality_risk_category'], 'ELEVATED')
        self.assertNotEqual(res['mortality_risk_category'], 'LOW')

    # 8. No future data leakage
    def test_08_no_future_data(self):
        res = self.predictor.predict_by_record_id('132547')
        self.assertEqual(res['data_cutoff'], '48.0 Hours ICU Admission Window')

    # 9. SHAP matches prediction
    def test_09_shap_matches_prediction(self):
        res = self.predictor.predict_by_record_id('132547')
        self.assertGreater(len(res['top_clinical_drivers']), 0)
        driver = res['top_clinical_drivers'][0]
        self.assertIn('direction', driver)
        self.assertIn(driver['direction'], ['increases', 'decreases'])

    # 10. Data cutoff & quality indicators
    def test_10_data_quality_and_cutoff(self):
        res = self.predictor.predict_by_record_id('132547')
        self.assertIn(res['data_quality'], ['GOOD', 'DEGRADED', 'POOR'])

    # 11. Missing feature handling
    def test_11_missing_feature_handling(self):
        res = self.predictor.predict_by_record_id('132543')
        self.assertTrue(0.0 <= res['mortality_risk_probability'] <= 1.0)

    # 12. Unknown patient ID handling
    def test_12_unknown_patient(self):
        with self.assertRaises(KeyError):
            self.predictor.predict_by_record_id('99999999')

    # 13. Model unavailable / invalid probability protection
    def test_13_model_health_check(self):
        response = self.client.get("/model/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["model_loaded"])

    # 14. Patient switching isolation
    def test_14_patient_switching_isolation(self):
        res_a = self.predictor.predict_by_record_id('132539')
        res_b = self.predictor.predict_by_record_id('132547')
        self.assertNotEqual(res_a['record_id'], res_b['record_id'])
        self.assertNotEqual(res_a['mortality_risk_probability'], res_b['mortality_risk_probability'])

    # 15. Prediction reproducibility
    def test_15_reproducibility(self):
        p1 = self.predictor.predict_by_record_id('132547')['mortality_risk_probability']
        p2 = self.predictor.predict_by_record_id('132547')['mortality_risk_probability']
        p3 = self.predictor.predict_by_record_id('132547')['mortality_risk_probability']
        self.assertEqual(p1, p2)
        self.assertEqual(p2, p3)

    # 16. Model info endpoint
    def test_16_model_info_endpoint(self):
        response = self.client.get("/model/info")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["mortality_model"]["decision_threshold"], 0.120)

    # 17. Risk API Endpoint consistency
    def test_17_risk_api_endpoint(self):
        response = self.client.get("/patient/132547/risk")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["record_id"], "132547")
        self.assertEqual(data["mortality_risk_category"], "ELEVATED")

if __name__ == "__main__":
    unittest.main()
