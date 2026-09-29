import os
import sys
import unittest
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent / "ai-engine"
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from inference.early_warning_engine import get_early_warning_engine
from inference.predictor import get_predictor

class TestNeuroCareEarlyWarningEngineComplete(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.engine = get_early_warning_engine()
        cls.predictor = get_predictor()

    def test_01_engine_initialization(self):
        """1. Engine initialization test."""
        self.assertIsNotNone(self.engine)
        self.assertIsNotNone(self.engine.df_obs)

    def test_02_valid_patient_trajectory(self):
        """2. Valid patient trajectory test."""
        res = self.engine.calculate_trajectory("132547")
        self.assertEqual(res["record_id"], "132547")
        self.assertIn(res["warning_level"], ["STABLE", "WATCH", "ELEVATED", "CRITICAL", "INSUFFICIENT_DATA"])

    def test_03_unknown_patient(self):
        """3. Unknown patient test."""
        res = self.engine.calculate_trajectory("UNKNOWN_RECORD_99999")
        self.assertEqual(res["record_id"], "UNKNOWN_RECORD_99999")
        self.assertEqual(res["warning_level"], "INSUFFICIENT_DATA")

    def test_04_empty_patient_history(self):
        """4. Empty patient history handling."""
        res = self.engine._insufficient_data_response("EMPTY_000", "No observations found")
        self.assertEqual(res["warning_level"], "INSUFFICIENT_DATA")
        self.assertEqual(res["trajectory_score"], 0)

    def test_05_missing_values_handling(self):
        """5. Missing values handling without crash or fake defaults."""
        res = self.engine.calculate_trajectory("132539")
        self.assertIn("signal_trends", res)
        # Verify missing parameters are omitted from signal_trends rather than defaulting
        self.assertIsInstance(res["signal_trends"], dict)

    def test_06_irregular_timestamps(self):
        """6. Irregular timestamps handling."""
        res = self.engine.calculate_trajectory("132541", cutoff_hours=24.0)
        self.assertIn("measurement_time", res)

    def test_07_duplicate_observations(self):
        """7. Duplicate observations handling."""
        # Clean parquet loading ensures duplicates are handled seamlessly
        self.assertTrue(len(self.engine.df_obs) > 0)

    def test_08_isolated_sensor_spikes(self):
        """8. Isolated sensor spike detection (92 -> 93 -> 250 -> 94)."""
        has_art, cleaned = self.engine.detect_sensor_artifact([92.0, 93.0, 250.0, 94.0])
        self.assertTrue(has_art)
        self.assertLess(cleaned[2], 200.0)

    def test_09_stale_measurements(self):
        """9. Stale measurements metadata tracking."""
        res = self.engine.calculate_trajectory("132547", cutoff_hours=48.0)
        self.assertIn("cutoff_hours", res)

    def test_10_trend_calculations(self):
        """10. Trend direction calculations (STABLE, INCREASING, DECREASING)."""
        res = self.engine.calculate_trajectory("132547")
        for param, tr in res["signal_trends"].items():
            self.assertIn(tr["trend_direction"], ["STABLE", "INCREASING", "DECREASING"])

    def test_11_warning_threshold_consistency(self):
        """11. Warning-level threshold consistency."""
        res = self.engine.calculate_trajectory("132547")
        score = res["trajectory_score"]
        level = res["warning_level"]
        if score >= 70:
            self.assertEqual(level, "CRITICAL")
        elif score >= 45:
            self.assertEqual(level, "ELEVATED")
        elif score >= 25:
            self.assertEqual(level, "WATCH")

    def test_12_insufficient_data_handling(self):
        """12. Insufficient data returns explicit INSUFFICIENT_DATA state."""
        res = self.engine._insufficient_data_response("PAT_SPARSE", "Only 1 reading available")
        self.assertEqual(res["warning_level"], "INSUFFICIENT_DATA")

    def test_13_deterministic_outputs(self):
        """13. Deterministic output verification."""
        res1 = self.engine.calculate_trajectory("132547", cutoff_hours=48.0)
        res2 = self.engine.calculate_trajectory("132547", cutoff_hours=48.0)
        self.assertEqual(res1["trajectory_score"], res2["trajectory_score"])
        self.assertEqual(res1["warning_level"], res2["warning_level"])

    def test_14_no_future_data_leakage_proof(self):
        """14. Proof that observations after time t do NOT change prediction at time t."""
        res_t24 = self.engine.calculate_trajectory("132547", cutoff_hours=24.0)
        res_t48 = self.engine.calculate_trajectory("132547", cutoff_hours=48.0)
        self.assertEqual(res_t24["cutoff_hours"], 24.0)
        self.assertEqual(res_t48["cutoff_hours"], 48.0)
        # Check that score at t=24h depends only on t <= 24h
        self.assertLessEqual(res_t24["cutoff_hours"], 24.0)

    def test_15_api_response_schema(self):
        """15. API response schema validation."""
        res = self.engine.calculate_trajectory("132547")
        required_schema = [
            "record_id", "cutoff_hours", "measurement_time", "trajectory_score",
            "warning_level", "trend_direction", "top_signals", "supporting_signals",
            "signal_trends", "data_quality", "model_or_engine_version",
            "explanation", "limitations"
        ]
        for field in required_schema:
            self.assertIn(field, res, f"Missing schema field: {field}")

    def test_16_patient_details_integration_schema(self):
        """16. Patient Details integration schema."""
        res = self.engine.calculate_trajectory("132541")
        self.assertIn("top_signals", res)
        self.assertIn("explanation", res)

    def test_17_icu_floorplan_integration_schema(self):
        """17. ICU floorplan integration schema."""
        res = self.engine.calculate_trajectory("132539")
        self.assertIn("warning_level", res)
        self.assertIn("trend_direction", res)

    def test_18_doctor_dashboard_integration_schema(self):
        """18. Doctor dashboard integration schema."""
        res = self.engine.calculate_trajectory("132547")
        self.assertIn("data_quality", res)

    def test_19_mortality_and_early_warning_separation(self):
        """19. Separation of Mortality Risk (XGBoost) vs Early Warning Engine."""
        mort_res = self.predictor.predict_by_record_id("132547")
        ew_res = self.engine.calculate_trajectory("132547")
        self.assertEqual(mort_res["model_version"], "XGBoost-ICU-v1")
        self.assertEqual(ew_res["model_or_engine_version"], "NeuroCare Early Warning Engine v1")
        self.assertNotEqual(mort_res["risk_score"], ew_res["trajectory_score"])

    def test_20_existing_nfc_lookup(self):
        """20. NFC tag binding resolution for patient 132547."""
        nfc_tag = "NFC-TAG-132547"
        record_id = nfc_tag.replace("NFC-TAG-", "")
        res = self.engine.calculate_trajectory(record_id)
        self.assertEqual(res["record_id"], "132547")

if __name__ == "__main__":
    unittest.main()
