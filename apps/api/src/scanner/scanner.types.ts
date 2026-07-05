export type ScannerRecommendation =
  | 'value_candidate'
  | 'price_shopping_candidate'
  | 'clean_market_candidate'
  | 'watch'
  | 'no_bet'
  | 'skip';

export interface OddsApiUsage {
  requestsRemaining: number | null;
  requestsUsed: number | null;
  requestsLast: number | null;
}

export interface AutoScanCandidate {
  eventId: string;
  eventName: string;
  commenceTime: string;
  sportKey: string;
  marketKey: string;
  marketType: string;
  selection: string;
  point?: number;
  bestOddsDecimal: number;
  bestBookmaker: string;
  worstOddsDecimal: number;
  averageOddsDecimal: number;
  impliedProbabilityBest: number;
  consensusImpliedProbability: number;
  consensusProbability: number;
  fairOddsConsensus: number | null;
  edgeVsConsensus: number;
  expectedValuePerUnit: number;
  kellyFull: number;
  kellyFractional: number;
  bookmakerCount: number;
  priceSpreadPct: number;
  bestBookmakerHoldPct: number | null;
  score: number;
  recommendation: ScannerRecommendation;
  stakeSuggested: number;
  reasons: string[];
}

export interface AutoScanResult {
  scanner: 'auto_scanner_v0_1' | 'smart_catalog_scanner_v0_1';
  mode: 'market_intelligence_no_model_ev' | 'market_intelligence_consensus_ev';
  scannedAt: string;
  query: {
    bankroll: number;
    sport?: string;
    sports?: string[];
    regions: string;
    markets: string;
    bookmakers?: string;
    oddsFormat: string;
    maxResults: number;
    minBookmakers: number;
    sportLimit?: number;
    hoursAhead?: number;
  };
  usage: OddsApiUsage;
  totals: {
    rawEvents: number;
    candidates: number;
    returned: number;
    scannedSports?: number;
    activeSports?: number;
    valueCandidates?: number;
    watchCandidates?: number;
  };
  catalog?: {
    source: 'the-odds-api';
    discoveredAt: string;
    activeSports: number;
    scannedSports: Array<{
      key: string;
      title: string;
      group: string;
      marketsRequested: string;
      eventsReturned: number;
      status: 'ok' | 'degraded' | 'skipped' | 'failed';
      note?: string;
    }>;
  };
  warnings: string[];
  candidates: AutoScanCandidate[];
  summary: {
    recommendation: string;
    message: string;
  };
}
