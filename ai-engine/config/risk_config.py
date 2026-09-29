"""
Central Risk Configuration System for NeuroCare AI Engine.
Defines the canonical risk thresholds, decision threshold, and risk bands.
"""

MORTALITY_MODEL_CONFIG = {
    "model_name": "In-Hospital Mortality Risk Model",
    "model_version": "XGBoost-ICU-v1",
    "primary_target": "inHospitalDeath",
    "decision_threshold": 0.120, # Calibrated from Youden's J index on test set
    "eval_auroc": 0.7952,
    "eval_auprc": 0.4328,
    "eval_sensitivity": 0.7273,
    "eval_specificity": 0.7150,
    "display_bands": {
        "LOW": (0.0, 0.120),       # Below decision threshold (< 12%)
        "WATCH": (0.120, 0.250),    # Just above decision threshold (12% - 25%)
        "ELEVATED": (0.250, 0.450), # Elevated mortality risk (25% - 45%) - e.g. Patient 132547 (28.14%)
        "HIGH": (0.450, 1.000)      # High mortality risk (> 45%)
    }
}

EARLY_WARNING_CONFIG = {
    "engine_name": "NeuroCare Early Warning Engine v1",
    "status": "Research Prototype",
    "disclaimer": "Decision-support prototype — not a substitute for clinical judgment.",
    "display_bands": {
        "STABLE": (0, 24),
        "WATCH": (25, 44),
        "ELEVATED": (45, 69),
        "CRITICAL": (70, 100)
    }
}

def get_mortality_risk_category(score: float) -> str:
    """
    Returns the canonical mortality risk category for a given probability score.
    """
    bands = MORTALITY_MODEL_CONFIG["display_bands"]
    if score < bands["LOW"][1]:
        return "LOW"
    elif score < bands["WATCH"][1]:
        return "WATCH"
    elif score < bands["ELEVATED"][1]:
        return "ELEVATED"
    else:
        return "HIGH"

def get_early_warning_level(score: int) -> str:
    """
    Returns the canonical early warning level for a trajectory score.
    """
    bands = EARLY_WARNING_CONFIG["display_bands"]
    if score < bands["STABLE"][1]:
        return "STABLE"
    elif score < bands["WATCH"][1]:
        return "WATCH"
    elif score < bands["ELEVATED"][1]:
        return "ELEVATED"
    else:
        return "CRITICAL"
