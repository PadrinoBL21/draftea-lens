import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const report = JSON.parse(
  await readFile(new URL('./fixtures/data-quality-report.sample.json', import.meta.url), 'utf-8'),
);

assert.equal(report.dataQualityVersion, 'data-quality-v0.1');
assert.ok(['not_ready', 'collecting_data', 'ready_for_baseline_training', 'ready_for_backtesting', 'ready_for_neural_training'].includes(report.readiness));
assert.ok(report.thresholds.minLabelableRows >= 0);
assert.ok(report.counts.paperPicks.total >= 0);
assert.ok(report.counts.featureStore.totalFeatureVectors >= 0);
assert.ok(report.counts.oddsHistory.totalLineObservations >= 0);
assert.ok(Array.isArray(report.checks));
assert.ok(report.checks.length > 0);
assert.ok(Array.isArray(report.blockers));
assert.ok(Array.isArray(report.warnings));
assert.ok(Array.isArray(report.recommendations));

for (const check of report.checks) {
  assert.equal(typeof check.name, 'string');
  assert.ok(['pass', 'warn', 'fail'].includes(check.status));
  assert.equal(typeof check.message, 'string');
}

console.log(`QA data quality passed: ${report.auditId} validated with readiness ${report.readiness}.`);
