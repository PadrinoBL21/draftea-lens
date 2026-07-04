import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMoneyline, expectedValuePerUnit, impliedProbability } from './index';

test('impliedProbability converts decimal odds', () => {
  assert.equal(Number(impliedProbability(2).toFixed(4)), 0.5);
});

test('expectedValuePerUnit returns positive EV when model beats price', () => {
  const ev = expectedValuePerUnit(0.45, 2.5);
  assert.equal(Number(ev.toFixed(3)), 0.125);
});

test('analyzeMoneyline returns no_bet for weak edges', () => {
  const result = analyzeMoneyline({
    eventName: 'Canada vs Morocco',
    bankroll: 1000,
    outcomes: [
      { label: 'Canada', oddsDecimal: 2.4, modelProbability: 0.412 },
      { label: 'Draw', oddsDecimal: 3.25, modelProbability: 0.268 },
      { label: 'Morocco', oddsDecimal: 2.9, modelProbability: 0.32 },
    ],
  });

  assert.equal(result.summary.recommendation, 'watch');
  assert.equal(result.outcomes.length, 3);
});
