export const MODEL_REGISTRY_STATUSES = ['candidate', 'champion', 'archived', 'blocked'] as const;
export type ModelRegistryStatus = (typeof MODEL_REGISTRY_STATUSES)[number];

export const MODEL_REGISTRY_TYPES = ['rules_engine', 'ml_baseline', 'ml_baseline_v2', 'manual', 'other'] as const;
export type ModelRegistryType = (typeof MODEL_REGISTRY_TYPES)[number];

export const MODEL_EVALUATION_STATUSES = [
  'promotable',
  'blocked_insufficient_data',
  'blocked_regression',
  'blocked_manual_review',
  'active_champion',
] as const;
export type ModelEvaluationStatus = (typeof MODEL_EVALUATION_STATUSES)[number];

export interface ModelRegistryMetrics {
  trainingRows: number;
  validationRows: number;
  backtestRows: number;
  positiveLabels: number;
  negativeLabels: number;
  roiPct: number | null;
  clvPct: number | null;
  maxDrawdownPct: number | null;
  accuracyPct: number | null;
}

export interface ModelRegistryGates {
  minTrainingRows: number;
  minValidationRows: number;
  minBacktestRows: number;
  minPositiveLabels: number;
  minNegativeLabels: number;
  minRoiPct: number;
  minClvPct: number;
  maxDrawdownPct: number;
}

export interface RegisteredModel {
  modelId: string;
  modelVersion: string;
  family: string;
  modelType: ModelRegistryType;
  status: ModelRegistryStatus;
  source: string;
  registeredAt: string;
  promotedAt?: string;
  archivedAt?: string;
  blockedAt?: string;
  serverId?: string;
  notes?: string;
  tags: string[];
  metrics: ModelRegistryMetrics;
  gates: ModelRegistryGates;
}

export interface ModelEvaluation {
  evaluationId: string;
  modelId: string;
  modelVersion: string;
  evaluatedAt: string;
  evaluatedBy: string;
  status: ModelEvaluationStatus;
  promotable: boolean;
  recommendation: 'promote' | 'keep_champion' | 'collect_more_data' | 'manual_review';
  championModelId: string | null;
  metrics: ModelRegistryMetrics;
  gates: ModelRegistryGates;
  reasons: string[];
  notes?: string;
}

export interface ModelRegistrySummary {
  registryVersion: string;
  generatedAt: string;
  totalModels: number;
  championModelId: string | null;
  candidateModels: number;
  blockedModels: number;
  archivedModels: number;
  totalEvaluations: number;
  latestEvaluationStatus: ModelEvaluationStatus | null;
  latestEvaluationRecommendation: ModelEvaluation['recommendation'] | null;
}
