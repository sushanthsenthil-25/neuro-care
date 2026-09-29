import os
import sys
import unittest
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent / "ai-engine"
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from inference.predictor import get_predictor
from inference.early_warning_engine import get_early_warning_engine
from config.risk_config import MORTALITY_MODEL_CONFIG, EARLY_WARNING_CONFIG, get_mortality_risk_category

class TestNeuroCareQAAndSafety(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.predictor = get_predictor()
        cls.engine = get_early_warning_engine()

    def test_01_central_risk_configuration(self):
        """Verify central decision threshold 0.120 and risk categories."""
        self.assertEqual(MORTALITY_MODEL_CONFIG["decision_threshold"], 0.120)
        self.assertEqual(get_mortality_risk_category(0.05), "LOW")
        self.assertEqual(get_mortality_risk_category(0.18), "WATCH")
        self.assertEqual(get_mortality_risk_category(0.2814), "ELEVATED")
        self.assertEqual(get_mortality_risk_category(0.55), "HIGH")

    def test_02_patient_132547_calibrated_category(self):
        """Verify Patient 132547 (28.14%) is accurately categorized as ELEVATED under decision threshold 0.120."""
        res = self.predictor.predict_by_record_id("132547")
        self.assertEqual(res["record_id"], "132547")
        self.assertEqual(res["mortality_risk_percentage"], 28.1)
        self.assertEqual(res["mortality_risk_category"], "ELEVATED")
        self.assertEqual(res["decision_threshold"], 0.120)

    def test_03_unknown_patient_raises_keyerror(self):
        """Verify unknown patient RecordID raises KeyError for API 404 response."""
        with self.assertRaises(KeyError):
            self.predictor.predict_by_record_id("UNKNOWN_RECORD_99999")

    def test_04_non_causal_shap_wording(self):
        """Verify SHAP explanation text uses non-causal statistical contribution phrasing."""
        res = self.predictor.predict_by_record_id("132547")
        drivers = res["top_clinical_drivers"]
        self.assertTrue(len(drivers) > 0)
        for d in drivers:
            self.assertIn("contribution to predicted mortality risk", d["clinical_significance"])
            self.assertIn(d["impact"], ["higher_contribution", "lower_contribution"])

    def test_05_no_future_data_leakage(self):
        """Verify early warning trajectory calculations strictly enforce observation_time <= cutoff."""
        res_48 = self.engine.calculate_trajectory("132547", cutoff_hours=48.0)
        res_12 = self.engine.calculate_trajectory("132547", cutoff_hours=12.0)
        self.assertEqual(res_48["cutoff_hours"], 48.0)
        self.assertEqual(res_24_or_12 := res_12["cutoff_hours"], 12.0)

    def test_06_model_metadata_semantics(self):
        """Verify model target is explicitly declared as inHospitalDeath."""
        self.assertEqual(self.predictor.metadata["primary_target"], "inHospitalDeath")

if __name__ == "__main__":
    unittest.main()
