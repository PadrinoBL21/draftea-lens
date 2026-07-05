import { BacktestSource, BacktestStakingMode, BacktestTrend } from './dto/run-backtest.dto';

export type BacktestResult = 'win' | 'loss' | 'push' | 'void' | 'half_win' | 'half_loss';

export interface BacktestFilters {
  source: BacktestSource;
  sportKey?: string;
  marketType?: string;
  trend: BacktestTrend;
  outcomeKnownOnly: boolean;
  minExpectedValue: number;
  minScannerScore: number;
  stakingMode: BacktestStakingMode;
  flatStake: number;
  maxRows: number;
}

export interface BacktestTrade {
  featureVectorId: string;
  source: string;
  sourceId: string;
  eventId: string;
  eventName: string;
  commenceTime: string;
  sportKey: string;
  marketKey: string;
  marketType: string;
  selection: string;
  point?: number;
  oddsDecimal: number;
  expectedValuePerUnit: number;
  scannerScore: number;
  trend: string;
  settlementResult: BacktestResult;
  simulatedStake: number;
  simulatedProfitLoss: number;
  bankrollAfter: number;
  closingLineValue: number | null;
}

export interface BacktestBucketSummary {
  count: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  halfWins: number;
  halfLosses: number;
  totalStake: number;
  profitLoss: number;
  roiPct: number;
  hitRatePct: number;
  averageExpectedValue: number;
  averageClosingLineValue: number | null;
}

export interface BacktestReport {
  runId: string;
  generatedAt: string;
  backtestVersion: string;
  filters: BacktestFilters;
  rowsConsidered: number;
  eligibleRows: number;
  skippedRows: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  halfWins: number;
  halfLosses: number;
  totalStake: number;
  profitLoss: number;
  roiPct: number;
  hitRatePct: number;
  averageOddsDecimal: number | null;
  averageExpectedValue: number | null;
  averageClosingLineValue: number | null;
  maxDrawdown: number;
  byMarketType: Record<string, BacktestBucketSummary>;
  bySport: Record<string, BacktestBucketSummary>;
  sampleTrades: BacktestTrade[];
  saved: {
    reportsPath: string;
    latestRunPath: string;
  };
}

export interface BacktestingSummary {
  backtestVersion: string;
  totalRuns: number;
  latestRunId: string | null;
  latestGeneratedAt: string | null;
  bestRoiRunId: string | null;
  bestRoiPct: number | null;
  totalEligibleRowsAcrossRuns: number;
}
