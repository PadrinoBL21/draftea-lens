import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeConsensusEv } from './index';

test('analyzeConsensusEv detects positive consensus EV with conservative stake', () => {
  const result = analyzeConsensusEv({
    bankroll: 1250,
    bestOddsDecimal: 10,
    impliedProbabilityBest: 0.1,
    consensusProbabilityNoVig: 0.1036,
    marketHoldPct: 0.0481,
    bookmakerCount: 8,
  });

  assert.equal(result.expectedValuePerUnit > 0, true);
  assert.equal(result.edgeVsConsensus > 0, true);
  assert.equal(result.stakeSuggested > 0, true);
  assert.equal(result.fairOddsConsensus !== null, true);
});

test('analyzeConsensusEv returns zero stake for negative EV', () => {
  const result = analyzeConsensusEv({
    bankroll: 1250,
    bestOddsDecimal: 4.22,
    impliedProbabilityBest: 0.237,
    consensusProbabilityNoVig: 0.2366,
    marketHoldPct: 0.0345,
    bookmakerCount: 8,
  });

  assert.equal(result.expectedValuePerUnit < 0, true);
  assert.equal(result.stakeSuggested, 0);
  assert.equal(result.kellyFull, 0);
  assert.equal(result.kellyFractional, 0);
});

test('analyzeConsensusEv rejects invalid consensus probability', () => {
  assert.throws(
    () =>
      analyzeConsensusEv({
        bankroll: 1250,
        bestOddsDecimal: 2,
        impliedProbabilityBest: 0.5,
        consensusProbabilityNoVig: null as unknown as number,
        marketHoldPct: 0.04,
        bookmakerCount: 4,
      }),
    /consensusProbabilityNoVig must be a number between 0 and 1/,
  );
});