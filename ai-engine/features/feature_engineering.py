import os
import json
import sys
import numpy as np
import pandas as pd
import duckdb
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR.parent))
sys.path.insert(0, str(BASE_DIR))

from config.config import (
    PARQUET_DIR, PROCESSED_DIR, ALL_42_PARAMETERS, FREQUENT_SIGNALS, RANDOM_SEED
)

def filter_sensor_artifacts(df_obs):
    """
    Spike detection & removal: e.g. 92 -> 93 -> 250 -> 94 isolated spike.
    Replaces physiologically impossible outliers with NaN or removes them.
    """
    # Define physiological valid bounds for parameters
    BOUNDS = {
        "HR": (20, 250),
        "Temp": (30, 45),
        "RespRate": (4, 60),
        "SaO2": (40, 100),
        "MAP": (20, 220),
        "SysABP": (30, 280),
        "DiasABP": (10, 180),
        "Glucose": (10, 1000),
        "GCS": (3, 15),
        "pH": (6.5, 8.0),
        "PaO2": (20, 700),
        "PaCO2": (10, 150),
        "FiO2": (0.21, 1.0)
    }

    cleaned = df_obs.copy()
    for param, (low, high) in BOUNDS.items():
        mask = (cleaned['Parameter'] == param)
        invalid_mask = mask & ((cleaned['Value'] < low) | (cleaned['Value'] > high))
        cleaned = cleaned[~invalid_mask]

    return cleaned

