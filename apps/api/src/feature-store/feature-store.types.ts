export type FeatureVectorSource = 'paper_pick' | 'odds_line';
export type FeatureVectorTrend = 'shortening' | 'drifting' | 'flat' | 'unknown';

export interface FeatureVector {
  featureVectorId: string;
  createdAt: string;
  featureStoreVersion: string;
  source: FeatureVectorSource;
  sourceId: string;
  eventId: string;
  eventName: string;
  commenceTime: string;
  sportKey: string;
  marketKey: string;
  marketType: string;
  selection: string;
  point?: number;
  bestOddsDecimal: number;
  averageOddsDecimal: number;
  consensusProbability: number;
  fairOddsConsensus: number | null;
  edgeVsConsensus: number;
  expectedValuePerUnit: number;
  bookmakerCount: number;
  priceSpreadPct: number;
  marketHoldPct: number | null;
  scannerScore: number;
  scannerRecommendation: string;
  lineId: string;
  lineObservationCount: number;
  oddsChangePct: number;
  impliedProbabilityChange: number;
  consensusProbabilityChange: number;
  expectedValueChange: number;
  trend: FeatureVectorTrend;
  paperPickId?: string;
  paperStake?: number;
  realStakeSuggested?: number;
  paperStatus?: string;
  settlementResult?: string;
  paperProfitLoss?: number;
  closingLineValue?: number;
  outcomeKnown: boolean;
  labelWin?: number | null;
  labelProfitLoss?: number | null;
  labelClosingLineValue?: number | null;
}

export interface FeatureStoreRebuildResult {
  rebuildId: string;
  createdAt: string;
  featureStoreVersion: string;
  vectorsBuilt: number;
  paperPickVectors: number;
  oddsLineVectors: number;
  saved: {
    featuresPath: string;
    manifestPath: string;
  };
  sample: FeatureVector[];
  summary: FeatureStoreSummary;
}

export interface FeatureStoreSummary {
  featureStoreVersion: string;
  totalFeatureVectors: number;
  paperPickVectors: number;
  oddsLineVectors: number;
  outcomeKnownVectors: number;
  positiveEvVectors: number;
  valueCandidateVectors: number;
  latestCreatedAt: string | null;
  trackedSports: number;
  trackedEvents: number;
  trendCounts: Record<FeatureVectorTrend, number>;
}
