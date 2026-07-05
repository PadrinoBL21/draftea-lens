import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'ml-baseline-model.sample.json'), 'utf-8'));
const prediction = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'ml-baseline-prediction.sample.json'), 'utf-8'));

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNumber(value, fieldName, options = {}) {
  assert(typeof value === 'number' && Number.isFinite(value), `${fieldName} must be a finite number`);
  if (options.min !== undefined) assert(value >= options.min, `${fieldName} must be >= ${options.min}`);
  if (options.max !== undefined) assert(value <= options.max, `${fieldName} must be <= ${options.max}`);
}

assert(model.modelVersion === 'ml-baseline-v0.1', 'modelVersion mismatch');
assert(allowedStatuses.has(model.status), 'invalid model status');
assert(Array.isArray(model.featureNames), 'featureNames must be an array');
for (const feature of requiredFeatures) {
  assert(model.featureNames.includes(feature), `model missing feature: ${feature}`);
}
assertNumber(model.trainingRows, 'model.trainingRows', { min: 0 });
assertNumber(model.validationRows, 'model.validationRows', { min: 0 });
assertNumber(model.positiveLabels, 'model.positiveLabels', { min: 0 });
assertNumber(model.negativeLabels, 'model.negativeLabels', { min: 0 });
assert(model.realStakeSuggested === undefined, 'model must not contain realStakeSuggested');
assert(model.saved && model.saved.predictionsPath, 'model missing saved.predictionsPath');

assert(prediction.modelVersion === 'ml-baseline-v0.1', 'prediction modelVersion mismatch');
assert(allowedStatuses.has(prediction.modelStatus), 'invalid prediction modelStatus');
assert(allowedDecisions.has(prediction.decision), 'invalid prediction decision');
assertNumber(prediction.bestOddsDecimal, 'prediction.bestOddsDecimal', { min: 1 });
assertNumber(prediction.breakEvenProbability, 'prediction.breakEvenProbability', { min: 0, max: 1 });
if (prediction.predictedWinProbability !== null) {
  assertNumber(prediction.predictedWinProbability, 'prediction.predictedWinProbability', { min: 0, max: 1 });
}
if (prediction.predictedExpectedValuePerUnit !== null) {
  assertNumber(prediction.predictedExpectedValuePerUnit, 'prediction.predictedExpectedValuePerUnit');
}
assert(prediction.realStakeSuggested === 0, 'ML baseline must never suggest real stake');
assert(Array.isArray(prediction.reasons) && prediction.reasons.length > 0, 'prediction reasons required');

console.log('QA ML baseline passed: model fixture and prediction fixture validated.');
