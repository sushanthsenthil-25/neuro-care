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
    PARQUET_DIR, PROCESSED_DIR, ALL_42_PARAMETERS, FREQUENT_SIGNALS, PRIMARY_TARGET
)

PHYSIO_BOUNDS = {
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
    "FiO2": (0.21, 1.0),
    "BUN": (1, 250),
    "Creatinine": (0.1, 30.0),
    "WBC": (0.1, 150.0),
    "Platelets": (5, 1500),
    "HCT": (10, 70),
    "K": (1.0, 10.0),
    "Na": (90, 180),
    "HCO3": (2, 60),
    "Lactate": (0.1, 30.0)
}

KEY_TEMPORAL_SIGNALS = [
    "HR", "SysABP", "DiasABP", "MAP", "Temp", "RespRate", "SaO2", "GCS", "Urine",
    "Glucose", "BUN", "Creatinine", "Lactate", "pH", "PaO2", "PaCO2", "FiO2",
    "WBC", "HCT", "Platelets", "Na", "K", "HCO3"
]

def build_vectorized_advanced_features(df_obs: pd.DataFrame, df_pat: pd.DataFrame, max_time_hours: float = 48.0) -> pd.DataFrame:
    con = duckdb.connect()
    
    # 1. Clean bounds
    bounds_sql = []
    for param, (low, high) in PHYSIO_BOUNDS.items():
        bounds_sql.append(f"(Parameter = '{param}' AND (Value < {low} OR Value > {high}))")
    bounds_clause = " OR ".join(bounds_sql)
    
    con.register("df_obs_raw", df_obs)
    con.register("df_pat_raw", df_pat)

    # Filter observation cutoff & artifacts
    df_obs_clean = con.execute(f"""
        SELECT 
            CAST(RecordID AS VARCHAR) as RecordID, 
            Parameter, 
            CAST(Value AS DOUBLE) as Value, 
            CAST(TimeMinutes / 60.0 AS DOUBLE) as Time_Hours
        FROM df_obs_raw
        WHERE TimeMinutes / 60.0 <= {max_time_hours}
          AND NOT ({bounds_clause})
        ORDER BY RecordID, Parameter, Time_Hours ASC
    """).df()

    con.register("obs", df_obs_clean)

    # Aggregates per patient + parameter
    param_aggs = con.execute(f"""
        SELECT 
            RecordID,
            Parameter,
            LAST_VALUE(Value) OVER w as val_latest,
            FIRST_VALUE(Value) OVER w as val_first,
            MIN(Value) OVER w as val_min,
            MAX(Value) OVER w as val_max,
            AVG(Value) OVER w as val_mean,
            STDDEV_SAMP(Value) OVER w as val_std,
            COUNT(Value) OVER w as val_count,
            MIN(Time_Hours) OVER w as time_first,
            MAX(Time_Hours) OVER w as time_last
        FROM obs
        WINDOW w AS (PARTITION BY RecordID, Parameter ORDER BY Time_Hours ASC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
    """).df().drop_duplicates(subset=['RecordID', 'Parameter'])

    # Pivot stats into patient rows
    patients_df = con.execute("SELECT DISTINCT CAST(RecordID AS VARCHAR) as RecordID, Age, Gender, Height, Weight, ICUType FROM df_pat_raw ORDER BY RecordID ASC").df()
    
    # Transform to wide pivot table
    pivoted = param_aggs.pivot(index='RecordID', columns='Parameter')
    pivoted.columns = [f"{col[1]}_{col[0].replace('val_', '')}" for col in pivoted.columns]
    pivoted = pivoted.reset_index()

    # Join with patients base
    df_feat = patients_df.merge(pivoted, on='RecordID', how='left')
    df_feat = df_feat.sort_values('RecordID').reset_index(drop=True)

    # Convert Gender to numeric
    df_feat['Gender'] = df_feat['Gender'].apply(lambda g: 1.0 if str(g).lower() in ['male', '1', '1.0'] else 0.0 if str(g).lower() in ['female', '0', '0.0'] else np.nan)

    # Feature enhancements: delta, slope, recency, interaction
    for param in FREQUENT_SIGNALS:
        latest_col = f"{param}_latest"
        first_col = f"{param}_first"
        min_col = f"{param}_min"
        max_col = f"{param}_max"
        count_col = f"{param}_count"
        t_last_col = f"{param}_time_last"
        t_first_col = f"{param}_time_first"

        if latest_col not in df_feat.columns:
            df_feat[latest_col] = np.nan
            df_feat[f"{param}_min"] = np.nan
            df_feat[f"{param}_max"] = np.nan
            df_feat[f"{param}_mean"] = np.nan
            df_feat[f"{param}_std"] = np.nan
            df_feat[f"{param}_count"] = 0
            df_feat[f"{param}_is_missing"] = 1
            df_feat[f"{param}_time_since_last"] = max_time_hours
            df_feat[f"{param}_slope"] = np.nan
            df_feat[f"{param}_range"] = np.nan
        else:
            df_feat[f"{param}_is_missing"] = df_feat[latest_col].isna().astype(float)
            df_feat[f"{param}_time_since_last"] = max_time_hours - df_feat[t_last_col].fillna(0.0)
            df_feat[f"{param}_range"] = df_feat[max_col] - df_feat[min_col]
            df_feat[f"{param}_slope"] = (df_feat[latest_col] - df_feat[first_col]) / (df_feat[t_last_col] - df_feat[t_first_col] + 1e-5)
            df_feat[f"{param}_count"] = df_feat[count_col].fillna(0)

    # Compute 0-24h vs 36-48h temporal window comparisons via DuckDB
    window_aggs = con.execute(f"""
        SELECT 
            RecordID,
            Parameter,
            AVG(CASE WHEN Time_Hours <= 24.0 THEN Value ELSE NULL END) as mean_early,
            AVG(CASE WHEN Time_Hours >= 36.0 THEN Value ELSE NULL END) as mean_recent
        FROM obs
        GROUP BY RecordID, Parameter
    """).df()

    win_pivoted = window_aggs.pivot(index='RecordID', columns='Parameter')
    win_pivoted.columns = [f"{col[1]}_{col[0]}" for col in win_pivoted.columns]
    win_pivoted = win_pivoted.reset_index()

    df_feat = df_feat.merge(win_pivoted, on='RecordID', how='left')

    for param in KEY_TEMPORAL_SIGNALS:
        early_col = f"{param}_mean_early"
        recent_col = f"{param}_mean_recent"
        if early_col in df_feat.columns and recent_col in df_feat.columns:
            df_feat[f"{param}_recent_vs_early_delta"] = df_feat[recent_col] - df_feat[early_col]
            df_feat[f"{param}_recent_vs_early_ratio"] = df_feat[recent_col] / (df_feat[early_col].abs() + 1e-5)

    # Derived Cross-Feature Clinical Interactions
    pao2 = df_feat.get('PaO2_latest', pd.Series(np.nan, index=df_feat.index))
    fio2 = df_feat.get('FiO2_latest', pd.Series(np.nan, index=df_feat.index))
    resp = df_feat.get('RespRate_latest', pd.Series(np.nan, index=df_feat.index))
    map_val = df_feat.get('MAP_latest', pd.Series(np.nan, index=df_feat.index))
    hr_val = df_feat.get('HR_latest', pd.Series(np.nan, index=df_feat.index))
    sys_bp = df_feat.get('SysABP_latest', pd.Series(np.nan, index=df_feat.index))
    bun = df_feat.get('BUN_latest', pd.Series(np.nan, index=df_feat.index))
    creat = df_feat.get('Creatinine_latest', pd.Series(np.nan, index=df_feat.index))
    spo2 = df_feat.get('SaO2_latest', pd.Series(np.nan, index=df_feat.index))
    lactate = df_feat.get('Lactate_latest', pd.Series(np.nan, index=df_feat.index))
    age = df_feat.get('Age', pd.Series(np.nan, index=df_feat.index))
    gcs = df_feat.get('GCS_latest', pd.Series(np.nan, index=df_feat.index))
    na = df_feat.get('Na_latest', pd.Series(np.nan, index=df_feat.index))
    hco3 = df_feat.get('HCO3_latest', pd.Series(np.nan, index=df_feat.index))

    fio2_dec = np.where(fio2 <= 1.0, fio2, fio2 / 100.0)
    df_feat['PaO2_FiO2_Ratio'] = np.where((~np.isnan(pao2)) & (~np.isnan(fio2)) & (fio2_dec > 0), pao2 / fio2_dec, np.nan)
    df_feat['ROX_Index'] = np.where((~np.isnan(spo2)) & (~np.isnan(fio2)) & (~np.isnan(resp)) & (resp > 0) & (fio2_dec > 0), (spo2 / fio2_dec) / resp, np.nan)
    df_feat['Shock_Index'] = np.where((~np.isnan(hr_val)) & (~np.isnan(map_val)) & (map_val > 0), hr_val / map_val, np.nan)
    df_feat['Modified_Shock_Index'] = np.where((~np.isnan(hr_val)) & (~np.isnan(sys_bp)) & (sys_bp > 0), hr_val / sys_bp, np.nan)
    df_feat['BUN_Creatinine_Ratio'] = np.where((~np.isnan(bun)) & (~np.isnan(creat)) & (creat > 0), bun / creat, np.nan)
    df_feat['Lactate_MAP_Interaction'] = np.where((~np.isnan(lactate)) & (~np.isnan(map_val)) & (map_val > 0), lactate * (100.0 / map_val), np.nan)
    df_feat['Age_GCS_Interaction'] = np.where((~np.isnan(age)) & (~np.isnan(gcs)), age / (gcs + 1e-5), np.nan)
    df_feat['Anion_Gap_Approx'] = np.where((~np.isnan(na)) & (~np.isnan(hco3)), na - (hco3 + 12.0), np.nan)

    # Drop temporary time_first / time_last helper columns
    drop_cols = [c for c in df_feat.columns if c.endswith('_time_first') or c.endswith('_time_last')]
    df_feat = df_feat.drop(columns=drop_cols)

    return df_feat

def main():
    print("--- Running Fast Vectorized Advanced Feature Engineering ---")
    con = duckdb.connect()

    obs_path = str(PARQUET_DIR / "observations.parquet")
    pat_path = str(PARQUET_DIR / "patients.parquet")
    outcomes_path = str(PARQUET_DIR / "outcomes.parquet")

    df_obs = con.execute(f"SELECT * FROM '{obs_path}'").df()
    df_pat = con.execute(f"SELECT * FROM '{pat_path}'").df()
    df_out = con.execute(f"SELECT * FROM '{outcomes_path}'").df()

    df_features = build_vectorized_advanced_features(df_obs, df_pat, max_time_hours=48.0)

    df_features['RecordID'] = df_features['RecordID'].astype(str)
    df_out['RecordID'] = df_out['RecordID'].astype(str)
    df_features = df_features.merge(df_out[['RecordID', 'inHospitalDeath']], on='RecordID', how='left')

    out_file = PROCESSED_DIR / "advanced_icu_features.parquet"
    df_features.to_parquet(out_file, index=False)
    print(f"Successfully generated {df_features.shape[1]} features for {df_features.shape[0]} patients.")
    print(f"Saved to: {out_file}")

if __name__ == "__main__":
    main()
