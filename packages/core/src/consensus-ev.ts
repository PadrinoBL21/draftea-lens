export type ConsensusEvDecision = 'value_candidate' | 'watch' | 'no_bet';

export type ConsensusEvPolicy = {
  fractionalKelly: number;
  maxStakePct: number;
  minEv: number;
  minEdge: number;
  minBookmakersForValue: number;
  maxHoldPctForValue: number;
};

export type ConsensusEvInput = {
  bankroll: number;
  bestOddsDecimal: number;
  consensusProbabilityNoVig: number;
  impliedProbabilityBest: number;
  bookmakerCount: number;
  marketHoldPct: number | null;
  marketType?: string;
  policy?: Partial<ConsensusEvPolicy>;
};

export type ConsensusEvAnalysis = {
  consensusProbability: number;
  fairOddsConsensus: number | null;
  edgeVsConsensus: number;
  expectedValuePerUnit: number;
  kellyFull: number;
  kellyFractional: number;
  stakeSuggested: number;
  decision: ConsensusEvDecision;
  reasons: string[];
};

const DEFAULT_POLICY: ConsensusEvPolicy = {
  fractionalKelly: 0.25,
  maxStakePct: 0.015,
  minEv: 0.025,
  minEdge: 0.01,
  minBookmakersForValue: 3,
  maxHoldPctForValue: 0.08,
};

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function assertPositive(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number.`);
  }
}

function assertProbability(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${fieldName} must be a number between 0 and 1.`);
  }
}

export function consensusExpectedValuePerUnit(probability: number, decimalOdds: number): number {
  assertProbability(probability, 'probability');
  assertPositive(decimalOdds, 'decimalOdds');
  return probability * decimalOdds - 1;
}

export function consensusKellyFraction(probability: number, decimalOdds: number): number {
  assertProbability(probability, 'probability');
  assertPositive(decimalOdds, 'decimalOdds');

  const numerator = probability * decimalOdds - 1;
  const denominator = decimalOdds - 1;

  if (denominator <= 0) return 0;
  return Math.max(0, numerator / denominator);
}

export function analyzeConsensusEv(input: ConsensusEvInput): ConsensusEvAnalysis {
  assertPositive(input.bankroll, 'bankroll');
  assertPositive(input.bestOddsDecimal, 'bestOddsDecimal');
  assertProbability(input.consensusProbabilityNoVig, 'consensusProbabilityNoVig');
  assertProbability(input.impliedProbabilityBest, 'impliedProbabilityBest');

  const policy: ConsensusEvPolicy = {
    ...DEFAULT_POLICY,
    ...input.policy,
  };

  const probability = input.consensusProbabilityNoVig;
  const fairOddsConsensus = probability > 0 ? 1 / probability : null;
  const edgeVsConsensus = probability - input.impliedProbabilityBest;
  const expectedValuePerUnit = consensusExpectedValuePerUnit(probability, input.bestOddsDecimal);
  const kellyFull = consensusKellyFraction(probability, input.bestOddsDecimal);
  const kellyFractional = kellyFull * policy.fractionalKelly;
  const stakeCap = input.bankroll * policy.maxStakePct;
  const uncappedStake = input.bankroll * kellyFractional;
  const stakeSuggested = Math.max(0, Math.min(uncappedStake, stakeCap));

  const hasEnoughBooks = input.bookmakerCount >= policy.minBookmakersForValue;
  const hasAcceptableHold = input.marketHoldPct === null || input.marketHoldPct <= policy.maxHoldPctForValue;
  const isPositiveEv = expectedValuePerUnit >= policy.minEv;
  const hasEnoughEdge = edgeVsConsensus >= policy.minEdge;

  const reasons: string[] = [];
  reasons.push(`Consensus no-vig probability: ${(probability * 100).toFixed(2)}%.`);

  if (fairOddsConsensus !== null) {
    reasons.push(`Consensus fair odds: ${fairOddsConsensus.toFixed(2)}.`);
  }

  reasons.push(`EV vs best available price: ${(expectedValuePerUnit * 100).toFixed(2)}%.`);
  reasons.push(`Edge vs best implied probability: ${(edgeVsConsensus * 100).toFixed(2)} pp.`);

  let decision: ConsensusEvDecision = 'no_bet';

  if (isPositiveEv && hasEnoughEdge && hasEnoughBooks && hasAcceptableHold && stakeSuggested > 0) {
    decision = 'value_candidate';
    reasons.push('Consensus EV clears the current conservative threshold.');
    reasons.push(`Conservative stake suggested: ${round(stakeSuggested, 2)}.`);
  } else if (expectedValuePerUnit > 0 || edgeVsConsensus > 0) {
    decision = 'watch';
    reasons.push('Positive consensus signal exists, but it is not clean enough for a value stake yet.');
  } else {
    reasons.push('Consensus EV is not positive enough to justify a stake.');
  }

  if (!hasEnoughBooks) {
    reasons.push(`Only ${input.bookmakerCount} bookmaker(s) available; value confidence is limited.`);
  }

  if (!hasAcceptableHold && input.marketHoldPct !== null) {
    reasons.push(`Market hold is high: ${(input.marketHoldPct * 100).toFixed(2)}%.`);
  }

  return {
    consensusProbability: round(probability, 4),
    fairOddsConsensus: fairOddsConsensus === null ? null : round(fairOddsConsensus, 3),
    edgeVsConsensus: round(edgeVsConsensus, 4),
    expectedValuePerUnit: round(expectedValuePerUnit, 4),
    kellyFull: round(kellyFull, 4),
    kellyFractional: round(kellyFractional, 4),
    stakeSuggested: round(stakeSuggested, 2),
    decision,
    reasons,
  };
}
