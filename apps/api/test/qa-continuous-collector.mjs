import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixturePath = new URL('./fixtures/continuous-collector-run.sample.json', import.meta.url);
const run = JSON.parse(await readFile(fixturePath, 'utf-8'));

assert.equal(run.collectorVersion, 'continuous-collector-v0.1');
assert.ok(run.runId.startsWith('collector_run_'));
assert.equal(run.status, 'completed_with_warnings');
assert.equal(run.config.bankroll, 1250);
assert.equal(Array.isArray(run.steps), true);
assert.equal(run.steps.length, 4);

const names = new Set(run.steps.map((step) => step.name));
for (const expected of ['paper_scan', 'odds_snapshot', 'feature_store_rebuild', 'data_quality_audit']) {
  assert.equal(names.has(expected), true, `missing step ${expected}`);
}

assert.equal(run.summary.paperPicksSaved >= 0, true);
assert.equal(run.summary.oddsLinesSaved >= 0, true);
assert.equal(run.summary.featureVectorsBuilt >= 0, true);
assert.equal(run.summary.dataQualityReadiness, 'collecting_data');
assert.equal(run.summary.recommendation, 'collecting_data');

console.log(`QA continuous collector passed: ${run.runId} validated with ${run.steps.length} step(s).`);
