export type CollectorStepName = 'paper_scan' | 'odds_snapshot' | 'feature_store_rebuild' | 'data_quality_audit';
export type CollectorStepStatus = 'success' | 'skipped' | 'failed';
export type CollectorRunStatus = 'completed' | 'completed_with_warnings' | 'failed';

export interface CollectorRunConfig {
  bankroll: number;
  runLabel?: string;
  enablePaperPicks: boolean;
  maxPaperPicks: number;
  enableOddsSnapshot: boolean;
  maxLines: number;
  rebuildFeatureStore: boolean;
  maxFeatureVectors: number;
  auditDataQuality: boolean;
  persistDataQualityAudit: boolean;
}

export interface CollectorStepResult {
  name: CollectorStepName;
  status: CollectorStepStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  message: string;
  metrics: Record<string, number | string | boolean | null>;
  error?: string;
}

export interface CollectorRunSummary {
  paperPicksSaved: number;
  oddsLinesSaved: number;
  featureVectorsBuilt: number;
  dataQualityReadiness: string | null;
  blockerCount: number;
  warningCount: number;
  recommendation: 'collecting_data' | 'ready_for_training_checks' | 'collector_failed';
}

export interface CollectorRunResult {
  runId: string;
  startedAt: string;
  finishedAt: string;
  collectorVersion: string;
  status: CollectorRunStatus;
  config: CollectorRunConfig;
  steps: CollectorStepResult[];
  summary: CollectorRunSummary;
  saved: {
    runsPath: string;
    latestRunPath: string;
  };
}

export interface CollectorSummary {
  collectorVersion: string;
  totalRuns: number;
  latestRunId: string | null;
  latestRunAt: string | null;
  latestStatus: CollectorRunStatus | null;
  latestReadiness: string | null;
  totalPaperPicksSaved: number;
  totalOddsLinesSaved: number;
  totalFeatureVectorsBuilt: number;
  failedRuns: number;
}
