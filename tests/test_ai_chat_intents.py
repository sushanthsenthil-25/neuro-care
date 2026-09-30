import unittest
import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "ai-engine"))

from grok.grok_service import detect_intent, format_intent_response, call_grok_chat, generate_grok_context

class TestAIChatIntents(unittest.TestCase):

    def setUp(self):
        self.patient_id = "132547"
        self.context = generate_grok_context(self.patient_id)

    def test_01_greeting_intent_detection(self):
        self.assertEqual(detect_intent("Hi"), "greeting")
        self.assertEqual(detect_intent("Hello"), "greeting")
        self.assertEqual(detect_intent("Hey there"), "greeting")
        self.assertEqual(detect_intent("how are you?"), "greeting")

    def test_02_capabilities_intent_detection(self):
        self.assertEqual(detect_intent("What can you do?"), "capabilities")
        self.assertEqual(detect_intent("how can you help me?"), "capabilities")

    def test_03_risk_explanation_intent_detection(self):
        self.assertEqual(detect_intent("Explain risk"), "risk_explanation")
        self.assertEqual(detect_intent("Why is the risk elevated?"), "risk_explanation")
        self.assertEqual(detect_intent("What are the mortality risk factors?"), "risk_explanation")

    def test_04_recent_changes_intent_detection(self):
        self.assertEqual(detect_intent("What changed?"), "recent_changes")
        self.assertEqual(detect_intent("Recent changes"), "recent_changes")

    def test_05_trends_intent_detection(self):
        self.assertEqual(detect_intent("Explain trends"), "trends")
        self.assertEqual(detect_intent("how is the vital trend changing?"), "trends")

    def test_06_missing_data_intent_detection(self):
        self.assertEqual(detect_intent("What data is missing?"), "missing_data")
        self.assertEqual(detect_intent("telemetry gaps"), "missing_data")

    def test_07_patient_summary_intent_detection(self):
        self.assertEqual(detect_intent("Summarize this patient"), "patient_summary")
        self.assertEqual(detect_intent("explain patient"), "patient_summary")

    def test_08_greeting_response_not_mortality_report(self):
        res = call_grok_chat(self.patient_id, "Hi")
        self.assertEqual(res["intent"], "greeting")
        self.assertNotIn("Predictive Intelligence & Mortality Risk:", res["response"])
        self.assertIn("Hello!", res["response"])

    def test_09_capabilities_response(self):
        res = call_grok_chat(self.patient_id, "What can you do?")
        self.assertEqual(res["intent"], "capabilities")
        self.assertIn("I can help explain", res["response"])

    def test_10_risk_explanation_response(self):
        res = call_grok_chat(self.patient_id, "Explain risk")
        self.assertEqual(res["intent"], "risk_explanation")
        self.assertIn("Risk Explanation", res["response"])
        self.assertIn("Mortality Probability", res["response"])

    def test_11_recent_changes_response(self):
        res = call_grok_chat(self.patient_id, "Recent changes")
        self.assertEqual(res["intent"], "recent_changes")
        self.assertIn("Recent Changes", res["response"])

    def test_12_trends_response(self):
        res = call_grok_chat(self.patient_id, "Explain trends")
        self.assertEqual(res["intent"], "trends")
        self.assertIn("Vital Trends", res["response"])

    def test_13_missing_data_response(self):
        res = call_grok_chat(self.patient_id, "What data is missing?")
        self.assertEqual(res["intent"], "missing_data")
        self.assertIn("Missingness", res["response"])

    def test_14_thanks_conversational_response(self):
        res = call_grok_chat(self.patient_id, "Thanks")
        self.assertEqual(res["intent"], "general")
        self.assertIn("welcome", res["response"].lower())

    def test_15_security_no_api_key_in_frontend(self):
        frontend_src = PROJECT_ROOT / "src"
        for root, dirs, files in os.walk(frontend_src):
            for file in files:
                if file.endswith((".ts", ".tsx", ".js", ".jsx")):
                    path = os.path.join(root, file)
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        self.assertNotIn("XAI_API_KEY", content, f"API key exposed in {path}")
                        self.assertNotIn("GEMINI_API_KEY", content, f"API key exposed in {path}")

    def test_16_different_intents_produce_different_responses(self):
        res_hi = call_grok_chat(self.patient_id, "Hi")["response"]
        res_risk = call_grok_chat(self.patient_id, "Explain risk")["response"]
        res_changes = call_grok_chat(self.patient_id, "Recent changes")["response"]
        
        self.assertNotEqual(res_hi, res_risk)
        self.assertNotEqual(res_hi, res_changes)
        self.assertNotEqual(res_risk, res_changes)

    def test_17_explicit_provided_intent_honored(self):
        res = call_grok_chat(self.patient_id, "Explain the patient condition", provided_intent="recent_changes")
        self.assertEqual(res["intent"], "recent_changes")
        self.assertIn("Recent Changes", res["response"])

if __name__ == "__main__":
    unittest.main()