def extract_patient_features(df_obs, df_patients, max_time_hours=48.0):
    """
    Extracts time-aware features strictly using observations t <= max_time_hours.
    Never uses future observations t > max_time_hours.
    """
    if 'Time_Hours' not in df_obs.columns:
        df_obs['Time_Hours'] = df_obs['TimeMinutes'] / 60.0

    # Filter observations up to cutoff time
    df_cutoff = df_obs[df_obs['Time_Hours'] <= max_time_hours].copy()

    records = []
    patient_ids = df_patients['RecordID'].unique()

    # Group by patient
    obs_by_patient = dict(tuple(df_cutoff.groupby('RecordID')))
    pat_info = df_patients.set_index('RecordID').to_dict('index')

    for record_id in patient_ids:
        feat = {'RecordID': record_id}
        
        # Demographics
        if record_id in pat_info:
            p_meta = pat_info[record_id]
            feat['Age'] = float(p_meta.get('Age', np.nan)) if p_meta.get('Age') is not None else np.nan
            gender_val = p_meta.get('Gender')
            feat['Gender'] = 1.0 if gender_val == 'Male' or gender_val == 1 else 0.0 if gender_val == 'Female' or gender_val == 0 else np.nan
            feat['Height'] = float(p_meta.get('Height', np.nan)) if p_meta.get('Height') is not None else np.nan
            feat['Weight'] = float(p_meta.get('Weight', np.nan)) if p_meta.get('Weight') is not None else np.nan
            feat['ICUType'] = float(p_meta.get('ICUType', np.nan)) if p_meta.get('ICUType') is not None else np.nan
        else:
            feat['Age'] = np.nan
            feat['Gender'] = np.nan
            feat['Height'] = np.nan
            feat['Weight'] = np.nan
            feat['ICUType'] = np.nan

        p_obs = obs_by_patient.get(record_id, pd.DataFrame())

        if not p_obs.empty:
            for param in FREQUENT_SIGNALS:
                sub = p_obs[p_obs['Parameter'] == param].sort_values('Time_Hours')
                if not sub.empty:
                    vals = sub['Value'].values
                    times = sub['Time_Hours'].values
                    
                    feat[f'{param}_last'] = vals[-1]
                    feat[f'{param}_min'] = np.min(vals)
                    feat[f'{param}_max'] = np.max(vals)
                    feat[f'{param}_mean'] = np.mean(vals)
                    feat[f'{param}_std'] = np.std(vals) if len(vals) > 1 else 0.0
                    feat[f'{param}_count'] = len(vals)
                    feat[f'{param}_time_since_last'] = max_time_hours - times[-1]

                    if len(vals) > 1:
                        feat[f'{param}_delta'] = vals[-1] - vals[-2]
                        feat[f'{param}_pct_change'] = (vals[-1] - vals[-2]) / (abs(vals[-2]) + 1e-5)
                        feat[f'{param}_slope'] = (vals[-1] - vals[0]) / (times[-1] - times[0] + 1e-5)
                    else:
                        feat[f'{param}_delta'] = 0.0
                        feat[f'{param}_pct_change'] = 0.0
                        feat[f'{param}_slope'] = 0.0

                    feat[f'{param}_is_missing'] = 0
                else:
                    feat[f'{param}_last'] = np.nan
                    feat[f'{param}_min'] = np.nan
                    feat[f'{param}_max'] = np.nan
                    feat[f'{param}_mean'] = np.nan
                    feat[f'{param}_std'] = np.nan
                    feat[f'{param}_count'] = 0
                    feat[f'{param}_time_since_last'] = max_time_hours
                    feat[f'{param}_delta'] = np.nan
                    feat[f'{param}_pct_change'] = np.nan
                    feat[f'{param}_slope'] = np.nan
                    feat[f'{param}_is_missing'] = 1

            # Cross-Sensor Features
            pao2 = feat.get('PaO2_last', np.nan)
            fio2 = feat.get('FiO2_last', np.nan)
            if not np.isnan(pao2) and not np.isnan(fio2) and fio2 > 0:
                feat['PaO2_FiO2_Ratio'] = pao2 / (fio2 if fio2 <= 1.0 else fio2 / 100.0)
            else:
                feat['PaO2_FiO2_Ratio'] = np.nan

            map_val = feat.get('MAP_last', np.nan)
            hr_val = feat.get('HR_last', np.nan)
            if not np.isnan(map_val) and not np.isnan(hr_val):
                feat['Shock_Index'] = hr_val / (map_val + 1e-5)
            else:
                feat['Shock_Index'] = np.nan

            lactate = feat.get('Lactate_last', np.nan)
            if not np.isnan(lactate) and not np.isnan(map_val):
                feat['Lactate_MAP_Interaction'] = lactate * (100.0 / (map_val + 1e-5))
            else:
                feat['Lactate_MAP_Interaction'] = np.nan

        else:
            for param in FREQUENT_SIGNALS:
                feat[f'{param}_last'] = np.nan
                feat[f'{param}_min'] = np.nan
                feat[f'{param}_max'] = np.nan
                feat[f'{param}_mean'] = np.nan
                feat[f'{param}_std'] = np.nan
                feat[f'{param}_count'] = 0
                feat[f'{param}_time_since_last'] = max_time_hours
                feat[f'{param}_delta'] = np.nan
                feat[f'{param}_pct_change'] = np.nan
                feat[f'{param}_slope'] = np.nan
                feat[f'{param}_is_missing'] = 1
            feat['PaO2_FiO2_Ratio'] = np.nan
            feat['Shock_Index'] = np.nan
            feat['Lactate_MAP_Interaction'] = np.nan

        records.append(feat)

    df_features = pd.DataFrame(records)
    return df_features

def main():
    print("--- Starting Feature Engineering Pipeline ---")
    con = duckdb.connect()
    
    obs_path = str(PARQUET_DIR / "observations.parquet")
    pat_path = str(PARQUET_DIR / "patients.parquet")
    outcomes_path = str(PARQUET_DIR / "outcomes.parquet")

    df_obs = con.execute(f"SELECT * FROM '{obs_path}'").df()
    df_pat = con.execute(f"SELECT * FROM '{pat_path}'").df()
    df_out = con.execute(f"SELECT * FROM '{outcomes_path}'").df()

    print(f"Loaded {len(df_obs)} observations for {len(df_pat)} patients.")

    # 1. Artifact filter
    df_obs_clean = filter_sensor_artifacts(df_obs)
    print(f"Cleaned observations count: {len(df_obs_clean)}")

    # 2. Extract features at 48h cutoff
    df_features = extract_patient_features(df_obs_clean, df_pat, max_time_hours=48.0)
    
    # Merge with target
    df_features = df_features.merge(df_out[['RecordID', 'inHospitalDeath']], on='RecordID', how='left')

    out_file = PROCESSED_DIR / "icu_patient_features.parquet"
    df_features.to_parquet(out_file, index=False)
    print(f"Feature dataset created successfully with {df_features.shape[0]} patients and {df_features.shape[1]} features.")
    print(f"Saved to {out_file}")

if __name__ == "__main__":
    main()
