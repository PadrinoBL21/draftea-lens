import {
  MoneylineAnalyzeInput,
  MoneylineAnalyzeResult,
  OutcomeAnalysis,
  StakePolicy,
} from './types';

const DEFAULT_STAKE_POLICY: StakePolicy = {
  fractionalKelly: 0.25,
  maxStakePct: 0.02,
  minPositiveEdge: 0.015,
  minEv: 0.01,
};

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function assertProbability(probability: number, fieldName: string): void {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error(`${fieldName} must be a number between 0 and 1.`);
  }
}

function assertPositive(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number.`);
  }
}

export function impliedProbability(decimalOdds: number): number {
  assertPositive(decimalOdds, 'decimalOdds');
  return 1 / decimalOdds;
}

export function fairOdds(modelProbability: number): number | null {
  assertProbability(modelProbability, 'modelProbability');
  if (modelProbability === 0) return null;
  return 1 / modelProbability;
}

export function expectedValuePerUnit(modelProbability: number, decimalOdds: number): number {
  assertProbability(modelProbability, 'modelProbability');
  assertPositive(decimalOdds, 'decimalOdds');
  return modelProbability * (decimalOdds - 1) - (1 - modelProbability);
}

export function kellyFraction(modelProbability: number, decimalOdds: number): number {
  assertProbability(modelProbability, 'modelProbability');
  assertPositive(decimalOdds, 'decimalOdds');
  const numerator = modelProbability * decimalOdds - 1;
  const denominator = decimalOdds - 1;
  return Math.max(0, numerator / denominator);
}

export function analyzeMoneyline(input: MoneylineAnalyzeInput): MoneylineAnalyzeResult {
  if (!input.eventName?.trim()) {
    throw new Error('eventName is required.');
  }
  assertPositive(input.bankroll, 'bankroll');
  if (!Array.isArray(input.outcomes) || input.outcomes.length < 2) {
    throw new Error('At least two outcomes are required.');
  }

  const policy: StakePolicy = {
    ...DEFAULT_STAKE_POLICY,
    ...input.stakePolicy,
  };

  const impliedRawValues = input.outcomes.map((outcome) => {
    assertPositive(outcome.oddsDecimal, `oddsDecimal for ${outcome.label}`);
    assertProbability(outcome.modelProbability, `modelProbability for ${outcome.label}`);
    return impliedProbability(outcome.oddsDecimal);
  });

  const overround = impliedRawValues.reduce((sum, probability) => sum + probability, 0);
  const marketHoldPct = Math.max(0, overround - 1);

  const outcomes: OutcomeAnalysis[] = input.outcomes.map((outcome, index) => {
    const impliedRaw = impliedRawValues[index];
    const impliedNoVig = impliedRaw / overround;
    const fair = fairOdds(outcome.modelProbability);
    const ev = expectedValuePerUnit(outcome.modelProbability, outcome.oddsDecimal);
    const edgeRaw = outcome.modelProbability - impliedRaw;
    const edgeNoVig = outcome.modelProbability - impliedNoVig;
    const kellyFull = kellyFraction(outcome.modelProbability, outcome.oddsDecimal);
    const kellyFractional = kellyFull * policy.fractionalKelly;
    const stakeCap = input.bankroll * policy.maxStakePct;
    const stakeSuggested = Math.min(input.bankroll * kellyFractional, stakeCap);

    const reasons: string[] = [];
    if (ev <= 0) reasons.push('EV is not positive.');
    if (edgeRaw < policy.minPositiveEdge) reasons.push('Edge is below the minimum threshold.');
    if (stakeSuggested <= 0) reasons.push('Kelly stake is zero after risk rules.');

    let decision: OutcomeAnalysis['decision'] = 'no_bet';
    if (ev >= policy.minEv && edgeRaw >= policy.minPositiveEdge && stakeSuggested > 0) {
      decision = 'single_viable';
      reasons.push('Positive EV and edge clear the current threshold.');
    } else if (ev > 0 || edgeRaw > 0) {
      decision = 'watch';
      reasons.push('Some value signal exists, but not enough for a clean bet.');
    }

    return {
      label: outcome.label,
      oddsDecimal: round(outcome.oddsDecimal, 3),
      modelProbability: round(outcome.modelProbability, 4),
      impliedProbabilityRaw: round(impliedRaw, 4),
      impliedProbabilityNoVig: round(impliedNoVig, 4),
      fairOdds: fair === null ? null : round(fair, 3),
      edgeRaw: round(edgeRaw, 4),
      edgeNoVig: round(edgeNoVig, 4),
      expectedValuePerUnit: round(ev, 4),
      kellyFull: round(kellyFull, 4),
      kellyFractional: round(kellyFractional, 4),
      stakeSuggested: round(stakeSuggested, 2),
      decision,
      reasons,
    };
  });

  const bestOutcome = [...outcomes]
    .filter((outcome) => outcome.decision === 'single_viable')
    .sort((a, b) => b.expectedValuePerUnit - a.expectedValuePerUnit)[0] ?? null;

  const hasWatch = outcomes.some((outcome) => outcome.decision === 'watch');
  const summary: MoneylineAnalyzeResult['summary'] = bestOutcome
    ? {
        recommendation: 'single_viable',
        message: `${bestOutcome.label} is the best current moneyline candidate. Suggested stake: ${bestOutcome.stakeSuggested}.`,
      }
    : hasWatch
      ? {
          recommendation: 'watch',
          message: 'There are weak value signals, but nothing clean enough for a serious single yet.',
        }
      : {
          recommendation: 'no_bet',
          message: 'No clean moneyline edge found. Best decision is to wait or skip.',
        };

  return {
    eventName: input.eventName,
    bankroll: round(input.bankroll, 2),
    overround: round(overround, 4),
    marketHoldPct: round(marketHoldPct, 4),
    bestOutcome,
    outcomes,
    summary,
  };
}
