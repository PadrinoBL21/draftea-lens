import { PaperPick, PaperSettlementResult } from '../paper/paper.types';

export type SettlementAssistantCandidateStatus = 'due' | 'upcoming' | 'stale';
export type SettlementAssistantRecommendation = 'manual_result_required' | 'wait_for_match' | 'settle_soon';
export type SettlementAssistantRunStatus = 'completed' | 'completed_with_errors';

export interface SettlementAssistantCandidate {
  paperPickId: string;
  scanId: string;
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
  paperStake: number;
  expectedValuePerUnit: number;
  scannerScore: number;
  scannerRecommendation: string;
  generatedAt: string;
  hoursUntilCommence: number;
  hoursSinceCommence: number;
  status: SettlementAssistantCandidateStatus;
  recommendation: SettlementAssistantRecommendation;
  allowedResults: PaperSettlementResult[];
  suggestedNotes: string;
  originalPick: PaperPick;
}

export interface SettlementAssistantPreview {
  generatedAt: string;
  assistantVersion: string;
  settleAfterHours: number;
  staleAfterHours: number;
  totalOpenPicks: number;
  dueCount: number;
  upcomingCount: number;
  staleCount: number;
  candidates: SettlementAssistantCandidate[];
}

export interface SettlementAssistantApplyItemInput {
  paperPickId: string;
  result: PaperSettlementResult;
  closingOdds?: number;
  closingLineValue?: number;
  notes?: string;
}

export interface SettlementAssistantApplyResultItem {
  paperPickId: string;
  status: 'settled' | 'failed';
  result?: PaperSettlementResult;
  error?: string;
  settledPick?: PaperPick;
}

export interface SettlementAssistantApplyResult {
  runId: string;
  appliedAt: string;
  assistantVersion: string;
  status: SettlementAssistantRunStatus;
  requested: number;
  settled: number;
  failed: number;
  results: SettlementAssistantApplyResultItem[];
  postSettlement?: {
    featureRebuildId?: string;
    featureVectorsBuilt?: number;
    dataQualityAuditId?: string;
    dataQualityReadiness?: string;
    blockerCount?: number;
    warningCount?: number;
  };
  saved: {
    runsPath: string;
    latestRunPath: string;
  };
}

export interface SettlementAssistantSummary {
  assistantVersion: string;
  openPicks: number;
  duePicks: number;
  stalePicks: number;
  upcomingPicks: number;
  latestRunId: string | null;
  latestRunAt: string | null;
  latestRunStatus: SettlementAssistantRunStatus | null;
  totalRuns: number;
  totalSettledByAssistant: number;
  totalFailedSettlements: number;
}
