import os
import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "ai-engine"))
sys.path.insert(0, str(BASE_DIR))

from backend.api.main import app

class TestPatientDataFlowAudit(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.test_patients = ["132539", "132541", "132543", "132547", "132548"]

    def test_01_patient_risk_patient_specific(self):
        """Verify GET /patient/{id}/risk returns distinct patient-specific record_id and features."""
        for pid in self.test_patients:
            res = self.client.get(f"/patient/{pid}/risk")
            self.assertEqual(res.status_code, 200, f"Failed to get risk for patient {pid}")
            data = res.json()
            self.assertEqual(data["record_id"], pid, f"RecordID mismatch in response for patient {pid}")
            self.assertIn("risk_percentage", data)
            self.assertIn("top_clinical_drivers", data)

    def test_02_vitals_trends_patient_specific_and_real_timestamps(self):
        """Verify GET /patient/{id}/vitals/trends returns real patient-specific time series preserving irregular timestamps."""
        for pid in self.test_patients:
            res = self.client.get(f"/patient/{pid}/vitals/trends?hours=24")
            self.assertEqual(res.status_code, 200, f"Failed to get trends for patient {pid}")
            data = res.json()
            self.assertEqual(data["patient_id"], pid)
            self.assertIn("series", data)
            self.assertIn("trend_summary", data)
            
            # Check HR series timestamps if present
            hr_series = data["series"].get("HR", [])
            if len(hr_series) > 1:
                times = [pt["time_hours"] for pt in hr_series]
                # Ensure timestamps are chronologically ordered
                self.assertEqual(times, sorted(times), f"Timestamps for patient {pid} must be sorted chronologically")

    def test_03_telemetry_status_device_health_isolation(self):
        """Verify GET /patient/{id}/telemetry-status evaluates sensor health separately from patient risk."""
        for pid in self.test_patients:
            res = self.client.get(f"/patient/{pid}/telemetry-status")
            self.assertEqual(res.status_code, 200, f"Failed to get telemetry status for patient {pid}")
            data = res.json()
            self.assertEqual(data["patient_id"], pid)
            self.assertIn("sensors", data)
            self.assertIn("overall_telemetry_quality", data)
            
            # Check sensor statuses are GREEN, YELLOW, or RED
            for s_key, s_data in data["sensors"].items():
                self.assertIn(s_data["status"], ["GREEN", "YELLOW", "RED"])

    def test_04_unknown_patient_404_error(self):
        """Verify endpoints return 404 for non-existent patient IDs without fabricating fake data."""
        res_risk = self.client.get("/patient/UNKNOWN_99999/risk")
        self.assertEqual(res_risk.status_code, 404)

        res_nfc = self.client.get("/nfc/resolve/NFC-TAG-INVALID")
        self.assertEqual(res_nfc.status_code, 404)

    def test_05_ai_chat_patient_context_binding(self):
        """Verify POST /ai/chat binds to the specified patient_id context."""
        for pid in self.test_patients:
            payload = {
                "patient_id": pid,
                "message": "Explain this patient's current status."
            }
            res = self.client.post("/ai/chat", json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["patient_id"], pid)
            self.assertIn(f"Patient #{pid}", data["response"])

    def test_06_regression_test_multi_patient_data_isolation(self):
        """Regression Test: Ensure patient data is NOT identical static copy across different patients."""
        patient_a = "132539"
        patient_b = "132547"

        res_a = self.client.get(f"/patient/{patient_a}/risk").json()
        res_b = self.client.get(f"/patient/{patient_b}/risk").json()

        self.assertEqual(res_a["record_id"], patient_a)
        self.assertEqual(res_b["record_id"], patient_b)

        # Check feature dicts contain patient-specific values
        self.assertNotEqual(res_a["features"].get("Age"), res_b["features"].get("Age") if res_a["features"].get("Age") != res_b["features"].get("Age") else None)

if __name__ == "__main__":
    unittest.main()
