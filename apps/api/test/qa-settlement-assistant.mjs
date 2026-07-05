import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const preview = JSON.parse(
  readFileSync(join(process.cwd(), 'test', 'fixtures', 'settlement-assistant-preview.sample.json'), 'utf-8'),
);
const apply = JSON.parse(
  readFileSync(join(process.cwd(), 'test', 'fixtures', 'settlement-assistant-apply.sample.json'), 'utf-8'),
);

assert.equal(preview.assistantVersion, 'settlement-assistant-v0.1');
assert.equal(typeof preview.totalOpenPicks, 'number');
assert.ok(Array.isArray(preview.candidates));
assert.ok(preview.candidates.length >= 1);
assert.equal(preview.candidates[0].recommendation, 'manual_result_required');
assert.ok(preview.candidates[0].allowedResults.includes('win'));
assert.ok(preview.candidates[0].allowedResults.includes('loss'));

assert.equal(apply.assistantVersion, 'settlement-assistant-v0.1');
assert.equal(apply.status, 'completed');
assert.equal(apply.requested, 1);
assert.equal(apply.settled, 1);
assert.equal(apply.failed, 0);
assert.equal(apply.results[0].result, 'win');
assert.ok(apply.postSettlement.featureVectorsBuilt >= 1);
assert.equal(apply.postSettlement.dataQualityReadiness, 'collecting_data');

console.log(`QA settlement assistant passed: ${apply.runId} validated with ${apply.settled} settlement(s).`);
