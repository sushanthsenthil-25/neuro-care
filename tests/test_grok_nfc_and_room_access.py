import unittest
import sys
import os
from pathlib import Path

# Add backend/api and ai-engine to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
AI_ENGINE_DIR = PROJECT_ROOT / "ai-engine"
BACKEND_DIR = PROJECT_ROOT / "backend" / "api"

if str(AI_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_ENGINE_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from main import app
from grok.grok_service import generate_grok_context, call_grok_chat
from config.risk_config import MORTALITY_MODEL_CONFIG, EARLY_WARNING_CONFIG

class TestGrokNFCAndRoomAccess(unittest.TestCase):
    
    def setUp(self):
        self.client = TestClient(app)
        self.test_patient_id = "132547"

    def test_mortality_model_label_and_target(self):
        """Verify mortality model is strictly labeled as In-Hospital Mortality Risk."""
        self.assertEqual(MORTALITY_MODEL_CONFIG["model_version"], "XGBoost-ICU-v1")
        self.assertEqual(MORTALITY_MODEL_CONFIG["primary_target"], "inHospitalDeath")
        
        # Call risk API endpoint
        response = self.client.get(f"/patient/{self.test_patient_id}/risk")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["model_version"], "XGBoost-ICU-v1")
        self.assertEqual(data["model_label"], "IN-HOSPITAL MORTALITY RISK")
        self.assertIn("mortality_risk_probability", data)

    def test_grok_context_generation(self):
        """Verify Grok context includes verified patient metrics, vitals, SHAP, and Early Warning state."""
        ctx = generate_grok_context(self.test_patient_id)
        self.assertIn("VERIFIED NEUROCARE PATIENT CONTEXT", ctx["raw_context"])
        self.assertIn("Patient RecordID: 132547", ctx["raw_context"])
        self.assertIn("XGBoost In-Hospital Mortality Risk", ctx["raw_context"])
        self.assertIn("Trajectory & Early Warning Engine v1", ctx["raw_context"])

    def test_grok_chat_endpoint(self):
        """Test POST /ai/chat returns structured clinical explanation without errors."""
        payload = {
            "patient_id": self.test_patient_id,
            "message": "Explain this patient's mortality risk and early warning trajectory."
        }
        response = self.client.post("/ai/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["patient_id"], self.test_patient_id)
        self.assertIn("response", data)
        self.assertTrue(len(data["response"]) > 0)

    def test_nfc_tag_resolution(self):
        """Test resolving NFC tag identifiers to patient and room mapping."""
        # Test valid NFC tag mapping
        res = self.client.get("/nfc/resolve/NFC-TAG-132547")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["patient_id"], "132547")

        # Test fallback numerical ID lookup
        res2 = self.client.get("/nfc/resolve/132547")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["patient_id"], "132547")

        # Test invalid tag
        res3 = self.client.get("/nfc/resolve/NFC-TAG-INVALID-999999")
        self.assertEqual(res3.status_code, 404)

    def test_room_access_presence_logging(self):
        """Test ENTER ROOM and EXIT ROOM presence event logging and fetching."""
        # Fetch initial history
        get_res1 = self.client.get(f"/room-access/{self.test_patient_id}")
        self.assertEqual(get_res1.status_code, 200)
        initial_count = len(get_res1.json()["events"])

        # Log ENTER ROOM event
        enter_event = {
            "patient_id": self.test_patient_id,
            "room_id": "ICU 04",
            "user_id": "usr-test-doc",
            "role": "Doctor",
            "display_name": "Dr. Test",
            "action": "ENTER",
            "source": "NFC"
        }
        post_res = self.client.post("/room-access/event", json=enter_event)
        self.assertEqual(post_res.status_code, 200)
        self.assertEqual(post_res.json()["status"], "success")

        # Verify event added
        get_res2 = self.client.get(f"/room-access/{self.test_patient_id}")
        self.assertEqual(get_res2.status_code, 200)
        self.assertEqual(len(get_res2.json()["events"]), initial_count + 1)

    def test_no_exposed_xai_api_keys_in_frontend(self):
        """Verify XAI_API_KEY is never hardcoded in src/ directory frontend code."""
        src_dir = PROJECT_ROOT / "src"
        if src_dir.exists():
            for root, _, files in os.walk(src_dir):
                for f in files:
                    if f.endswith(('.ts', '.tsx', '.js', '.jsx', '.html', '.json')):
                        path = Path(root) / f
                        with open(path, 'r', encoding='utf-8', errors='ignore') as file_obj:
                            content = file_obj.read()
                            self.assertNotIn("xai-", content.lower(), f"Potential exposed xAI key in {f}")
                            self.assertNotIn("XAI_API_KEY =", content, f"Hardcoded XAI_API_KEY in {f}")

if __name__ == "__main__":
    unittest.main()
