import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const requiredPaperPickFields = [
  'paperPickId',
  'scanId',
  'generatedAt',
  'modelVersion',
  'source',
  'type',
  'status',
  'eventId',
  'eventName',
  'commenceTime',
  'sportKey',
  'marketKey',
  'marketType',
  'selection',
  'bestOddsDecimal',
  'bestBookmaker',
  'averageOddsDecimal',
  'consensusProbability',
  'fairOddsConsensus',
  'edgeVsConsensus',
  'expectedValuePerUnit',
  'kellyFractional',
  'scannerScore',
  'scannerRecommendation',
  'paperStake',
  'realStakeSuggested',
  'learningEligible',
  'reasons',
  'featuresSnapshot',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNumber(value, fieldName, { min = Number.NEGATIVE_INFINITY } = {}) {
  assert(typeof value === 'number' && Number.isFinite(value), `${fieldName} must be a finite number`);
  assert(value >= min, `${fieldName} must be >= ${min}`);
}

function validatePaperPick(pick, index) {
  for (const field of requiredPaperPickFields) {
    assert(Object.prototype.hasOwnProperty.call(pick, field), `pick[${index}] missing field: ${field}`);
  }

  assert(pick.status === 'open', `pick[${index}].status must start as open`);
  assert(pick.type === 'learning_probe' || pick.type === 'paper_value', `pick[${index}].type is invalid`);
  assert(pick.modelVersion.startsWith('consensus-ev-'), `pick[${index}].modelVersion must be versioned`);
  assertNumber(pick.bestOddsDecimal, `pick[${index}].bestOddsDecimal`, { min: 1.01 });
  assertNumber(pick.averageOddsDecimal, `pick[${index}].averageOddsDecimal`, { min: 1.01 });
  assertNumber(pick.consensusProbability, `pick[${index}].consensusProbability`, { min: 0 });
  assert(pick.consensusProbability <= 1, `pick[${index}].consensusProbability must be <= 1`);
  assertNumber(pick.expectedValuePerUnit, `pick[${index}].expectedValuePerUnit`);
  assertNumber(pick.paperStake, `pick[${index}].paperStake`, { min: 0 });
  assertNumber(pick.realStakeSuggested, `pick[${index}].realStakeSuggested`, { min: 0 });
  assert(Array.isArray(pick.reasons) && pick.reasons.length > 0, `pick[${index}].reasons must not be empty`);
  assert(typeof pick.featuresSnapshot === 'object' && pick.featuresSnapshot !== null, `pick[${index}].featuresSnapshot required`);

  if (pick.scannerRecommendation !== 'value_candidate') {
    assert(pick.realStakeSuggested === 0, `pick[${index}] non-value candidate must not suggest real stake`);
  }
}

const fixturePath = join(__dirname, 'fixtures', 'paper-picks.sample.json');
const payload = JSON.parse(readFileSync(fixturePath, 'utf8'));
const picks = Array.isArray(payload) ? payload : payload.value;

assert(Array.isArray(picks), 'fixture must contain an array of paper picks or a value array');
assert(picks.length > 0, 'fixture must include at least one paper pick');
picks.forEach(validatePaperPick);

console.log(`QA fixtures passed: ${picks.length} paper pick(s) validated.`);
