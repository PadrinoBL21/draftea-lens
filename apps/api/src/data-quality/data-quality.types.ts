export type DataQualityReadiness =
  | 'not_ready'
  | 'collecting_data'
  | 'ready_for_baseline_training'
  | 'ready_for_backtesting'
  | 'ready_for_neural_training';

export type DataQualityCheckStatus = 'pass' | 'warn' | 'fail';

export interface DataQualityThresholds {
  minPaperPicks: number;
  minSettledPicks: number;
  minLabelableRows: number;
  minFeatureVectors: number;
  minOddsLineObservations: number;
  minLineMovementObservations: number;
  minBacktestEligibleRows: number;
  minPositiveLabels: number;
  minNegativeLabels: number;
  minTrackedSports: number;
  minTrackedMarketTypes: number;
  maxVoidRatePct: number;
  minNeuralTrainingRows: number;
  minNeuralSettledPicks: number;
}

export interface DataQualityCheck {
  name: string;
  status: DataQualityCheckStatus;
  actual: number | string | boolean | null;
  required: number | string | boolean | null;
  message: string;
}

export interface DataQualityCounts {
  paperPicks: {
    total: number;
    open: number;
    settled: number;
    void: number;
    win: number;
    loss: number;
    push: number;
    halfWin: number;
    halfLoss: number;
    labelable: number;
    positiveLabels: number;
    negativeLabels: number;
    duplicateIds: number;
    missingSettlement: number;
    malformedRows: number;
    voidRatePct: number;
  };
  oddsHistory: {
    totalLineObservations: number;
    uniqueLines: number;
    lineMovementObservations: number;
    trackedSports: number;
    trackedEvents: number;
    trackedMarketTypes: number;
    malformedRows: number;
  };
  featureStore: {
    totalFeatureVectors: number;
    paperPickVectors: number;
    oddsLineVectors: number;
    outcomeKnownVectors: number;
    labelableVectors: number;
    positiveLabels: number;
    negativeLabels: number;
    incompleteVectors: number;
    duplicateIds: number;
    malformedRows: number;
  };
  backtesting: {
    latestRunId: string | null;
    latestEligibleRows: number;
    latestRoiPct: number | null;
    latestMaxDrawdown: number | null;
    latestAverageClosingLineValue: number | null;
    hasLatestRun: boolean;
  };
  mlBaseline: {
    latestModelId: string | null;
    latestStatus: string | null;
    latestTrainingRows: number;
    latestValidationRows: number;
    positiveLabels: number;
    negativeLabels: number;
    hasLatestModel: boolean;
  };
}

export interface DataQualityReport {
  auditId: string;
  auditedAt: string;
  dataQualityVersion: string;
  readiness: DataQualityReadiness;
  thresholds: DataQualityThresholds;
  counts: DataQualityCounts;
  checks: DataQualityCheck[];
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  saved?: {
    auditsPath: string;
    latestAuditPath: string;
  };
}

export interface DataQualitySummary {
  dataQualityVersion: string;
  latestAuditId: string | null;
  latestAuditedAt: string | null;
  readiness: DataQualityReadiness;
  blockerCount: number;
  warningCount: number;
  keyCounts: {
    paperPicks: number;
    settledPicks: number;
    labelableRows: number;
    featureVectors: number;
    oddsLineObservations: number;
    lineMovementObservations: number;
    latestBacktestEligibleRows: number;
    latestMlTrainingRows: number;
  };
}
