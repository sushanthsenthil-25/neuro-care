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

    def test_18_patient_context_selection_other_bed(self):
        # Even when focused on 132547, asking for NC-ICU-005 resolves to 132548
        res = call_grok_chat(self.patient_id, "Is patient NC-ICU-005 at risk?")
        self.assertEqual(res["patient_id"], "132548")
        self.assertIn("Answer: NO", res["response"])
        self.assertIn("Patient #132548", res["response"])
        self.assertIn("ICU Room 05", res["response"])

    def test_19_clear_yes_risk_answer(self):
        res = call_grok_chat(self.patient_id, "Is NC-ICU-003 in danger?")
        self.assertEqual(res["patient_id"], "132543")
        self.assertIn("Answer: YES", res["response"])
        self.assertIn("Patient #132543", res["response"])
        self.assertIn("89%", res["response"])
        self.assertIn("Next step:", res["response"])

    def test_20_patient_condition_structured_format(self):
        res = call_grok_chat(self.patient_id, "How is patient NC-ICU-003?")
        resp = res["response"]
        self.assertIn("**Patient:**", resp)
        self.assertIn("**Overall status:**", resp)
        self.assertIn("**Key findings:**", resp)
        self.assertIn("**Why it matters:**", resp)
        self.assertIn("**Suggested attention:**", resp)
        self.assertIn("Patient #132543", resp)

    def test_21_medicine_stock_usable_and_details(self):
        res = call_grok_chat(self.patient_id, "What is the current stock of paracetamol?")
        resp = res["response"]
        self.assertIn("Paracetamol — Stock Summary", resp)
        self.assertIn("Total usable stock:", resp)
        self.assertIn("Low-stock threshold:", resp)
        self.assertIn("Status:", resp)
        self.assertIn("PCM-2024-OLD", resp)

    def test_22_medicine_expiry_detailed_format(self):
        res = call_grok_chat(self.patient_id, "When does batch PCM-2024-OLD expire?")
        resp = res["response"]
        self.assertIn("**Medicine:**", resp)
        self.assertIn("**Batch:**", resp)
        self.assertIn("PCM-2024-OLD", resp)
        self.assertIn("**Expiry date:**", resp)
        self.assertIn("2025-12-31", resp)
        self.assertIn("**Status:**", resp)
        self.assertIn("Expired", resp)
        self.assertIn("**Action:**", resp)

    def test_23_low_stock_audit(self):
        res = call_grok_chat(self.patient_id, "Which medicines are running low?")
        resp = res["response"]
        self.assertIn("Low & Depleted Stock Audit", resp)
        self.assertTrue("Cetirizine" in resp or "Furosemide" in resp or "Heparin" in resp)

    def test_24_ward_falling_spo2(self):
        res = call_grok_chat(self.patient_id, "Which bed has a patient with falling SpO2?")
        resp = res["response"]
        self.assertIn("Bed B-03", resp)
        self.assertIn("132543", resp)
        self.assertIn("89%", resp)

    def test_25_ward_high_risk_alerts(self):
        res = call_grok_chat(self.patient_id, "Which patients have high-risk alerts?")
        resp = res["response"]
        self.assertIn("132543", resp)

    def test_26_unknown_patient_id(self):
        res = call_grok_chat(self.patient_id, "How is patient NC-ICU-999?")
        resp = res["response"]
        self.assertIn("Patient Lookup Result", resp)
        self.assertIn("not found", resp.lower())

    def test_27_conversational_follow_up(self):
        res = call_grok_chat(self.patient_id, "When does it expire?", last_context={"last_medicine": "Ceftriaxone"})
        resp = res["response"]
        self.assertIn("Ceftriaxone", resp)
        self.assertIn("Expiry", resp)

    def test_28_no_unwanted_formatting(self):
        queries = [
            "How is patient NC-ICU-003?",
            "Is NC-ICU-003 in danger?",
            "What is the current stock of paracetamol?",
            "Which medicines are running low?",
            "When does amoxicillin expire?"
        ]
        for q in queries:
            res = call_grok_chat(self.patient_id, q)
            resp = res["response"]
            self.assertNotIn("****", resp, f"Found **** in response to {q}")
            self.assertNotIn("```json", resp, f"Found raw JSON block in response to {q}")

    def test_29_previous_readings_comparison(self):
        res = call_grok_chat("132543", "What about the previous reading?")
        resp = res["response"]
        self.assertEqual(res["intent"], "previous_readings_trends")
        self.assertIn("Vital-Sign Comparison & Trends", resp)
        self.assertIn("Current Reading", resp)
        self.assertIn("Previous Reading", resp)
        self.assertIn("89%", resp)
        self.assertIn("94%", resp)

    def test_30_stock_sufficiency(self):
        res = call_grok_chat(self.patient_id, "Is the stock sufficient?", last_context={"last_medicine": "Paracetamol"})
        resp = res["response"]
        self.assertEqual(res["intent"], "stock_sufficiency")
        self.assertIn("Stock Sufficiency Analysis", resp)
        self.assertIn("Paracetamol", resp)
        self.assertIn("SUFFICIENT", resp)

    def test_31_pending_pharmacy_orders(self):
        res = call_grok_chat("132547", "Show pending pharmacy orders")
        resp = res["response"]
        self.assertEqual(res["intent"], "pending_orders")
        self.assertIn("Pending & Active Orders", resp)
        self.assertTrue("Norepinephrine" in resp or "ORD-2026-102" in resp)

    def test_32_equipment_warnings(self):
        res = call_grok_chat("132543", "Explain equipment warnings")
        resp = res["response"]
        self.assertEqual(res["intent"], "equipment_status")
        self.assertIn("Bedside Telemetry & Equipment Health", resp)
        self.assertIn("WARNING", resp)
        self.assertIn("Internal Battery", resp)

    def test_33_patient_queue_summary(self):
        res = call_grok_chat(self.patient_id, "Summarise the patient queue")
        resp = res["response"]
        self.assertEqual(res["intent"], "queue_status")
        self.assertIn("Patient Triage & Queue Status", resp)
        self.assertIn("Vikram Malhotra", resp)
        self.assertIn("EMERGENCY", resp)

    def test_34_blood_requests_and_donors(self):
        res = call_grok_chat(self.patient_id, "Blood requests")
        resp = res["response"]
        self.assertEqual(res["intent"], "blood_status")
        self.assertIn("Blood Bank & Emergency Donor Operations", resp)
        self.assertIn("Blood Bridge", resp)

    def test_35_room_visiting_records(self):
        res = call_grok_chat("132543", "Room visiting records")
        resp = res["response"]
        self.assertEqual(res["intent"], "visiting_records")
        self.assertIn("Room Visiting Records", resp)
        self.assertIn("Nurse Chloe Evans", resp)

    def test_36_patient_billing_summary(self):
        res = call_grok_chat("132543", "Patient billing")
        resp = res["response"]
        self.assertEqual(res["intent"], "billing_summary")
        self.assertIn("Patient Billing Summary", resp)
        self.assertIn("₹", resp)
        self.assertIn("84,500", resp)

    def test_37_patient_history_and_allergies(self):
        res = call_grok_chat("132543", "Medical history and allergies")
        resp = res["response"]
        self.assertEqual(res["intent"], "patient_history_allergies")
        self.assertIn("Clinical History & Allergies", resp)
        self.assertIn("Penicillin", resp)
        self.assertIn("Severe bilateral pneumonia", resp)

    def test_38_medicine_abbreviations_and_typos(self):
        res = call_grok_chat(self.patient_id, "Stock of pcm")
        self.assertEqual(res["intent"], "medicine_stock")
        self.assertIn("Paracetamol — Stock Summary", res["response"])

        res_ctx = call_grok_chat(self.patient_id, "How many ctx units?")
        self.assertEqual(res_ctx["intent"], "medicine_stock")
        self.assertIn("Ceftriaxone", res_ctx["response"])

    def test_39_medical_abbreviations_vitals(self):
        res = call_grok_chat(self.patient_id, "hr")
        self.assertEqual(res["intent"], "trends")
        self.assertIn("Vital Trends", res["response"])


if __name__ == "__main__":
    unittest.main()

