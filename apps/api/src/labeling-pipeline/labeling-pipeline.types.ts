import { FeatureVectorTrend } from '../feature-store/feature-store.types';

export type LabelingOutcomeClass = 'positive' | 'negative' | 'neutral' | 'excluded';
export type LabelingSource = 'paper_pick' | 'odds_line';
export type LabelSettlementResult = 'win' | 'loss' | 'push' | 'void' | 'half_win' | 'half_loss';

export interface LabelingFilters {
  source: 'paper_pick' | 'all';
  includePushVoid: boolean;
  eligibleOnly: boolean;
  minExpectedValue: number;
  maxRows: number;
}

export interface LabelFeatures {
  logBestOdds: number;
  consensusProbability: number;
  edgeVsConsensus: number;
  expectedValuePerUnit: number;
  scannerScore: number;
  priceSpreadPct: number;
  marketHoldPct: number;
  lineObservationCount: number;
  oddsChangePct: number;
  impliedProbabilityChange: number;
  consensusProbabilityChange: number;
  expectedValueChange: number;
  sourcePaperPick: number;
  trendShortening: number;
  trendDrifting: number;
  recommendationValueCandidate: number;
}

export interface LabeledTrainingRow {
  labelId: string;
  createdAt: string;
  labelingVersion: string;
  featureVectorId: string;
  featureStoreVersion: string;
  source: LabelingSource;
  sourceId: string;
  eventId: string;
  eventName: string;
  commenceTime: string;
  sportKey: string;
  marketKey: string;
  marketType: string;
  selection: string;
  point?: number;
  settlementResult: LabelSettlementResult | null;
  outcomeClass: LabelingOutcomeClass;
  trainingEligible: boolean;
  exclusionReason: string | null;
  labelWin: number | null;
  labelWeight: number;
  labelProfitLoss: number | null;
  labelClosingLineValue: number | null;
  bestOddsDecimal: number;
  breakEvenProbability: number;
  expectedValuePerUnit: number;
  scannerScore: number;
  trend: FeatureVectorTrend;
  features: LabelFeatures;
}

export interface LabelingSummary {
  labelingVersion: string;
  latestRebuildId: string | null;
  latestCreatedAt: string | null;
  totalLabels: number;
  trainingEligibleLabels: number;
  positiveLabels: number;
  negativeLabels: number;
  neutralLabels: number;
  excludedLabels: number;
  halfWeightLabels: number;
  totalFeatureRowsScanned: number;
  outcomeKnownRows: number;
  uniqueSports: number;
  uniqueMarketTypes: number;
  bySettlementResult: Record<string, number>;
}

export interface LabelingRebuildResult {
  rebuildId: string;
  createdAt: string;
  labelingVersion: string;
  filters: LabelingFilters;
  sourceFeatureRows: number;
  outcomeKnownRows: number;
  labelsBuilt: number;
  trainingEligibleLabels: number;
  positiveLabels: number;
  negativeLabels: number;
  skippedRows: number;
  saved?: {
    labelsPath: string;
    latestRebuildPath: string;
  };
  sample: LabeledTrainingRow[];
  summary: LabelingSummary;
}
