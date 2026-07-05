import { BacktestReport } from '../backtesting/backtesting.types';
import { MlBaselineMetrics, MlBaselineModel, MlBaselineModelStatus } from '../ml-baseline/ml-baseline.types';

export type GovernanceModelType = 'rules_engine' | 'ml_baseline';
export type GovernanceChampionStatus = 'active' | 'superseded';
export type GovernanceEvaluationStatus =
  | 'promotable'
  | 'blocked_no_challenger'
  | 'blocked_insufficient_data'
  | 'blocked_no_backtest'
  | 'blocked_metrics';

export interface GovernanceThresholds {
  requireLatestBacktest: boolean;
  minTrainingRows: number;
  minValidationRows: number;
  minBacktestRows: number;
  minRoiPct: number;
  minAccuracyPct: number | null;
  maxDrawdown: number | null;
  maxBrierScore: number | null;
}

export interface GovernanceChampion {
  modelId: string;
  modelVersion: string;
  modelType: GovernanceModelType;
  status: GovernanceChampionStatus;
  promotedAt: string | null;
  promotionSourceEvaluationId: string | null;
  notes: string[];
}

export interface GovernanceChallengerSnapshot {
  modelId: string;
  modelVersion: string;
  modelType: GovernanceModelType;
  trainedAt: string;
  status: MlBaselineModelStatus;
  trainingRows: number;
  validationRows: number;
  positiveLabels: number;
  negativeLabels: number;
  metrics: MlBaselineMetrics;
}

export interface GovernanceBacktestSnapshot {
  runId: string;
  generatedAt: string;
  eligibleRows: number;
  profitLoss: number;
  roiPct: number;
  hitRatePct: number;
  averageClosingLineValue: number | null;
  maxDrawdown: number;
}

export interface GovernanceEvaluation {
  evaluationId: string;
  evaluatedAt: string;
  governanceVersion: string;
  champion: GovernanceChampion;
  challenger: GovernanceChallengerSnapshot | null;
  latestBacktest: GovernanceBacktestSnapshot | null;
  thresholds: GovernanceThresholds;
  status: GovernanceEvaluationStatus;
  promotable: boolean;
  failedChecks: string[];
  recommendation: 'keep_champion' | 'promote_challenger';
  notes: string[];
}

export interface GovernancePromotionResult {
  promoted: boolean;
  champion: GovernanceChampion;
  evaluation: GovernanceEvaluation;
}

export interface GovernanceSummary {
  governanceVersion: string;
  champion: GovernanceChampion;
  totalEvaluations: number;
  promotableEvaluations: number;
  blockedEvaluations: number;
  latestEvaluationId: string | null;
  latestEvaluationStatus: GovernanceEvaluationStatus | null;
}

export type MlModelFile = MlBaselineModel;
export type BacktestFile = BacktestReport;
