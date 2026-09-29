import datetime
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger("NeuroCareAlertEngine")

# Central in-memory audit store for prediction history & clinical alerts
# In production, backed by Firebase / PostgreSQL / Firestore
PREDICTION_HISTORY_STORE: Dict[str, List[Dict[str, Any]]] = {}
ALERT_STORE: Dict[str, Dict[str, Any]] = {}

# Known room mapping for ICU patients
ROOM_MAPPINGS = {
    "132539": "ICU Room 01",
    "132541": "ICU Room 02",
    "132543": "ICU Room 03",
    "132547": "ICU Room 04",
    "132548": "ICU Room 05",
    "132551": "ICU Room 06",
    "132554": "ICU Room 07",
    "132555": "ICU Room 08",
    "132567": "ICU Room 09",
    "132570": "ICU Room 10"
}

VALID_ACKNOWLEDGE_ROLES = {"Doctor", "Intensivist", "Physician", "Nurse", "Attending Doctor"}

class ClinicalAlertEngine:
    def __init__(self):
        self.dedup_window_minutes = 60.0

    def record_prediction(self, pred_result: Dict[str, Any]) -> Dict[str, Any]:
        patient_id = str(pred_result["record_id"])
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        snapshot = {
            "prediction_id": f"pred-{patient_id}-{int(datetime.datetime.now().timestamp())}-{len(PREDICTION_HISTORY_STORE.get(patient_id, []))}",
            "patient_id": patient_id,
            "model_version": pred_result.get("model_version", "XGBoost-ICU-v1"),
            "target": pred_result.get("model_target", "inHospitalDeath"),
            "probability": pred_result["mortality_risk_probability"],
            "percentage": pred_result["mortality_risk_percentage"],
            "risk_level": pred_result["mortality_risk_category"],
            "data_cutoff": pred_result.get("data_cutoff", "48.0 Hours ICU Admission Window"),
            "generated_at": now_iso,
            "feature_count": pred_result.get("feature_count", 233),
            "data_quality": pred_result.get("data_quality", "GOOD"),
            "top_contributors": pred_result.get("top_clinical_drivers", [])[:3]
        }

        if patient_id not in PREDICTION_HISTORY_STORE:
            PREDICTION_HISTORY_STORE[patient_id] = []

        history = PREDICTION_HISTORY_STORE[patient_id]
        prev_snapshot = history[0] if len(history) > 0 else None
        
        # Prepend latest snapshot (newest first)
        PREDICTION_HISTORY_STORE[patient_id].insert(0, snapshot)

        # Check for alert generation condition
        alert = self.evaluate_alert_conditions(snapshot, prev_snapshot)
        return snapshot

    def evaluate_alert_conditions(self, current: Dict[str, Any], previous: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        patient_id = current["patient_id"]
        room_id = ROOM_MAPPINGS.get(patient_id, "ICU Ward")
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        curr_prob = current["probability"]
        curr_pct = current["percentage"]
        curr_risk = current["risk_level"]

        alert_type = None
        severity = curr_risk
        title = ""
        message = ""
        prev_prob = previous["probability"] if previous else None
        prev_pct = previous["percentage"] if previous else None

        # Rule 1: Risk level escalation or substantial probability increase
        if previous:
            pct_change = round(curr_pct - prev_pct, 1)
            if curr_pct > prev_pct and (curr_risk != previous["risk_level"] or pct_change >= 5.0):
                alert_type = "MODEL_RISK_INCREASE"
                title = "Model-Estimated Risk Increased"
                message = f"Model-estimated mortality risk score increased by +{pct_change} percentage points (Previous: {prev_pct}%, Current: {curr_pct}%)."
        
        # Rule 2: Decision threshold crossing (0.120 / 12.0%)
        if not alert_type and curr_prob >= 0.120 and (not previous or previous["probability"] < 0.120):
            alert_type = "MODEL_RISK_THRESHOLD"
            severity = "ELEVATED" if curr_prob < 0.450 else "HIGH"
            title = "Mortality Risk Threshold Crossed"
            message = f"Model-estimated mortality risk ({curr_pct}%) crossed the calibrated decision threshold of 12.0%."

        # Rule 3: Data Quality Warning
        if not alert_type and current["data_quality"] in ["DEGRADED", "POOR"]:
            alert_type = "DATA_QUALITY_WARNING"
            severity = "WATCH"
            title = "Telemetry Data Quality Warning"
            message = f"Model prediction computed with {current['data_quality']} telemetry quality. Features missing or irregular."

        if not alert_type:
            return None

        # Check Alert Deduplication (Suppression Rule)
        existing_alerts = [
            a for a in ALERT_STORE.values() 
            if a["patient_id"] == patient_id and a["type"] == alert_type and a["status"] == "ACTIVE"
        ]

        if len(existing_alerts) > 0:
            # Same patient, same type, same risk level active alert -> Suppress duplicate
            latest_existing = existing_alerts[0]
            if latest_existing["risk_level"] == curr_risk and abs(curr_pct - latest_existing["current_probability"] * 100) < 3.0:
                logger.info(f"[ALERT_DEDUP_SUPPRESSED] Patient={patient_id} Type={alert_type} Risk={curr_risk}")
                return None

        alert_id = f"alt-{patient_id}-{int(datetime.datetime.now().timestamp())}-{len(ALERT_STORE) + 1}"
        new_alert = {
            "alert_id": alert_id,
            "patient_id": patient_id,
            "room_id": room_id,
            "type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
            "probability": curr_prob,
            "previous_probability": prev_prob,
            "current_probability": curr_prob,
            "probability_change_pct": round(curr_pct - prev_pct, 1) if prev_pct is not None else 0.0,
            "risk_level": curr_risk,
            "model_version": current["model_version"],
            "data_cutoff": current["data_cutoff"],
            "data_quality": current["data_quality"],
            "top_contributors": current["top_contributors"],
            "created_at": now_iso,
            "acknowledged_at": None,
            "acknowledged_by": None,
            "status": "ACTIVE"
        }

        ALERT_STORE[alert_id] = new_alert
        logger.info(f"[ALERT_GENERATED] AlertID={alert_id} Patient={patient_id} Type={alert_type} Level={curr_risk}")
        return new_alert

    def get_patient_history(self, patient_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        history = PREDICTION_HISTORY_STORE.get(str(patient_id), [])
        return history[:limit]

    def get_patient_alerts(self, patient_id: str) -> List[Dict[str, Any]]:
        patient_id = str(patient_id)
        alerts = [a for a in ALERT_STORE.values() if a["patient_id"] == patient_id]
        alerts.sort(key=lambda x: x["created_at"], reverse=True)
        return alerts

    def get_active_alerts_overview(self) -> List[Dict[str, Any]]:
        active = [a for a in ALERT_STORE.values() if a["status"] == "ACTIVE"]
        active.sort(key=lambda x: x["created_at"], reverse=True)
        return active

    def acknowledge_alert(self, alert_id: str, user_id: str, role: str) -> Dict[str, Any]:
        if alert_id not in ALERT_STORE:
            raise KeyError(f"Alert ID {alert_id} not found.")

        if role not in VALID_ACKNOWLEDGE_ROLES:
            raise PermissionError(f"User role '{role}' is not authorized to acknowledge clinical alerts.")

        alert = ALERT_STORE[alert_id]
        if alert["status"] == "RESOLVED":
            raise ValueError(f"Alert {alert_id} is already resolved.")

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        alert["status"] = "ACKNOWLEDGED"
        alert["acknowledged_at"] = now_iso
        alert["acknowledged_by"] = f"{user_id} ({role})"
        
        logger.info(f"[ALERT_ACKNOWLEDGED] AlertID={alert_id} User={user_id} Role={role}")
        return alert

    def resolve_alert(self, alert_id: str, reason: str = "Clinical evaluation completed") -> Dict[str, Any]:
        if alert_id not in ALERT_STORE:
            raise KeyError(f"Alert ID {alert_id} not found.")

        alert = ALERT_STORE[alert_id]
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        alert["status"] = "RESOLVED"
        alert["resolved_at"] = now_iso
        alert["resolution_reason"] = reason

        logger.info(f"[ALERT_RESOLVED] AlertID={alert_id} Reason={reason}")
        return alert

alert_engine_instance = None

def get_alert_engine() -> ClinicalAlertEngine:
    global alert_engine_instance
    if alert_engine_instance is None:
        alert_engine_instance = ClinicalAlertEngine()
    return alert_engine_instance
