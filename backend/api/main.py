import os
import sys
import json
from typing import Optional, Dict, Any, List
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent.parent.parent / "ai-engine"
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
if str(BASE_DIR.parent) not in sys.path:
    sys.path.insert(0, str(BASE_DIR.parent))

from inference.predictor import get_predictor  # type: ignore
from inference.early_warning_engine import get_early_warning_engine  # type: ignore
from config.risk_config import MORTALITY_MODEL_CONFIG, EARLY_WARNING_CONFIG  # type: ignore
from grok.grok_service import call_grok_chat  # type: ignore
from inference.alert_engine import get_alert_engine  # type: ignore

class PredictRequest(BaseModel):
    record_id: str

class EarlyWarningRequest(BaseModel):
    record_id: str
    cutoff_hours: float = 48.0

class AcknowledgeAlertRequest(BaseModel):
    user_id: str
    role: str

class GrokChatRequest(BaseModel):
    patient_id: str
    message: str
    conversation_id: Optional[str] = None

class RoomAccessEvent(BaseModel):
    event_id: Optional[str] = None
    patient_id: str
    room_id: str
    user_id: str
    role: str
    display_name: str
    action: str  # ENTER or EXIT
    source: str = "NFC"
    timestamp: Optional[str] = None


app = FastAPI(
    title="NeuroCare ICU AI Early-Warning Engine API",
    description="Real ML clinical predictive intelligence API & Time-Series Early Warning Engine",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "NeuroCare-ICU-AI-Engine",
        "models_loaded": {
            "mortality_model": MORTALITY_MODEL_CONFIG["model_version"],
            "early_warning_engine": EARLY_WARNING_CONFIG["engine_name"]
        },
        "api_version": "1.0.0"
    }

@app.get("/model/health")
def get_model_health():
    try:
        predictor = get_predictor()
        return {
            "status": "healthy",
            "model_loaded": predictor.model is not None,
            "model_version": MORTALITY_MODEL_CONFIG["model_version"],
            "feature_schema_valid": len(predictor.feature_names) == 233,
            "model_file_available": predictor.model_path.exists(),
            "metadata_available": predictor.meta_path.exists(),
            "prediction_service_available": True
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "model_loaded": False,
            "prediction_service_available": False,
            "error": str(e)
        }

