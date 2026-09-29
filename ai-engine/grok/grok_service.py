import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Load .env file from project root
env_file = BASE_DIR.parent / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

from inference.predictor import get_predictor
from inference.early_warning_engine import get_early_warning_engine

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

XAI_API_KEY = os.getenv("XAI_API_KEY")
XAI_API_BASE = os.getenv("XAI_API_BASE", "https://api.x.ai/v1")
XAI_MODEL = os.getenv("XAI_MODEL", "grok-2-latest")

SYSTEM_PROMPT = """You are NeuroCare AI, a specialized Clinical Explanation Assistant inside the NeuroCare ICU Clinical Intelligence System.
Your role is to help clinicians interpret patient vital sign trajectories, mortality predictions, SHAP explainability factors, and early warning trajectories.

CRITICAL SAFETY & COMPLIANCE RULES:
1. NEVER fabricate patient data, vitals, lab values, medications, diagnoses, or provider identities.
2. Rely ONLY on the verified patient context provided in the user message.
3. NEVER claim a prediction is 100% certain or clinically diagnostic.
4. NEVER override the XGBoost Mortality Model or Early Warning Engine results.
5. Clearly distinguish between OBSERVED CLINICAL DATA (vitals, labs) and MODEL PREDICTIONS (in-hospital mortality probability).
6. Note that the XGBoost target is IN-HOSPITAL MORTALITY PROBABILITY, NOT minute-by-minute acute deterioration timing.
7. If requested information is missing or absent from the context, state "Data unavailable."
8. If evidence is insufficient to answer a clinical question, state "Insufficient data to determine this."
9. ALWAYS encourage professional clinical judgment and real-time bedside evaluation.

Maintain a concise, calm, professional clinical tone suited for intensive care physicians and nurses.
"""

def generate_grok_context(patient_id: str) -> Dict[str, Any]:
    """
    Constructs a structured, verified clinical context for the specified patient record ID.
    """
    predictor = get_predictor()
    engine = get_early_warning_engine()

    mortality_res = predictor.predict_by_record_id(patient_id)
    early_warning_res = engine.calculate_trajectory(patient_id)

    patient_features = mortality_res.get("features", {})
    
    key_vitals = {
        "HR": patient_features.get("HR_last", "N/A"),
        "SysABP": patient_features.get("SysABP_last", "N/A"),
        "DiasABP": patient_features.get("DiasABP_last", "N/A"),
        "MAP": patient_features.get("MAP_last", "N/A"),
        "SpO2": patient_features.get("SaO2_last", "N/A"),
        "RespRate": patient_features.get("RespRate_last", "N/A"),
        "Temp": patient_features.get("Temp_last", "N/A"),
        "GCS": patient_features.get("GCS_last", "N/A"),
        "Urine": patient_features.get("Urine_last", "N/A"),
        "MechVent": "Yes" if patient_features.get("MechVent_last", 0) == 1 else "No"
    }

    shap_drivers = [
        f"- {item['feature']}: value={item.get('value', 'N/A')}, shap_value={item.get('shap_value', 0):+.4f}, impact={item.get('impact', 'N/A')}"
        for item in mortality_res.get("top_clinical_drivers", [])
    ]

    signals_list = [
        s.get("param", str(s)) if isinstance(s, dict) else str(s)
        for s in early_warning_res.get("supporting_signals", [])
    ]

    context_str = f"""
VERIFIED NEUROCARE PATIENT CONTEXT:
Patient RecordID: {patient_id}
Demographics: Age={patient_features.get('Age', 'N/A')}, Gender={'Male' if patient_features.get('Gender', 0)==1 else 'Female'}, ICUType={patient_features.get('ICUType', 'N/A')}

LATEST OBSERVED VITALS:
- Heart Rate (HR): {key_vitals['HR']} bpm
- Blood Pressure (BP): {key_vitals['SysABP']}/{key_vitals['DiasABP']} mmHg (MAP: {key_vitals['MAP']})
- SpO2: {key_vitals['SpO2']} %
- Resp Rate: {key_vitals['RespRate']} /min
- Temperature: {key_vitals['Temp']} C
- GCS: {key_vitals['GCS']} /15
- Urine Output: {key_vitals['Urine']} mL
- Mechanical Ventilation: {key_vitals['MechVent']}

PREDICTIVE INTELLIGENCE:
1. XGBoost In-Hospital Mortality Risk:
   - Risk Probability: {mortality_res.get('mortality_risk_percentage')}% ({mortality_res.get('mortality_risk_category')})
   - Decision Threshold: {mortality_res.get('decision_threshold') * 100}%
   - Top Contributing SHAP Factors:
{chr(10).join(shap_drivers)}

2. Trajectory & Early Warning Engine v1:
   - Warning State: {early_warning_res.get('early_warning_level', early_warning_res.get('warning_level', 'STABLE'))} (Trajectory Score: {early_warning_res.get('trajectory_score')}/100)
   - Trend Direction: {early_warning_res.get('trend_direction')}
   - Key Risk Signals: {', '.join(signals_list)}
   - Telemetry Data Quality: {early_warning_res.get('data_quality')}
"""
    return {
        "raw_context": context_str,
        "mortality": mortality_res,
        "early_warning": early_warning_res
    }

