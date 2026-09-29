import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw" / "train"
PARQUET_DIR = DATA_DIR / "parquet"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = BASE_DIR / "models"
EVALUATION_DIR = BASE_DIR / "evaluation"
REPORTS_DIR = EVALUATION_DIR / "reports"

# Ensure directories exist
for d in [PARQUET_DIR, PROCESSED_DIR, MODELS_DIR, EVALUATION_DIR, REPORTS_DIR]:
    os.makedirs(d, exist_ok=True)

# Random Seed & Reproducibility
RANDOM_SEED = 42

# Data Splitting Ratios (Patient-Level Split)
TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15

# Target Definition
PRIMARY_TARGET = "inHospitalDeath" # Binary 0/1 from Outcomes-train.txt

# Central Risk Configuration
from .risk_config import MORTALITY_MODEL_CONFIG, EARLY_WARNING_CONFIG, get_mortality_risk_category

RISK_THRESHOLDS = MORTALITY_MODEL_CONFIG["display_bands"]

# Supported 42 ICU Clinical Parameters
ALL_42_PARAMETERS = [
    "RecordID", "Age", "Gender", "Height", "Weight", "ICUType",
    "HR", "Temp", "RespRate", "SaO2", "GCS", "Urine",
    "SysABP", "DiasABP", "MAP", "NISysABP", "NIDiasABP", "NIMAP",
    "Glucose", "Na", "K", "Mg", "HCO3", "BUN", "Creatinine",
    "HCT", "WBC", "Platelets", "Albumin", "Lactate", "pH",
    "PaO2", "PaCO2", "FiO2", "ALT", "AST", "ALP", "Bilirubin",
    "Cholesterol", "TroponinI", "TroponinT", "MechVent"
]

# High-Value Frequent Signal List for Temporal Features
FREQUENT_SIGNALS = [
    "HR", "Temp", "RespRate", "SaO2", "GCS", "Urine",
    "SysABP", "DiasABP", "MAP", "Glucose", "Na", "K", "Mg",
    "HCO3", "BUN", "Creatinine", "HCT", "WBC", "Platelets",
    "PaO2", "PaCO2", "pH", "FiO2", "Lactate", "MechVent"
]
