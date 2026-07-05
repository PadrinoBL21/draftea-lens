import { AutoScanCandidate, AutoScanResult } from '../scanner/scanner.types';

export interface OddsLineSnapshot {
  lineId: string;
  snapshotId: string;
  capturedAt: string;
  modelVersion: string;
  source: 'smart_scan_consensus_ev';
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
  bookmakerCount: number;
  priceSpreadPct: number;
  marketHoldPct: number | null;
  scannerScore: number;
  scannerRecommendation: string;
  featuresSnapshot: AutoScanCandidate;
}

export interface OddsSnapshotRecord {
  snapshotId: string;
  capturedAt: string;
  modelVersion: string;
  bankroll: number;
  sourceScan: Pick<AutoScanResult, 'scanner' | 'mode' | 'scannedAt' | 'query' | 'usage' | 'totals' | 'summary'>;
  lines: OddsLineSnapshot[];
}

export interface CreateOddsSnapshotResult {
  snapshotId: string;
  capturedAt: string;
  modelVersion: string;
  bankroll: number;
  linesSaved: number;
  lines: OddsLineSnapshot[];
  saved: {
    snapshotPath: string;
    historyPath: string;
  };
  summary: {
    recommendation: 'odds_history_saved' | 'odds_history_empty';
    message: string;
  };
}

export type OddsTrend = 'shortening' | 'drifting' | 'flat';

export interface OddsLineMovement {
  lineId: string;
  eventId: string;
  eventName: string;
  commenceTime: string;
  sportKey: string;
  marketKey: string;
  marketType: string;
  selection: string;
  point?: number;
  observations: number;
  firstCapturedAt: string;
  latestCapturedAt: string;
  firstOddsDecimal: number;
  latestOddsDecimal: number;
  oddsChange: number;
  oddsChangePct: number;
  impliedProbabilityChange: number;
  consensusProbabilityChange: number;
  expectedValueChange: number;
  firstBookmaker: string;
  latestBookmaker: string;
  bestBookmakerChanged: boolean;
  trend: OddsTrend;
}

export interface OddsHistorySummary {
  totalSnapshots: number;
  totalLineObservations: number;
  uniqueLines: number;
  latestCapturedAt: string | null;
  trackedSports: number;
  trackedEvents: number;
  lineMovements: number;
}
