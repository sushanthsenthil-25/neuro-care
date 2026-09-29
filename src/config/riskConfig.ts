/**
 * Central Risk Configuration System for NeuroCare Frontend.
 * Matches backend canonical thresholds, decision threshold (0.120), and display bands.
 */

export const MORTALITY_MODEL_CONFIG = {
  modelName: 'In-Hospital Mortality Risk Model',
  modelVersion: 'XGBoost-ICU-v1',
  primaryTarget: 'inHospitalDeath',
  decisionThreshold: 0.120, // 12.0% calibrated threshold from Youden's J index on held-out test set
  evalAuroc: 0.7952,
  evalAuprc: 0.4328,
  evalSensitivity: 0.7273,
  evalSpecificity: 0.7150,
  displayBands: {
    LOW: { min: 0.0, max: 0.120, label: 'LOW', description: 'Below decision threshold (< 12%)' },
    WATCH: { min: 0.120, max: 0.250, label: 'WATCH', description: 'Just above decision threshold (12% - 25%)' },
    ELEVATED: { min: 0.250, max: 0.450, label: 'ELEVATED', description: 'Elevated mortality risk (25% - 45%)' },
    HIGH: { min: 0.450, max: 1.000, label: 'HIGH', description: 'High mortality risk (> 45%)' },
  },
} as const;

export const EARLY_WARNING_CONFIG = {
  engineName: 'NeuroCare Early Warning Engine v1',
  status: 'Research Prototype',
  disclaimer: 'Decision-support prototype — not a substitute for clinical judgment.',
  displayBands: {
    STABLE: { min: 0, max: 24, label: 'STABLE' },
    WATCH: { min: 25, max: 44, label: 'WATCH' },
    ELEVATED: { min: 45, max: 69, label: 'ELEVATED' },
    CRITICAL: { min: 70, max: 100, label: 'CRITICAL' },
  },
} as const;

export type MortalityRiskCategory = 'LOW' | 'WATCH' | 'ELEVATED' | 'HIGH';

export function getMortalityRiskCategory(score: number): MortalityRiskCategory {
  if (score < MORTALITY_MODEL_CONFIG.displayBands.LOW.max) {
    return 'LOW';
  } else if (score < MORTALITY_MODEL_CONFIG.displayBands.WATCH.max) {
    return 'WATCH';
  } else if (score < MORTALITY_MODEL_CONFIG.displayBands.ELEVATED.max) {
    return 'ELEVATED';
  } else {
    return 'HIGH';
  }
}
