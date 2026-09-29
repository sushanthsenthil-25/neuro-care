import os
import sys
import numpy as np
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from config.config import PARQUET_DIR, PROCESSED_DIR

class NeuroCareEarlyWarningEngine:
    """
    NeuroCare Early Warning Engine v1
    Analyses real-time physiological time-series trajectories for acute deterioration evidence.
    Enforces time cutoff: observation_time <= T (never uses observation_time > T).
    """

    def __init__(self):
        self.obs_parquet = PARQUET_DIR / "observations.parquet"
        self.pat_parquet = PARQUET_DIR / "patients.parquet"
        
        if self.obs_parquet.exists():
            self.df_obs = pd.read_parquet(self.obs_parquet)
            self.df_obs['RecordID'] = self.df_obs['RecordID'].astype(str)
            if 'Time_Hours' not in self.df_obs.columns:
                self.df_obs['Time_Hours'] = self.df_obs['TimeMinutes'] / 60.0
        else:
            self.df_obs = pd.DataFrame()

    def detect_sensor_artifact(self, values):
        """
        Detects isolated single-reading physiological spikes (e.g. 92 -> 93 -> 250 -> 94).
        """
        if len(values) < 3:
            return False, values
            
        cleaned_values = list(values)
        has_artifact = False
        
        for i in range(1, len(values) - 1):
            prev_v, curr_v, next_v = values[i-1], values[i], values[i+1]
            # Isolated spike check: current value jumps >50% relative to both prev and next values
            if abs(curr_v - prev_v) > 0.5 * prev_v and abs(curr_v - next_v) > 0.5 * next_v:
                has_artifact = True
                cleaned_values[i] = (prev_v + next_v) / 2.0
                
        return has_artifact, cleaned_values

    def calculate_trajectory(self, record_id: str, cutoff_hours: float = 48.0):
        record_id = str(record_id)
        
        if self.df_obs.empty:
            return self._insufficient_data_response(record_id, "Observation database empty.")

        # Strictly enforce observation_time <= cutoff_hours
        p_obs = self.df_obs[
            (self.df_obs['RecordID'].astype(str) == str(record_id)) & 
            (self.df_obs['Time_Hours'] <= cutoff_hours)
        ].sort_values('Time_Hours')

        if len(p_obs) < 2:
            return self._insufficient_data_response(record_id, f"Fewer than 2 observations available up to t={cutoff_hours}h.")

        supporting_signals = []
        top_signals = []
        deterioration_points = 0
        artifacts_detected = 0

        # High-Priority Vital Signals & Normal Ranges
        VITAL_RULES = {
            "HR": {"high": 100, "low": 50, "unit": "bpm", "critical_high": 120},
            "MAP": {"high": 110, "low": 65, "unit": "mmHg", "critical_low": 55},
            "RespRate": {"high": 22, "low": 10, "unit": "rpm", "critical_high": 28},
            "SaO2": {"high": 100, "low": 93, "unit": "%", "critical_low": 90},
            "Temp": {"high": 38.0, "low": 36.0, "unit": "°C", "critical_high": 38.5},
            "GCS": {"high": 15, "low": 12, "unit": "points", "critical_low": 8},
            "Urine": {"high": 200, "low": 30, "unit": "ml/hr", "critical_low": 15},
            "Lactate": {"high": 2.0, "low": 0.5, "unit": "mmol/L", "critical_high": 4.0},
            "Creatinine": {"high": 1.3, "low": 0.5, "unit": "mg/dL", "critical_high": 2.5},
            "WBC": {"high": 11.0, "low": 4.0, "unit": "k/uL", "critical_high": 18.0}
        }

        signal_trends = {}
        last_time_found = float(p_obs['Time_Hours'].max())

        for param, rules in VITAL_RULES.items():
            sub = p_obs[p_obs['Parameter'] == param].sort_values('Time_Hours')
            if not sub.empty:
                raw_vals = sub['Value'].values
                times = sub['Time_Hours'].values

                # Sensor Artifact Filter
                is_artifact, vals = self.detect_sensor_artifact(raw_vals)
                if is_artifact:
                    artifacts_detected += 1
                    supporting_signals.append({
                        "parameter": param,
                        "type": "SENSOR_ARTIFACT",
                        "description": f"Possible sensor/data artifact detected in {param} series (isolated spike filtered)."
                    })

                last_val = vals[-1]
                prev_val = vals[-2] if len(vals) > 1 else last_val
                delta = last_val - prev_val

                trend_dir = "STABLE"
                if delta > 0.05 * abs(prev_val + 1e-5):
                    trend_dir = "INCREASING"
                elif delta < -0.05 * abs(prev_val + 1e-5):
                    trend_dir = "DECREASING"

                signal_trends[param] = {
                    "last_value": round(float(last_val), 2),
                    "prev_value": round(float(prev_val), 2),
                    "trend_direction": trend_dir,
                    "unit": rules["unit"]
                }

                # Evaluate deterioration evidence
                if param == "HR" and last_val > rules["high"]:
                    deterioration_points += 15 if last_val > rules["critical_high"] else 10
                    sig_desc = f"Heart Rate elevated to {last_val:.0f} {rules['unit']} (increasing trajectory)."
                    supporting_signals.append({"parameter": "HR", "trend": f"{prev_val:.0f} → {last_val:.0f} {rules['unit']}", "impact": "INCREASING_TACHYCHARDIA", "description": sig_desc})
                    top_signals.append(sig_desc)

                elif param == "MAP" and last_val < rules["low"]:
                    deterioration_points += 20 if last_val < rules["critical_low"] else 12
                    sig_desc = f"Mean Arterial Pressure decreased to {last_val:.0f} {rules['unit']} (hypotensive trajectory)."
                    supporting_signals.append({"parameter": "MAP", "trend": f"{prev_val:.0f} → {last_val:.0f} {rules['unit']}", "impact": "DECREASING_HYPOTENSION", "description": sig_desc})
                    top_signals.append(sig_desc)

                elif param == "SaO2" and last_val < rules["low"]:
                    deterioration_points += 25 if last_val < rules["critical_low"] else 15
                    sig_desc = f"Oxygen Saturation reduced to {last_val:.0f}% (desaturation trajectory)."
                    supporting_signals.append({"parameter": "SaO2", "trend": f"{prev_val:.0f} → {last_val:.0f} {rules['unit']}", "impact": "DESATURATION", "description": sig_desc})
                    top_signals.append(sig_desc)

                elif param == "RespRate" and last_val > rules["high"]:
                    deterioration_points += 15 if last_val > rules["critical_high"] else 10
                    sig_desc = f"Respiratory Rate elevated to {last_val:.0f} rpm (tachypneic trajectory)."
                    supporting_signals.append({"parameter": "RespRate", "trend": f"{prev_val:.0f} → {last_val:.0f} {rules['unit']}", "impact": "TACHYPNEA", "description": sig_desc})
                    top_signals.append(sig_desc)

                elif param == "GCS" and last_val < rules["high"]:
                    deterioration_points += 25 if last_val <= rules["critical_low"] else 15
                    sig_desc = f"Glasgow Coma Scale reduced to {last_val:.0f} (neurological decline trajectory)."
                    supporting_signals.append({"parameter": "GCS", "trend": f"{prev_val:.0f} → {last_val:.0f} {rules['unit']}", "impact": "NEUROLOGICAL_DECLINE", "description": sig_desc})
                    top_signals.append(sig_desc)

                elif param == "Lactate" and last_val > rules["high"]:
                    deterioration_points += 15
                    sig_desc = f"Serum Lactate elevated to {last_val:.1f} mmol/L (metabolic stress trajectory)."
                    supporting_signals.append({"parameter": "Lactate", "trend": f"{prev_val:.1f} → {last_val:.1f} {rules['unit']}", "impact": "HYPERLACTATEMIA", "description": sig_desc})
                    top_signals.append(sig_desc)

        # Cross-Signal Consistency Multiplier
        concordant_vital_count = len([s for s in supporting_signals if s.get("impact") in [
            "INCREASING_TACHYCHARDIA", "DECREASING_HYPOTENSION", "DESATURATION", "TACHYPNEA", "NEUROLOGICAL_DECLINE"
        ]])

        if concordant_vital_count >= 3:
            deterioration_points = int(deterioration_points * 1.35)
            conc_desc = f"High Cross-Signal Evidence: {concordant_vital_count} independent vital systems show concurrent worsening."
            supporting_signals.append({
                "parameter": "CROSS_SIGNAL_CONCORDANCE",
                "trend": f"{concordant_vital_count} concordant signals",
                "impact": "HIGH_CROSS_SIGNAL_EVIDENCE",
                "description": conc_desc
            })
            top_signals.insert(0, conc_desc)

        # Calculate Trajectory Score & Level
        trajectory_score = min(99, max(5, deterioration_points + 10))

        if trajectory_score >= 70:
            warning_level = "CRITICAL"
            overall_trend = "DETERIORATING"
        elif trajectory_score >= 45:
            warning_level = "ELEVATED"
            overall_trend = "DETERIORATING"
        elif trajectory_score >= 25:
            warning_level = "WATCH"
            overall_trend = "UNSTABLE"
        else:
            warning_level = "STABLE"
            overall_trend = "STABLE"

        # Telemetry Data Quality Evaluation (Auto-Filtered & Smooth)
        if artifacts_detected > 1:
            data_quality = "HEALTHY (Auto-Filtered)"
        elif artifacts_detected == 1:
            data_quality = "HEALTHY (Artifact Suppressed)"
        else:
            data_quality = "OPTIMAL"

        explanation_summary = f"Patient trajectory evaluated up to t={last_time_found:.1f}h. Trajectory score is {trajectory_score}/100 based on {len(supporting_signals)} active physiological signal trends."

        return {
            "record_id": record_id,
            "cutoff_hours": cutoff_hours,
            "measurement_time": f"{last_time_found:.1f}h post-admission",
            "trajectory_score": trajectory_score,
            "warning_level": warning_level,
            "early_warning_level": warning_level,
            "trend_direction": overall_trend,
            "top_signals": top_signals if top_signals else ["Vital parameters remain within baseline ranges."],
            "supporting_signals": supporting_signals,
            "signal_trends": signal_trends,
            "data_quality": data_quality,
            "artifacts_detected": artifacts_detected,
            "confidence_indicator": "HIGH" if data_quality == "GOOD" else "MODERATE",
            "model_or_engine_version": "NeuroCare Early Warning Engine v1",
            "explanation": explanation_summary,
            "limitations": "PhysioNet ICU dataset outcome labels do not contain exact deterioration timestamps. Trajectory score is a rule-based research prototype.",
            "status": "Research Prototype",
            "clinical_notice": "Potential deterioration pattern detected based on physiological trajectory. Research prototype only — not a validated medical diagnosis."
        }

    def get_telemetry_status(self, record_id: str):
        """
        Calculates per-sensor telemetry device status (GREEN/YELLOW/RED) from real patient observations.
        Crucial: Device status describes signal/hardware health, NOT patient clinical risk.
        """
        record_id = str(record_id)
        if self.df_obs.empty:
            return {"patient_id": record_id, "sensors": {}, "overall_telemetry_quality": "INSUFFICIENT_DATA"}

        p_obs = self.df_obs[self.df_obs['RecordID'].astype(str) == str(record_id)].sort_values('Time_Hours')
        if p_obs.empty:
            return {"patient_id": record_id, "sensors": {}, "overall_telemetry_quality": "NO_DATA"}

        max_time = float(p_obs['Time_Hours'].max())
        
        sensors = {}
        SENSOR_MAP = {
            "HR": {"name": "Heart Rate", "unit": "bpm"},
            "SaO2": {"name": "SpO₂ Oxygen", "unit": "%"},
            "RespRate": {"name": "Respiratory Rate", "unit": "rpm"},
            "SysABP": {"name": "Systolic BP", "unit": "mmHg"},
            "DiasABP": {"name": "Diastolic BP", "unit": "mmHg"},
            "MAP": {"name": "Mean Arterial Pressure", "unit": "mmHg"},
            "Temp": {"name": "Temperature", "unit": "°C"},
            "GCS": {"name": "Glasgow Coma Scale", "unit": "points"},
            "Urine": {"name": "Urine Output", "unit": "ml/hr"}
        }

        yellow_count = 0
        red_count = 0

        for param, meta in SENSOR_MAP.items():
            sub = p_obs[p_obs['Parameter'] == param].sort_values('Time_Hours')
            if sub.empty:
                sensors[param] = {
                    "param": param,
                    "name": meta["name"],
                    "unit": meta["unit"],
                    "value": None,
                    "last_updated": "Data unavailable",
                    "status": "RED",
                    "status_reason": "No valid readings in dataset for this parameter"
                }
                red_count += 1
            else:
                last_time = float(sub['Time_Hours'].max())
                last_val = float(sub['Value'].iloc[-1])
                obs_count = len(sub)
                time_diff = max_time - last_time

                if time_diff > 12.0 or obs_count < 2:
                    status = "YELLOW"
                    status_reason = f"Intermittent readings (last recorded t={last_time:.1f}h)"
                    yellow_count += 1
                elif obs_count == 0:
                    status = "RED"
                    status_reason = "No recent valid measurement"
                    red_count += 1
                else:
                    status = "GREEN"
                    status_reason = "Signal normal / continuous telemetry"

                sensors[param] = {
                    "param": param,
                    "name": meta["name"],
                    "unit": meta["unit"],
                    "value": round(last_val, 1) if param != "GCS" else int(last_val),
                    "last_updated": f"t={last_time:.1f}h",
                    "status": status,
                    "status_reason": status_reason,
                    "reading_count": obs_count
                }

        overall_quality = "Good"
        if red_count >= 2:
            overall_quality = "Poor"
        elif yellow_count >= 2 or red_count == 1:
            overall_quality = "Degraded"

        return {
            "patient_id": record_id,
            "max_observation_time": f"{max_time:.1f}h",
            "sensors": sensors,
            "overall_telemetry_quality": overall_quality
        }

    def get_vitals_trends(self, record_id: str, hours: float = 24.0):
        """
        Returns real patient-specific chronological trend series preserving actual observation timestamps.
        Does NOT fabricate fake observations or interpolate equal spacing silently.
        """
        record_id = str(record_id)
        if self.df_obs.empty:
            return {"patient_id": record_id, "range_hours": hours, "series": {}, "trend_summary": {}}

        p_obs = self.df_obs[self.df_obs['RecordID'].astype(str) == str(record_id)].sort_values('Time_Hours')
        if p_obs.empty:
            return {"patient_id": record_id, "range_hours": hours, "series": {}, "trend_summary": {}}

        max_time = float(p_obs['Time_Hours'].max())
        min_time = max(0.0, max_time - float(hours))

        window_obs = p_obs[(p_obs['Time_Hours'] >= min_time) & (p_obs['Time_Hours'] <= max_time)].sort_values('Time_Hours')

        target_params = ["HR", "SaO2", "RespRate", "SysABP", "DiasABP", "MAP", "Temp", "GCS"]
        series = {}
        trend_summary = {}

        for param in target_params:
            sub = window_obs[window_obs['Parameter'] == param].sort_values('Time_Hours')
            if sub.empty:
                sub = p_obs[p_obs['Parameter'] == param].sort_values('Time_Hours')

            if not sub.empty:
                param_series = []
                for _, r in sub.iterrows():
                    t_h = float(r['Time_Hours'])
                    v = float(r['Value'])
                    h_int = int(t_h)
                    m_int = int(round((t_h - h_int) * 60))
                    time_label = f"{h_int:02d}:{m_int:02d}"

                    param_series.append({
                        "time_hours": round(t_h, 2),
                        "time": time_label,
                        "value": round(v, 1) if param != "GCS" else int(v)
                    })
                
                series[param] = param_series

                vals = [p["value"] for p in param_series]
                curr_v = vals[-1]
                prev_v = vals[-2] if len(vals) > 1 else curr_v
                delta = curr_v - prev_v
                pct_change = round((delta / prev_v) * 100, 1) if prev_v != 0 else 0.0

                if delta > 0.03 * (abs(prev_v) + 1e-5):
                    direction = "RISING"
                elif delta < -0.03 * (abs(prev_v) + 1e-5):
                    direction = "FALLING"
                elif len(vals) >= 2:
                    direction = "STABLE"
                else:
                    direction = "INSUFFICIENT DATA"

                trend_summary[param] = {
                    "current": curr_v,
                    "previous": prev_v,
                    "delta": round(delta, 1),
                    "pct_change": pct_change,
                    "direction": direction,
                    "total_points": len(vals)
                }
            else:
                series[param] = []
                trend_summary[param] = {
                    "current": None,
                    "previous": None,
                    "delta": 0,
                    "pct_change": 0,
                    "direction": "INSUFFICIENT DATA",
                    "total_points": 0
                }

        bp_series = []
        sys_sub = series.get("SysABP", [])
        dia_sub = series.get("DiasABP", [])
        map_sub = series.get("MAP", [])
        
        bp_times = sorted(list(set([p["time_hours"] for p in sys_sub] + [p["time_hours"] for p in dia_sub])))
        for t in bp_times:
            s_val = next((p["value"] for p in sys_sub if p["time_hours"] == t), None)
            d_val = next((p["value"] for p in dia_sub if p["time_hours"] == t), None)
            m_val = next((p["value"] for p in map_sub if p["time_hours"] == t), None)
            t_label = next((p["time"] for p in sys_sub if p["time_hours"] == t), f"{int(t):02d}:{int(round((t-int(t))*60)):02d}")
            
            bp_series.append({
                "time_hours": t,
                "time": t_label,
                "sysBp": s_val,
                "diaBp": d_val,
                "map": m_val,
                "value": s_val if s_val is not None else m_val
            })
            
        series["BloodPressure"] = bp_series

        return {
            "patient_id": record_id,
            "range_hours": hours,
            "series": series,
            "trend_summary": trend_summary
        }

    def _insufficient_data_response(self, record_id: str, reason: str):
        return {
            "record_id": str(record_id),
            "cutoff_hours": 48.0,
            "measurement_time": "N/A",
            "trajectory_score": 0,
            "warning_level": "INSUFFICIENT_DATA",
            "early_warning_level": "INSUFFICIENT_DATA",
            "trend_direction": "STABLE",
            "top_signals": [f"Insufficient telemetry data: {reason}"],
            "supporting_signals": [],
            "signal_trends": {},
            "data_quality": "INSUFFICIENT_DATA",
            "artifacts_detected": 0,
            "confidence_indicator": "LOW",
            "model_or_engine_version": "NeuroCare Early Warning Engine v1",
            "explanation": f"Cannot compute trajectory: {reason}",
            "limitations": "Insufficient time-series observations available for trajectory calculation.",
            "status": "Research Prototype",
            "clinical_notice": "Insufficient clinical data for trajectory evaluation."
        }

early_warning_instance = None

def get_early_warning_engine():
    global early_warning_instance
    if early_warning_instance is None:
        early_warning_instance = NeuroCareEarlyWarningEngine()
    return early_warning_instance
