export interface RiskPredictionResponse {
  record_id: string;
  patient_id?: string;
  risk_score: number;
  risk_percentage: number;
  mortality_risk_probability?: number;
  mortality_risk_percentage?: number;
  mortality_risk_category?: string;
  risk_level: 'LOW' | 'WATCH' | 'ELEVATED' | 'HIGH' | string;
  top_clinical_drivers: Array<{
    feature: string;
    value: number | null;
    shap_value?: number;
    contribution?: number;
    direction?: string;
    impact: 'higher_contribution' | 'lower_contribution' | string;
    clinical_significance: string;
  }>;
  model_version: string;
  evaluation_auroc: number;
  generated_at?: string;
  data_cutoff?: string;
  feature_count?: number;
  data_quality?: 'GOOD' | 'DEGRADED' | 'POOR' | string;
  disclaimer?: string;
}

const API_BASE_URL = 'http://127.0.0.1:8000';

export async function fetchPatientRiskScore(patientId: string): Promise<RiskPredictionResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/risk`);
    if (!res.ok) {
      console.warn(`FastAPI server returned status ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`Could not reach FastAPI server at ${API_BASE_URL}:`, err);
    return null;
  }
}

export interface EarlyWarningResponse {
  record_id: string;
  cutoff_hours: number;
  trajectory_score: number;
  early_warning_level: 'STABLE' | 'WATCH' | 'ELEVATED' | 'CRITICAL';
  trend_direction: 'STABLE' | 'STABILIZING' | 'UNSTABLE' | 'DETERIORATING';
  supporting_signals: Array<{
    parameter: string;
    trend?: string;
    impact?: string;
    type?: string;
    description: string;
  }>;
  signal_trends: Record<string, {
    last_value: number;
    prev_value: number;
    trend_direction: string;
    unit: string;
  }>;
  data_quality: 'GOOD' | 'DEGRADED' | 'POOR';
  artifacts_detected: number;
  confidence_indicator: string;
  engine_name: string;
  status: string;
  clinical_notice: string;
}

export async function fetchEarlyWarningData(patientId: string): Promise<EarlyWarningResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/early-warning`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface GrokChatResponse {
  response: string;
  patient_id: string;
  model_used: string;
  api_key_configured: boolean;
  context_summary?: {
    mortality_percentage: number;
    early_warning_level: string;
  };
}

export async function sendGrokChatMessage(patientId: string, message: string): Promise<GrokChatResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, message })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Error connecting to Grok AI endpoint at ${API_BASE_URL}:`, err);
    return null;
  }
}

export async function resolveNFCTagBackend(tagId: string): Promise<{ patient_id: string; room_id: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/nfc/resolve/${encodeURIComponent(tagId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface RoomAccessEventData {
  event_id?: string;
  patient_id: string;
  room_id: string;
  user_id: string;
  role: string;
  display_name: string;
  action: 'ENTER' | 'EXIT';
  source?: string;
  entry_time?: string;
  exit_time?: string;
  duration?: string;
  status?: string;
}

export async function fetchRoomAccessEvents(patientId: string): Promise<RoomAccessEventData[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/room-access/${patientId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch (err) {
    return [];
  }
}

export async function logRoomAccessEventBackend(evt: RoomAccessEventData): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/room-access/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evt)
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function fetchRoomsRiskOverview(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/risk-overview`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface SensorStatus {
  param: string;
  name: string;
  unit: string;
  value: number | null;
  last_updated: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  status_reason: string;
  reading_count?: number;
}

export interface TelemetryStatusResponse {
  patient_id: string;
  max_observation_time: string;
  sensors: Record<string, SensorStatus>;
  overall_telemetry_quality: 'Good' | 'Degraded' | 'Poor' | string;
}

export async function fetchTelemetryStatus(patientId: string): Promise<TelemetryStatusResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/telemetry-status`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface VitalTrendPoint {
  time_hours: number;
  time: string;
  value: number;
  sysBp?: number;
  diaBp?: number;
  map?: number;
}

export interface VitalTrendSummary {
  current: number | null;
  previous: number | null;
  delta: number;
  pct_change: number;
  direction: 'RISING' | 'FALLING' | 'STABLE' | 'INSUFFICIENT DATA';
  total_points: number;
}

export interface VitalsTrendsResponse {
  patient_id: string;
  range_hours: number;
  series: Record<string, VitalTrendPoint[]>;
  trend_summary: Record<string, VitalTrendSummary>;
}

export async function fetchVitalsTrends(patientId: string, hours: number = 24): Promise<VitalsTrendsResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/vitals/trends?hours=${hours}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export interface PredictionSnapshot {
  prediction_id: string;
  patient_id: string;
  model_version: string;
  target: string;
  probability: number;
  percentage: number;
  risk_level: string;
  data_cutoff: string;
  generated_at: string;
  feature_count: number;
  data_quality: string;
  top_contributors: any[];
}

export interface ClinicalAlert {
  alert_id: string;
  patient_id: string;
  room_id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  probability: number;
  previous_probability: number | null;
  current_probability: number;
  probability_change_pct: number;
  risk_level: string;
  model_version: string;
  data_cutoff: string;
  data_quality: string;
  top_contributors: any[];
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export async function fetchPredictionHistory(patientId: string, limit: number = 20): Promise<PredictionSnapshot[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/prediction-history?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.history || [];
  } catch (err) {
    return [];
  }
}

export async function fetchPatientAlerts(patientId: string): Promise<ClinicalAlert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/patient/${patientId}/alerts`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.alerts || [];
  } catch (err) {
    return [];
  }
}

export async function fetchActiveAlertsOverview(): Promise<ClinicalAlert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/active-overview`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.active_alerts || [];
  } catch (err) {
    return [];
  }
}

export async function acknowledgeAlertBackend(alertId: string, userId: string, role: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