@app.get("/model/info")
def get_model_info():
    try:
        predictor = get_predictor()
        return {
            "mortality_model": {
                "model_name": MORTALITY_MODEL_CONFIG["model_name"],
                "model_type": predictor.metadata.get("model_type", "XGBoost"),
                "model_version": MORTALITY_MODEL_CONFIG["model_version"],
                "saved_path": str(predictor.model_path),
                "primary_target": MORTALITY_MODEL_CONFIG["primary_target"],
                "decision_threshold": MORTALITY_MODEL_CONFIG["decision_threshold"],
                "display_bands": MORTALITY_MODEL_CONFIG["display_bands"],
                "eval_auroc": MORTALITY_MODEL_CONFIG["eval_auroc"],
                "eval_auprc": MORTALITY_MODEL_CONFIG["eval_auprc"],
                "eval_sensitivity": MORTALITY_MODEL_CONFIG["eval_sensitivity"],
                "eval_specificity": MORTALITY_MODEL_CONFIG["eval_specificity"]
            },
            "early_warning_engine": {
                "engine_name": EARLY_WARNING_CONFIG["engine_name"],
                "status": EARLY_WARNING_CONFIG["status"],
                "purpose": "Analyze current physiological trajectory up to time T",
                "disclaimer": EARLY_WARNING_CONFIG["disclaimer"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patient/{patient_id}/risk")
def get_patient_mortality_risk(patient_id: str):
    """
    Returns In-Hospital Mortality Risk Score (Powered by XGBoost-ICU-v1)
    """
    try:
        predictor = get_predictor()
        result = predictor.predict_by_record_id(patient_id)
        result["model_label"] = "IN-HOSPITAL MORTALITY RISK"
        return result
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=f"Patient RecordID {patient_id} not found in database.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patient/{patient_id}/early-warning")
def get_patient_early_warning(patient_id: str, cutoff_hours: float = 48.0):
    """
    Returns Current Trajectory & Early Warning Level (Powered by NeuroCare Early Warning Engine v1)
    """
    try:
        engine = get_early_warning_engine()
        result = engine.calculate_trajectory(patient_id, cutoff_hours=cutoff_hours)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patient/{patient_id}/explanation")
def get_patient_explanation(patient_id: str):
    try:
        predictor = get_predictor()
        result = predictor.predict_by_record_id(patient_id)
        return {
            "record_id": patient_id,
            "mortality_risk_probability": result["mortality_risk_probability"],
            "mortality_risk_category": result["mortality_risk_category"],
            "decision_threshold": result["decision_threshold"],
            "shap_explanation": result["top_clinical_drivers"],
            "disclaimer": "Decision-support prototype — not a substitute for clinical judgment."
        }
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=f"Patient RecordID {patient_id} not found in database.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patient/{patient_id}/prediction-history")
def get_patient_prediction_history(patient_id: str, limit: int = Query(20)):
    """
    Returns auditable patient-isolated prediction history snapshots.
    """
    try:
        predictor = get_predictor()
        predictor.predict_by_record_id(patient_id)
        alert_eng = get_alert_engine()
        history = alert_eng.get_patient_history(patient_id, limit=limit)
        return {"patient_id": patient_id, "history": history}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Patient RecordID {patient_id} not found in database.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patient/{patient_id}/alerts")
def get_patient_alerts(patient_id: str):
    """
    Returns patient-isolated clinical model alerts sorted newest first.
    """
    try:
        predictor = get_predictor()
        predictor.predict_by_record_id(patient_id)
        alert_eng = get_alert_engine()
        alerts = alert_eng.get_patient_alerts(patient_id)
        return {"patient_id": patient_id, "alerts": alerts}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Patient RecordID {patient_id} not found in database.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/alerts/active-overview")
def get_active_alerts_overview():
    """
    Returns active clinical alerts across all ICU patients for Doctor Dashboard & ICU Floor Layout.
    """
    try:
        alert_eng = get_alert_engine()
        alerts = alert_eng.get_active_alerts_overview()
        return {"active_alerts": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert_route(alert_id: str, req: AcknowledgeAlertRequest):
    """
    Acknowledge clinical alert (requires authorized clinician role).
    """
    try:
        alert_eng = get_alert_engine()
        result = alert_eng.acknowledge_alert(alert_id, user_id=req.user_id, role=req.role)
        return {"status": "success", "alert": result}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Alert ID '{alert_id}' not found.")
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patient/{patient_id}/trajectory")
def get_patient_trajectory(patient_id: str, cutoff_hours: float = 48.0):
    try:
        engine = get_early_warning_engine()
        result = engine.calculate_trajectory(patient_id, cutoff_hours=cutoff_hours)
        return {
            "record_id": patient_id,
            "trajectory_score": result["trajectory_score"],
            "early_warning_level": result["early_warning_level"],
            "trend_direction": result["trend_direction"],
            "signal_trends": result["signal_trends"],
            "supporting_signals": result["supporting_signals"],
            "data_quality": result["data_quality"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patient/{patient_id}/telemetry-status")
def get_patient_telemetry_status(patient_id: str):
    """
    Returns per-sensor telemetry device status (GREEN/YELLOW/RED) calculated from actual patient dataset observations.
    Crucial: Device status describes signal/hardware health, NOT patient clinical risk.
    """
    try:
        engine = get_early_warning_engine()
        result = engine.get_telemetry_status(patient_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patient/{patient_id}/vitals/trends")
def get_patient_vitals_trends(patient_id: str, hours: float = Query(24.0)):
    """
    Returns patient-specific chronological trend series using real timestamps from dataset.
    """
    try:
        engine = get_early_warning_engine()
        result = engine.get_vitals_trends(patient_id, hours=hours)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/early-warning")
def post_early_warning(req: EarlyWarningRequest):
    try:
        engine = get_early_warning_engine()
        result = engine.calculate_trajectory(req.record_id, cutoff_hours=req.cutoff_hours)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
def predict_mortality_risk(req: PredictRequest):
    try:
        predictor = get_predictor()
        result = predictor.predict_by_record_id(req.record_id)
        result["model_label"] = "IN-HOSPITAL MORTALITY RISK"
        return result
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=f"Patient RecordID {req.record_id} not found in database.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/rooms/risk-overview")
def get_rooms_risk_overview():
    room_patients = {
        "ICU 01": "132539",
        "ICU 02": "132541",
        "ICU 03": "132543",
        "ICU 04": "132547",
        "ICU 05": "132548",
        "ICU 06": "132551",
        "ICU 07": "132554",
        "ICU 08": "132555",
        "ICU 09": "132567",
        "ICU 10": "132570"
    }
    
    predictor = get_predictor()
    engine = get_early_warning_engine()
    
    room_scores = []
    for room, pid in room_patients.items():
        mort_res = predictor.predict_by_record_id(pid)
        ew_res = engine.calculate_trajectory(pid)
        
        room_scores.append({
            "room": room,
            "record_id": pid,
            "mortality_risk_probability": mort_res["mortality_risk_probability"],
            "mortality_risk_percentage": mort_res["mortality_risk_percentage"],
            "mortality_risk_category": mort_res["mortality_risk_category"],
            "decision_threshold": mort_res["decision_threshold"],
            "early_warning_score": ew_res["trajectory_score"],
            "early_warning_level": ew_res["early_warning_level"],
            "trend_direction": ew_res["trend_direction"],
            "supporting_signals": ew_res["supporting_signals"],
            "data_quality": ew_res["data_quality"]
        })

    return {"rooms": room_scores}

# In-memory store for backend fallback room access events
ROOM_ACCESS_STORE = [
    {
        "event_id": "evt-demo-101",
        "patient_id": "132547",
        "room_id": "ICU 04",
        "user_id": "usr-dr-kumar",
        "role": "Doctor",
        "display_name": "Dr. Kumar",
        "entry_time": "14:05",
        "exit_time": "14:17",
        "duration": "12 min",
        "source": "NFC",
        "status": "COMPLETED",
        "created_at": "2026-09-29T14:05:00Z"
    },
    {
        "event_id": "evt-demo-102",
        "patient_id": "132547",
        "room_id": "ICU 04",
        "user_id": "usr-nurse-a",
        "role": "Nurse",
        "display_name": "Nurse A",
        "entry_time": "14:22",
        "exit_time": "14:31",
        "duration": "9 min",
        "source": "Manual",
        "status": "COMPLETED",
        "created_at": "2026-09-29T14:22:00Z"
    }
]

NFC_TAG_MAPPINGS = {
    "NFC-TAG-132547": {"patient_id": "132547", "room_id": "ICU 04"},
    "NFC-TAG-132543": {"patient_id": "132543", "room_id": "ICU 03"},
    "NFC-TAG-132539": {"patient_id": "132539", "room_id": "ICU 01"},
    "NFC-TAG-132541": {"patient_id": "132541", "room_id": "ICU 02"},
}

@app.post("/ai/chat")
def grok_ai_chat(req: GrokChatRequest):
    """
    Grok AI Assistant Endpoint (Powered by official xAI API base with strict safety guardrails)
    """
    try:
        if not req.patient_id or not req.message:
            raise HTTPException(status_code=400, detail="patient_id and message are required.")
        res = call_grok_chat(req.patient_id, req.message)
        return res
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Patient RecordID {req.patient_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/nfc/resolve/{tag_id}")
def resolve_nfc_tag(tag_id: str):
    """
    Resolves NFC tag identifier to secure patient ID and room mapping.
    """
    # Accept both NFC-TAG-XXXXXX or direct ID format
    clean_tag = tag_id.strip()
    if clean_tag in NFC_TAG_MAPPINGS:
        return NFC_TAG_MAPPINGS[clean_tag]
    
    # Try resolving NFC-TAG-{id}
    tag_formatted = f"NFC-TAG-{clean_tag}" if not clean_tag.startswith("NFC-TAG-") else clean_tag
    if tag_formatted in NFC_TAG_MAPPINGS:
        return NFC_TAG_MAPPINGS[tag_formatted]

    # Fallback to direct patient lookup if numeric RecordID
    try:
        predictor = get_predictor()
        res = predictor.predict_by_record_id(clean_tag.replace("NFC-TAG-", ""))
        return {"patient_id": res["record_id"], "room_id": "ICU Ward"}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"NFC Tag / Patient ID '{tag_id}' not recognized or unauthorized.")

@app.get("/room-access/{patient_id}")
def get_room_access_history(patient_id: str):
    events = [e for e in ROOM_ACCESS_STORE if e["patient_id"] == patient_id]
    return {"patient_id": patient_id, "events": events}

@app.post("/room-access/event")
def log_room_access_event(evt: RoomAccessEvent):
    import datetime
    now_str = datetime.datetime.now().strftime("%H:%M")
    created_iso = datetime.datetime.now().isoformat() + "Z"
    
    new_evt = {
        "event_id": f"evt-{len(ROOM_ACCESS_STORE) + 101}",
        "patient_id": evt.patient_id,
        "room_id": evt.room_id,
        "user_id": evt.user_id,
        "role": evt.role,
        "display_name": evt.display_name,
        "entry_time": now_str if evt.action == "ENTER" else "N/A",
        "exit_time": now_str if evt.action == "EXIT" else "ACTIVE NOW",
        "duration": "Active Session" if evt.action == "ENTER" else "Session Closed",
        "source": evt.source,
        "status": "ACTIVE" if evt.action == "ENTER" else "COMPLETED",
        "created_at": created_iso
    }
    ROOM_ACCESS_STORE.insert(0, new_evt)
    return {"status": "success", "event": new_evt}

if __name__ == "__main__":
    import uvicorn  # type: ignore
    uvicorn.run(app, host="127.0.0.1", port=8000)

