export type ScannerRecommendation =
  | 'price_shopping_candidate'
  | 'clean_market_candidate'
  | 'watch'
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
  bookmakerCount: number;
  priceSpreadPct: number;
  bestBookmakerHoldPct: number | null;
  score: number;
  recommendation: ScannerRecommendation;
  stakeSuggested: number;
  reasons: string[];
}

export interface AutoScanResult {
  scanner: 'auto_scanner_v0_1';
  mode: 'market_intelligence_no_model_ev';
  scannedAt: string;
  query: {
    bankroll: number;
    sport: string;
    regions: string;
    markets: string;
    bookmakers?: string;
    oddsFormat: string;
    maxResults: number;
    minBookmakers: number;
  };
  usage: OddsApiUsage;
  totals: {
    rawEvents: number;
    candidates: number;
    returned: number;
  };
  warnings: string[];
  candidates: AutoScanCandidate[];
  summary: {
    recommendation: string;
    message: string;
  };
}
