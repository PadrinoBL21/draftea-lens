import { AutoScanCandidate, AutoScanResult } from '../scanner/scanner.types';

export type PaperPickType =
  | 'value_paper_pick'
  | 'learning_probe'
  | 'shadow_reference_pick';

export type PaperPickStatus = 'open' | 'settled' | 'void';

export type PaperSettlementResult = 'win' | 'loss' | 'push' | 'void' | 'half_win' | 'half_loss';

export interface PaperPickSettlement {
  settledAt: string;
  result: PaperSettlementResult;
  closingOdds?: number;
  closingLineValue?: number;
  paperProfitLoss: number;
  notes?: string;
}

export interface PaperPick {
  paperPickId: string;
  scanId: string;
  generatedAt: string;
  modelVersion: string;
  source: 'smart_scan_consensus_ev';
  type: PaperPickType;
  status: PaperPickStatus;
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
  averageOddsDecimal: number;
  consensusProbability: number;
  fairOddsConsensus: number | null;
  edgeVsConsensus: number;
  expectedValuePerUnit: number;
  kellyFractional: number;
  scannerScore: number;
  scannerRecommendation: string;
  paperStake: number;
  realStakeSuggested: number;
  learningEligible: boolean;
  reasons: string[];
  featuresSnapshot: AutoScanCandidate;
  settlement?: PaperPickSettlement;
}

export interface PaperScanRecord {
  scanId: string;
  generatedAt: string;
  modelVersion: string;
  bankroll: number;
  sourceScan: Pick<AutoScanResult, 'scanner' | 'mode' | 'scannedAt' | 'query' | 'usage' | 'totals' | 'summary'>;
  paperPicks: PaperPick[];
  watchlist: AutoScanCandidate[];
}

export interface PaperScanAndSaveResult {
  scanId: string;
  generatedAt: string;
  modelVersion: string;
  bankroll: number;
  paperPicks: PaperPick[];
  watchlist: AutoScanCandidate[];
  saved: {
    scanPath: string;
    picksPath: string;
  };
  summary: {
    recommendation: 'paper_picks_saved' | 'paper_watch_only';
    message: string;
  };
}

export interface SettlementSummary {
  totalPicks: number;
  openPicks: number;
  settledPicks: number;
  voidPicks: number;
  wins: number;
  losses: number;
  pushes: number;
  halfWins: number;
  halfLosses: number;
  totalPaperStake: number;
  totalPaperProfitLoss: number;
  roiPct: number;
  averageClosingLineValue: number | null;
}
