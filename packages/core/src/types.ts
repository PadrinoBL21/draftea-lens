export type MoneylineOutcomeInput = {
  label: string;
  oddsDecimal: number;
  modelProbability: number; // 0 to 1
};

export type StakePolicy = {
  fractionalKelly: number; // 0.25 = quarter Kelly
  maxStakePct: number; // hard cap per pick
  minPositiveEdge: number; // minimum model edge required
  minEv: number; // minimum expected value required
};

export type MoneylineAnalyzeInput = {
  eventName: string;
  bankroll: number;
  outcomes: MoneylineOutcomeInput[];
  stakePolicy?: Partial<StakePolicy>;
};

export type OutcomeAnalysis = {
  label: string;
  oddsDecimal: number;
  modelProbability: number;
  impliedProbabilityRaw: number;
  impliedProbabilityNoVig: number;
  fairOdds: number | null;
  edgeRaw: number;
  edgeNoVig: number;
  expectedValuePerUnit: number;
  kellyFull: number;
  kellyFractional: number;
  stakeSuggested: number;
  decision: 'single_viable' | 'watch' | 'no_bet';
  reasons: string[];
};

export type MoneylineAnalyzeResult = {
  eventName: string;
  bankroll: number;
  overround: number;
  marketHoldPct: number;
  bestOutcome: OutcomeAnalysis | null;
  outcomes: OutcomeAnalysis[];
  summary: {
    recommendation: 'single_viable' | 'watch' | 'no_bet';
    message: string;
  };
};
