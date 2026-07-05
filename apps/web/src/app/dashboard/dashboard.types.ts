export interface DashboardOverview {
  dashboardVersion: string;
  generatedAt: string;
  readiness?: string;
  cards?: DashboardCard[];
  keyMetrics?: Record<string, unknown>;
  risks?: DashboardRisks;
  models?: DashboardModels;
  collection?: DashboardCollection;
  backtesting?: DashboardBacktesting;
  [key: string]: unknown;
}

export interface DashboardCard {
  label: string;
  value: string | number | null;
  status?: 'good' | 'warn' | 'bad' | 'neutral' | string;
  subtitle?: string;
}

export interface DashboardBacktesting {
  dashboardVersion: string;
  generatedAt: string;
  latestBacktest?: {
    runId: string;
    eligibleRows: number;
    profitLoss: number;
    roiPct: number;
    hitRatePct: number;
    averageClosingLineValue: number | null;
    maxDrawdown: number;
    [key: string]: unknown;
  } | null;
  aggregate?: {
    totalRuns: number;
    totalEligibleRows: number;
    bestRoiPct: number;
    latestRoiPct: number;
    latestProfitLoss: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DashboardCollection {
  dashboardVersion: string;
  generatedAt: string;
  paperPickCount?: number;
  oddsLineObservationCount?: number;
  featureVectorCount?: number;
  latestCollectorRun?: {
    runId: string;
    status: string;
    summary?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  latestSchedulerRun?: {
    runId: string;
    status: string;
    dataQualityReadiness?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface DashboardModels {
  dashboardVersion: string;
  generatedAt: string;
  champion?: {
    modelId: string;
    modelVersion: string;
    modelType: string;
    status: string;
    [key: string]: unknown;
  } | null;
  latestMlModel?: {
    modelId: string;
    modelVersion: string;
    status: string;
    trainingRows: number;
    validationRows: number;
    [key: string]: unknown;
  } | null;
  latestGovernanceEvaluation?: {
    status: string;
    promotable: boolean;
    recommendation: string;
    failedChecks?: string[];
    [key: string]: unknown;
  } | null;
  modelSafety?: {
    championActive: boolean;
    challengerPromotable: boolean;
    latestMlStatus: string;
    latestGovernanceStatus: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DashboardRisks {
  dashboardVersion: string;
  generatedAt: string;
  readiness: string;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  failedChecks?: DashboardCheck[];
  warnChecks?: DashboardCheck[];
  [key: string]: unknown;
}

export interface DashboardCheck {
  name: string;
  status: string;
  actual: number | string | null;
  required: number | string | null;
  message: string;
}
