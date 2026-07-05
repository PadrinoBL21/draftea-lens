import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

const evaluation = JSON.parse(
  await readFile(join(fixturesDir, 'model-governance-evaluation.sample.json'), 'utf-8'),
);
const champion = JSON.parse(
  await readFile(join(fixturesDir, 'model-governance-champion.sample.json'), 'utf-8'),
);

assert.equal(champion.modelType, 'rules_engine');
assert.equal(champion.status, 'active');
assert.equal(evaluation.governanceVersion, 'model-governance-v0.1');
assert.equal(evaluation.champion.modelId, champion.modelId);
assert.equal(evaluation.challenger.modelType, 'ml_baseline');
assert.equal(evaluation.status, 'blocked_insufficient_data');
assert.equal(evaluation.promotable, false);
assert.equal(evaluation.recommendation, 'keep_champion');
assert.ok(Array.isArray(evaluation.failedChecks));
assert.ok(evaluation.failedChecks.length >= 1);
assert.ok(evaluation.failedChecks.some((check) => check.includes('insufficient_data')));

console.log(`QA model governance passed: ${evaluation.evaluationId} validated.`);
