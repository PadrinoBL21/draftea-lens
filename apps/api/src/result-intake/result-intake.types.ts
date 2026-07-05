import { PaperPick, PaperSettlementResult } from '../paper/paper.types';

export type OfficialResultStatus = 'final' | 'cancelled' | 'postponed' | 'abandoned' | 'unknown';
export type ResultMatchStatus = 'matched_high_confidence' | 'matched_by_name' | 'manual_review' | 'no_result';
export type ResultMatchConfidence = 'high' | 'medium' | 'low' | 'none';

export interface OfficialResultRecord {
  resultId: string;
  importedAt: string;
  resultIntakeVersion: string;
  sourceName: string;
  sourceReference?: string;
  eventId?: string;
  eventName: string;
  sportKey?: string;
  commenceTime?: string;
  completedAt?: string;
  status: OfficialResultStatus;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  notes?: string;
  raw?: Record<string, unknown>;
}

export interface ResultIntakeImportResult {
  importId: string;
  importedAt: string;
  resultIntakeVersion: string;
  sourceName: string;
  imported: number;
  skipped: number;
  duplicateResultIds: number;
  results: OfficialResultRecord[];
  saved?: {
    resultsPath: string;
    importsPath: string;
    latestImportPath: string;
  };
}

export interface SuggestedSettlement {
  result: PaperSettlementResult | null;
  confidence: ResultMatchConfidence;
  reason: string;
  closingOdds?: number;
}

export interface ResultMatchCandidate {
  matchId: string;
  paperPickId: string;
  eventId: string;
  eventName: string;
  commenceTime: string;
  sportKey: string;
  marketKey: string;
  marketType: string;
  selection: string;
  point?: number;
  bestOddsDecimal: number;
  status: ResultMatchStatus;
  result: OfficialResultRecord | null;
  suggestedSettlement: SuggestedSettlement;
  paperPick: PaperPick;
}

export interface ResultMatchRun {
  matchRunId: string;
  generatedAt: string;
  resultIntakeVersion: string;
  totalOpenPicks: number;
  matched: number;
  highConfidence: number;
  mediumConfidence: number;
  manualReview: number;
  noResult: number;
  candidates: ResultMatchCandidate[];
  saved?: {
    matchRunsPath: string;
    latestMatchRunPath: string;
  };
}

export interface ResultIntakeApplyItem {
  paperPickId: string;
  status: 'settled' | 'failed' | 'skipped';
  result?: PaperSettlementResult;
  error?: string;
  settledPick?: PaperPick;
}

export interface ResultIntakeApplyResult {
  applyRunId: string;
  appliedAt: string;
  resultIntakeVersion: string;
  status: 'completed' | 'completed_with_errors' | 'no_matches_applied';
  requested: number;
  settled: number;
  failed: number;
  skipped: number;
  results: ResultIntakeApplyItem[];
  postSettlement: {
    featureRebuildId?: string;
    featureVectorsBuilt?: number;
    dataQualityAuditId?: string;
    dataQualityReadiness?: string;
    blockerCount?: number;
    warningCount?: number;
  };
  saved: {
    applyRunsPath: string;
    latestApplyRunPath: string;
  };
}

export interface ResultIntakeSummary {
  resultIntakeVersion: string;
  totalOfficialResults: number;
  totalImports: number;
  totalMatchRuns: number;
  totalApplyRuns: number;
  latestImportId: string | null;
  latestMatchRunId: string | null;
  latestApplyRunId: string | null;
  latestApplyStatus: string | null;
  totalSettledByIntake: number;
  highConfidenceCandidates: number;
  manualReviewCandidates: number;
}
