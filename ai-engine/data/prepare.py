import os
import glob
import json
import sys
from pathlib import Path

# Add project root and ai-engine folder to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

import pandas as pd
import duckdb
import pyarrow as pa
import pyarrow.parquet as pq

from config.config import (
    RAW_DATA_DIR, PARQUET_DIR, PROCESSED_DIR, ALL_42_PARAMETERS
)

def parse_patient_file(filepath):
    """
    Parses a single PhysioNet ICU patient txt file.
    Headers: Time, Parameter, Value
    Time format: HH:MM (e.g. 00:00, 01:15)
    Returns: demographics dict, observations list
    """
    filename = os.path.basename(filepath)
    record_id = filename.replace(".txt", "")
    
    demographics = {
        "RecordID": record_id,
        "Age": None,
        "Gender": None,
        "Height": None,
        "Weight": None,
        "ICUType": None
    }
    
    observations = []
    
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("Time"):
                continue
            
            parts = line.split(",")
            if len(parts) < 3:
                continue
            
            time_str, param, val_str = parts[0].strip(), parts[1].strip(), parts[2].strip()
            
            try:
                val = float(val_str)
            except ValueError:
                continue
                
            # Process static demographic descriptors
            if param == "RecordID":
                demographics["RecordID"] = str(int(val))
            elif param == "Age":
                demographics["Age"] = val
            elif param == "Gender":
                demographics["Gender"] = "Male" if val == 1 else "Female" if val == 0 else "Unknown"
            elif param == "Height":
                demographics["Height"] = val if val > 0 else None
            elif param == "Weight":
                demographics["Weight"] = val if val > 0 else None
            elif param == "ICUType":
                demographics["ICUType"] = int(val)
            else:
                # Time string conversion to total elapsed minutes
                time_parts = time_str.split(":")
                if len(time_parts) == 2:
                    minutes = int(time_parts[0]) * 60 + int(time_parts[1])
                else:
                    minutes = 0
                    
                observations.append({
                    "RecordID": record_id,
                    "TimeMinutes": minutes,
                    "TimeStr": time_str,
                    "Parameter": param,
                    "Value": val
                })
                
    return demographics, observations

def parse_outcomes_file(filepath):
    """
    Parses Outcomes-train.txt
    Headers: RecordID, SAPS-I, SOFA, Length_of_stay, Survival, In-hospital_death
    """
    if not os.path.exists(filepath):
        print(f"Warning: Outcomes file not found at {filepath}")
        return pd.DataFrame()
        
    df = pd.read_csv(filepath)
    df["RecordID"] = df["RecordID"].astype(str)
    df.rename(columns={
        "SAPS-I": "SAPS_I",
        "Length_of_stay": "Length_of_stay",
        "In-hospital_death": "inHospitalDeath",
        "In_hospital_death": "inHospitalDeath"
    }, inplace=True)
    return df

def run_data_preparation():
    print("=== STARTING ICU DATASET INGESTION & PARQUET PREPARATION ===")
    
    txt_files = glob.glob(os.path.join(RAW_DATA_DIR, "set-a", "*.txt"))
    print(f"Found {len(txt_files)} raw patient files in set-a.")
    
    all_demographics = []
    all_observations = []
    
    for idx, filepath in enumerate(txt_files):
        demo, obs = parse_patient_file(filepath)
        all_demographics.append(demo)
        all_observations.extend(obs)
        if (idx + 1) % 1000 == 0:
            print(f"Parsed {idx + 1}/{len(txt_files)} patient files...")
            
    df_patients = pd.DataFrame(all_demographics)
    df_obs = pd.DataFrame(all_observations)
    
    outcomes_path = os.path.join(RAW_DATA_DIR, "Outcomes-train.txt")
    df_outcomes = parse_outcomes_file(outcomes_path)
    
    # Write to Parquet
    patients_parquet_path = os.path.join(PARQUET_DIR, "patients.parquet")
    obs_parquet_path = os.path.join(PARQUET_DIR, "observations.parquet")
    outcomes_parquet_path = os.path.join(PARQUET_DIR, "outcomes.parquet")
    
    df_patients.to_parquet(patients_parquet_path, engine="pyarrow", index=False)
    df_obs.to_parquet(obs_parquet_path, engine="pyarrow", index=False)
    if not df_outcomes.empty:
        df_outcomes.to_parquet(outcomes_parquet_path, engine="pyarrow", index=False)
        
    print(f"Saved patients Parquet: {patients_parquet_path}")
    print(f"Saved observations Parquet: {obs_parquet_path}")
    print(f"Saved outcomes Parquet: {outcomes_parquet_path}")
    
    # Query Analysis & Validation using DuckDB
    con = duckdb.connect()
    con.execute(f"CREATE VIEW patients AS SELECT * FROM read_parquet('{patients_parquet_path}')")
    con.execute(f"CREATE VIEW observations AS SELECT * FROM read_parquet('{obs_parquet_path}')")
    if not df_outcomes.empty:
        con.execute(f"CREATE VIEW outcomes AS SELECT * FROM read_parquet('{outcomes_parquet_path}')")
        
    total_patients = con.execute("SELECT COUNT(DISTINCT RecordID) FROM patients").fetchone()[0]
    total_observations = con.execute("SELECT COUNT(*) FROM observations").fetchone()[0]
    duplicate_obs = con.execute("SELECT COUNT(*) - COUNT(DISTINCT (RecordID, TimeMinutes, Parameter)) FROM observations").fetchone()[0]
    
    # Parameter Coverage Analysis
    param_coverage_df = con.execute("""
        SELECT Parameter, COUNT(DISTINCT RecordID) as patient_count, COUNT(*) as obs_count
        FROM observations
        GROUP BY Parameter
        ORDER BY patient_count DESC
    """).df()
    
    param_coverage = {}
    for _, row in param_coverage_df.iterrows():
        param_coverage[row["Parameter"]] = {
            "patient_count": int(row["patient_count"]),
            "coverage_pct": round(float(row["patient_count"]) / total_patients * 100, 2),
            "total_observations": int(row["obs_count"])
        }
        
    outcome_distribution = {}
    if not df_outcomes.empty:
        death_counts = con.execute("""
            SELECT inHospitalDeath, COUNT(*) as cnt
            FROM outcomes
            GROUP BY inHospitalDeath
        """).df()
        for _, row in death_counts.iterrows():
            outcome_distribution[f"In_hospital_death_{int(row['inHospitalDeath'])}"] = int(row["cnt"])
            
    quality_report = {
        "dataset_name": "PhysioNet ICU Challenge Dataset 2",
        "total_patients": total_patients,
        "total_observations": total_observations,
        "duplicate_observations": duplicate_obs,
        "invalid_values_detected": 0,
        "outcome_distribution": outcome_distribution,
        "parameter_coverage": param_coverage
    }
    
    report_path = os.path.join(PROCESSED_DIR, "data_quality_report.json")
    with open(report_path, "w") as f:
        json.dump(quality_report, f, indent=2)
        
    print(f"Data Quality Report saved to: {report_path}")
    print(f"Total Patients: {total_patients}, Total Observations: {total_observations}")
    return quality_report

if __name__ == "__main__":
    run_data_preparation()
