export type DashboardStatus = 'ok' | 'collecting_data' | 'warning' | 'blocked' | 'unknown';

export interface DashboardCard {
  label: string;
  value: string | number | null;
  status: DashboardStatus;
  detail: string;
}

export interface DashboardCounts {
  paperPicks: number;
  settledPicks: number;
  labelableRows: number;
  featureVectors: number;
  oddsLineObservations: number;
  lineMovementObservations: number;
  backtestEligibleRows: number;
  mlTrainingRows: number;
}

export interface BacktestDashboardOverview {
  dashboardVersion: string;
  generatedAt: string;
  readiness: string;
  cards: DashboardCard[];
  counts: DashboardCounts;
  champion: Record<string, unknown> | null;
  latestMlModel: Record<string, unknown> | null;
  latestBacktest: Record<string, unknown> | null;
  latestCollectorRun: Record<string, unknown> | null;
  latestSchedulerRun: Record<string, unknown> | null;
  dataQuality: Record<string, unknown> | null;
  recommendations: string[];
}

export interface DashboardBacktestingView {
  dashboardVersion: string;
  generatedAt: string;
  latestBacktest: Record<string, unknown> | null;
  recentBacktests: Record<string, unknown>[];
  bestRoiBacktest: Record<string, unknown> | null;
  aggregate: {
    totalRuns: number;
    totalEligibleRows: number;
    bestRoiPct: number | null;
    latestRoiPct: number | null;
    latestProfitLoss: number | null;
  };
}

export interface DashboardCollectionView {
  dashboardVersion: string;
  generatedAt: string;
  latestCollectorRun: Record<string, unknown> | null;
  latestSchedulerRun: Record<string, unknown> | null;
  paperPickCount: number;
  oddsLineObservationCount: number;
  featureVectorCount: number;
  recentCollectorRuns: Record<string, unknown>[];
  recentSchedulerRuns: Record<string, unknown>[];
}

export interface DashboardModelView {
  dashboardVersion: string;
  generatedAt: string;
  champion: Record<string, unknown> | null;
  latestMlModel: Record<string, unknown> | null;
  latestGovernanceEvaluation: Record<string, unknown> | null;
  recentMlPredictions: Record<string, unknown>[];
  modelSafety: {
    championActive: boolean;
    challengerPromotable: boolean;
    latestMlStatus: string | null;
    latestGovernanceStatus: string | null;
  };
}

export interface DashboardRiskView {
  dashboardVersion: string;
  generatedAt: string;
  readiness: string;
  blockers: string[];
  warnings: string[];
  failedChecks: Record<string, unknown>[];
  warnChecks: Record<string, unknown>[];
  recommendations: string[];
}
