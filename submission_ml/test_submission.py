import os
import json
import sys
import unittest
import numpy as np
import pandas as pd
import duckdb
from pathlib import Path

SUBMISSION_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SUBMISSION_DIR.parent

sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(SUBMISSION_DIR))
sys.path.insert(0, str(PROJECT_ROOT / "ai-engine"))

from submission_ml.inference.predict import predict_competition_submission, CompetitionEvaluatorPredictor

class TestSubmissionEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        con = duckdb.connect()
        obs_path = str(PROJECT_ROOT / "ai-engine" / "data" / "parquet" / "observations.parquet")
        pat_path = str(PROJECT_ROOT / "ai-engine" / "data" / "parquet" / "patients.parquet")
        
        cls.df_obs = con.execute(f"SELECT * FROM '{obs_path}' LIMIT 50000").df()
        cls.df_pat = con.execute(f"SELECT * FROM '{pat_path}' LIMIT 100").df()

    def test_01_submission_inference_returns_valid_probabilities(self):
        df_res = predict_competition_submission(self.df_obs, self.df_pat)
        self.assertIn("patient_id", df_res.columns)
        self.assertIn("prediction_probability", df_res.columns)
        self.assertGreater(len(df_res), 0)
        
        probs = df_res["prediction_probability"].values
        self.assertTrue(np.all((probs >= 0.0) & (probs <= 1.0)))
        self.assertEqual(np.isnan(probs).sum(), 0)
        self.assertEqual(np.isinf(probs).sum(), 0)

    def test_02_patient_isolation_and_no_outcome_leakage(self):
        # Verify prediction works without any target outcome file loaded
        df_res = predict_competition_submission(self.df_obs, self.df_pat)
        self.assertNotIn("inHospitalDeath", df_res.columns)
        self.assertNotIn("label", df_res.columns)

    def test_03_robustness_on_missing_vitals(self):
        # Simulate patient with 90% missing vital observations
        df_obs_sparse = self.df_obs.sample(frac=0.1, random_state=42)
        df_res = predict_competition_submission(df_obs_sparse, self.df_pat)
        probs = df_res["prediction_probability"].values
        self.assertEqual(np.isnan(probs).sum(), 0)
        self.assertEqual(np.isinf(probs).sum(), 0)

    def test_04_deterministic_predictions(self):
        df_res1 = predict_competition_submission(self.df_obs, self.df_pat)
        df_res2 = predict_competition_submission(self.df_obs, self.df_pat)
        np.testing.assert_array_almost_equal(
            df_res1["prediction_probability"].values,
            df_res2["prediction_probability"].values
        )

if __name__ == "__main__":
    unittest.main()