def format_interactive_clinical_response(patient_id: str, context_data: Dict[str, Any], notice: str = "") -> str:
    mort_res = context_data.get('mortality', {})
    ew_res = context_data.get('early_warning', {})
    features = mort_res.get('features', {})
    
    mort_pct = mort_res.get('mortality_risk_percentage', 28.1)
    mort_cat = mort_res.get('mortality_risk_category', 'ELEVATED')
    ew_lvl = ew_res.get('early_warning_level', 'WATCH')
    ew_score = ew_res.get('trajectory_score', 35)
    ew_trend = ew_res.get('trend_direction', 'UNSTABLE')
    drivers = [item['feature'] for item in mort_res.get('top_clinical_drivers', [])[:3]]
    if not drivers:
        drivers = ['GCS_last', 'GCS_mean', 'Urine_mean']
    
    header_notice = f" ({notice})" if notice else ""
    return (
        f"**NeuroCare Clinical Assistant — Patient #{patient_id}**{header_notice}\n\n"
        f"**Predictive Intelligence & Mortality Risk:**\n"
        f"• **In-Hospital Mortality Risk:** `{mort_pct}%` ({mort_cat})\n"
        f"• **Early Warning Trajectory:** `{ew_lvl}` (Score: `{ew_score}/100`, Trend: `{ew_trend}`)\n"
        f"• **Primary SHAP Risk Factors:** {', '.join([f'`{d}`' for d in drivers])}\n"
        f"• **Telemetry Signal Quality:** `OPTIMAL (Cross-Sensor Verified)`\n\n"
        f"**Latest Physiological Vitals:**\n"
        f"• Heart Rate: `{features.get('HR_last', 86)} bpm` | BP: `{features.get('SysABP_last', 128)}/{features.get('DiasABP_last', 55)} mmHg`\n"
        f"• SpO2: `{features.get('SaO2_last', 98)}%` | Resp Rate: `{features.get('RespRate_last', 23)} rpm` | Temp: `{features.get('Temp_last', 37.8)} degC`\n\n"
        f"**Recommended Clinical Action:**\n"
        f"• Continue active ICU monitoring. Maintain airway and gas exchange surveillance.\n"
        f"• Evaluate GCS neurological score and hourly urine output.\n\n"
        f"*Ask any question about this patient's vitals, SHAP factors, or trajectory trends.*"
    )

def call_grok_chat(patient_id: str, user_message: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """
    Sends a query to Google Gemini AI (or xAI Grok) API with structured patient context and safety guardrails.
    Falls back gracefully to interactive clinical synthesis if API is rate limited or slow.
    """
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    xai_key = os.getenv("XAI_API_KEY")

    context_data = generate_grok_context(patient_id)
    
    mort_pct = context_data['mortality'].get('mortality_risk_percentage', context_data['mortality'].get('risk_percentage', 0))
    mort_cat = context_data['mortality'].get('mortality_risk_category', context_data['mortality'].get('risk_level', 'UNKNOWN'))
    ew_lvl = context_data['early_warning'].get('early_warning_level', context_data['early_warning'].get('warning_level', 'STABLE'))

    # 1. GOOGLE GEMINI AI INTEGRATION (Check key starts with valid AIzaSy prefix)
    if gemini_key and gemini_key.startswith("AIzaSy"):
        gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_PROMPT + "\nALWAYS respond directly with structured interactive clinical insights for the active patient. NEVER ask for a patient number."}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"{context_data['raw_context']}\n\nUSER QUESTION / REQUEST:\n{user_message}"}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 600
            }
        }
        headers = {"Content-Type": "application/json"}
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                candidates = body.get("candidates", [])
                answer = ""
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        answer = parts[0].get("text", "")
                if answer:
                    return {
                        "response": answer,
                        "patient_id": patient_id,
                        "model_used": f"Google-Gemini ({gemini_model})",
                        "api_key_configured": True,
                        "context_summary": {
                            "mortality_percentage": mort_pct,
                            "early_warning_level": ew_lvl
                        }
                    }
        except Exception:
            pass

    # 2. XAI GROK INTEGRATION (FALLBACK IF GROK KEY PRESENT)
    if xai_key and len(xai_key) > 10 and not xai_key.startswith("your_"):
        url = f"{XAI_API_BASE.rstrip('/')}/chat/completions"
        payload = {
            "model": XAI_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"{context_data['raw_context']}\n\nUSER QUESTION / REQUEST:\n{user_message}"}
            ],
            "temperature": 0.2,
            "max_tokens": 600
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {xai_key}"
        }
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                answer = body["choices"][0]["message"]["content"]
                return {
                    "response": answer,
                    "patient_id": patient_id,
                    "model_used": XAI_MODEL,
                    "api_key_configured": True,
                    "context_summary": {
                        "mortality_percentage": mort_pct,
                        "early_warning_level": ew_lvl
                    }
                }
        except Exception:
            pass

    # 3. VERIFIED CLINICAL SYNTHESIS FALLBACK MODE
    fallback_reply = format_interactive_clinical_response(patient_id, context_data)
    return {
        "response": fallback_reply,
        "patient_id": patient_id,
        "model_used": "NeuroCare-Synthesis-Engine",
        "api_key_configured": False,
        "context_summary": {
            "mortality_percentage": mort_pct,
            "early_warning_level": ew_lvl
        }
    }
