import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const overview = JSON.parse(
  await readFile(new URL('./fixtures/backtest-dashboard-overview.sample.json', import.meta.url), 'utf-8'),
);

assert.equal(overview.dashboardVersion, 'backtest-dashboard-v0.1');
assert.equal(typeof overview.generatedAt, 'string');
assert.equal(overview.readiness, 'collecting_data');
assert.equal(Array.isArray(overview.cards), true);
assert.equal(typeof overview.counts.paperPicks, 'number');
assert.equal(typeof overview.counts.oddsLineObservations, 'number');
assert.equal(overview.champion.status, 'active');
assert.equal(overview.latestMlModel.status, 'insufficient_data');
assert.equal(Array.isArray(overview.recommendations), true);
assert.equal(overview.recommendations.length > 0, true);

console.log(`QA backtest dashboard passed: readiness ${overview.readiness}, ${overview.cards.length} card(s) validated.`);
