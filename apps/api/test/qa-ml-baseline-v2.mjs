import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const model = JSON.parse(
  await readFile(new URL('./fixtures/ml-baseline-v2-model.sample.json', import.meta.url), 'utf-8'),
);
const prediction = JSON.parse(
  await readFile(new URL('./fixtures/ml-baseline-v2-prediction.sample.json', import.meta.url), 'utf-8'),
);

const allowedStatuses = new Set(['trained', 'insufficient_data']);
const allowedDecisions = new Set(['paper_candidate', 'watch', 'avoid', 'insufficient_data']);
const requiredFeatures = [
  'logBestOdds',
  'consensusProbability',
  'edgeVsConsensus',
  'expectedValuePerUnit',
  'scannerScore',
  'priceSpreadPct',
  'marketHoldPct',
  'lineObservationCount',
  'oddsChangePct',
  'impliedProbabilityChange',
  'consensusProbabilityChange',
  'expectedValueChange',
  'sourcePaperPick',
  'trendShortening',
  'trendDrifting',
  'recommendationValueCandidate',
];

assert.equal(model.modelVersion, 'ml-baseline-v2-v0.1');
assert.ok(allowedStatuses.has(model.status));
assert.equal(model.filters.source, 'training_dataset');
assert.ok(model.sourceDatasetExportId);
assert.ok(Array.isArray(model.featureNames));
for (const feature of requiredFeatures) {
  assert.ok(model.featureNames.includes(feature), `model missing feature ${feature}`);
}
assert.equal(typeof model.sourceTrainingEligibleRows, 'number');
assert.equal(typeof model.weightedRows, 'number');
assert.ok(model.saved.predictionsPath.includes('ml-baseline-v2'));

assert.equal(prediction.modelVersion, 'ml-baseline-v2-v0.1');
assert.ok(allowedStatuses.has(prediction.modelStatus));
assert.ok(allowedDecisions.has(prediction.decision));
assert.ok(prediction.sourceDatasetExportId);
assert.ok(prediction.datasetRowId.startsWith('dataset_row__'));
assert.equal(prediction.labelKnown, true);
assert.equal(typeof prediction.labelWeight, 'number');
assert.equal(prediction.realStakeSuggested, 0);
assert.ok(Array.isArray(prediction.reasons) && prediction.reasons.length > 0);

console.log('QA ML baseline v2 passed: model fixture and prediction fixture validated.');
