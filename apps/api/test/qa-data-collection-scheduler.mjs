import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/data-collection-scheduler-run.sample.json', import.meta.url), 'utf-8'),
);

assert.equal(fixture.schedulerVersion, 'data-collection-scheduler-v0.1');
assert.equal(fixture.status, 'success');
assert.ok(['manual', 'interval'].includes(fixture.trigger));
assert.ok(fixture.config.bankroll > 0);
assert.ok(fixture.config.intervalMinutes >= 1);
assert.equal(fixture.collectorStatus, 'completed_with_warnings');
assert.equal(fixture.dataQualityReadiness, 'collecting_data');
assert.equal(typeof fixture.paperPicksSaved, 'number');
assert.equal(typeof fixture.oddsLinesSaved, 'number');
assert.equal(typeof fixture.featureVectorsBuilt, 'number');
assert.ok(fixture.saved.runsPath.includes('data-collection-scheduler'));
assert.ok(fixture.saved.statePath.includes('state.json'));

console.log(`QA data collection scheduler passed: ${fixture.runId} validated.`);
