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

const requiredOddsLineFields = [
  'lineId',
  'snapshotId',
  'capturedAt',
  'modelVersion',
  'source',
  'eventId',
  'eventName',
  'commenceTime',
  'sportKey',
  'marketKey',
  'marketType',
  'selection',
  'bestOddsDecimal',
  'bestBookmaker',
  'worstOddsDecimal',
  'averageOddsDecimal',
  'impliedProbabilityBest',
  'consensusImpliedProbability',
  'consensusProbability',
  'fairOddsConsensus',
  'edgeVsConsensus',
  'expectedValuePerUnit',
  'bookmakerCount',
  'priceSpreadPct',
  'marketHoldPct',
  'scannerScore',
  'scannerRecommendation',
  'featuresSnapshot',
];

const requiredFeatureVectorFields = [
  'featureVectorId',
  'createdAt',
  'featureStoreVersion',
  'source',
  'sourceId',
  'eventId',
  'eventName',
  'commenceTime',
  'sportKey',
  'marketKey',
  'marketType',
  'selection',
  'bestOddsDecimal',
  'averageOddsDecimal',
  'consensusProbability',
  'fairOddsConsensus',
  'edgeVsConsensus',
  'expectedValuePerUnit',
  'bookmakerCount',
  'priceSpreadPct',
  'marketHoldPct',
  'scannerScore',
  'scannerRecommendation',
  'lineId',
  'lineObservationCount',
  'oddsChangePct',
  'impliedProbabilityChange',
  'consensusProbabilityChange',
  'expectedValueChange',
  'trend',
  'outcomeKnown',
  'labelWin',
  'labelProfitLoss',
  'labelClosingLineValue',
];

const allowedTypes = new Set(['learning_probe', 'value_paper_pick', 'shadow_reference_pick']);
const allowedStatuses = new Set(['open', 'settled', 'void']);
const allowedSettlementResults = new Set(['win', 'loss', 'push', 'void', 'half_win', 'half_loss']);
const allowedFeatureSources = new Set(['paper_pick', 'odds_line']);
const allowedTrends = new Set(['shortening', 'drifting', 'flat', 'unknown']);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNumber(value, fieldName, { min = Number.NEGATIVE_INFINITY } = {}) {
  assert(typeof value === 'number' && Number.isFinite(value), `${fieldName} must be a finite number`);
  assert(value >= min, `${fieldName} must be >= ${min}`);
}

function readValueArrayFixture(fileName, itemName) {
  const fixturePath = join(__dirname, 'fixtures', fileName);
  const payload = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const values = Array.isArray(payload) ? payload : payload.value;
  assert(Array.isArray(values), `${fileName} must contain an array or a value array`);
  assert(values.length > 0, `${fileName} must include at least one ${itemName}`);
  return values;
}

function validatePaperPick(pick, index, fixtureName) {
  for (const field of requiredPaperPickFields) {
    assert(Object.prototype.hasOwnProperty.call(pick, field), `${fixtureName} pick[${index}] missing field: ${field}`);
  }

  assert(allowedStatuses.has(pick.status), `${fixtureName} pick[${index}].status is invalid`);
  assert(allowedTypes.has(pick.type), `${fixtureName} pick[${index}].type is invalid`);
  assert(pick.modelVersion.startsWith('consensus-ev-'), `${fixtureName} pick[${index}].modelVersion must be versioned`);
  assertNumber(pick.bestOddsDecimal, `${fixtureName} pick[${index}].bestOddsDecimal`, { min: 1.01 });
  assertNumber(pick.averageOddsDecimal, `${fixtureName} pick[${index}].averageOddsDecimal`, { min: 1.01 });
  assertNumber(pick.consensusProbability, `${fixtureName} pick[${index}].consensusProbability`, { min: 0 });
  assert(pick.consensusProbability <= 1, `${fixtureName} pick[${index}].consensusProbability must be <= 1`);
  assertNumber(pick.expectedValuePerUnit, `${fixtureName} pick[${index}].expectedValuePerUnit`);
  assertNumber(pick.paperStake, `${fixtureName} pick[${index}].paperStake`, { min: 0 });
  assertNumber(pick.realStakeSuggested, `${fixtureName} pick[${index}].realStakeSuggested`, { min: 0 });
  assert(Array.isArray(pick.reasons) && pick.reasons.length > 0, `${fixtureName} pick[${index}].reasons must not be empty`);
  assert(typeof pick.featuresSnapshot === 'object' && pick.featuresSnapshot !== null, `${fixtureName} pick[${index}].featuresSnapshot required`);

  if (pick.scannerRecommendation !== 'value_candidate') {
    assert(pick.realStakeSuggested === 0, `${fixtureName} pick[${index}] non-value candidate must not suggest real stake`);
  }

  if (pick.status === 'open') {
    assert(!pick.settlement, `${fixtureName} pick[${index}] open pick must not have settlement`);
  }

  if (pick.status === 'settled' || pick.status === 'void') {
    validateSettlement(pick, index, fixtureName);
  }
}

function validateSettlement(pick, index, fixtureName) {
  const settlement = pick.settlement;
  assert(typeof settlement === 'object' && settlement !== null, `${fixtureName} pick[${index}].settlement required`);
  assert(typeof settlement.settledAt === 'string' && settlement.settledAt.length > 0, `${fixtureName} pick[${index}].settlement.settledAt required`);
  assert(allowedSettlementResults.has(settlement.result), `${fixtureName} pick[${index}].settlement.result is invalid`);
  assertNumber(settlement.paperProfitLoss, `${fixtureName} pick[${index}].settlement.paperProfitLoss`);

  if (typeof settlement.closingOdds !== 'undefined') {
    assertNumber(settlement.closingOdds, `${fixtureName} pick[${index}].settlement.closingOdds`, { min: 1.01 });
  }

  if (typeof settlement.closingLineValue !== 'undefined') {
    assertNumber(settlement.closingLineValue, `${fixtureName} pick[${index}].settlement.closingLineValue`);
  }

  if (pick.status === 'void') {
    assert(settlement.result === 'void', `${fixtureName} pick[${index}] void status must have void result`);
    assert(settlement.paperProfitLoss === 0, `${fixtureName} pick[${index}] void pick must have zero P/L`);
  }
}

function validateOddsLine(line, index, fixtureName) {
  for (const field of requiredOddsLineFields) {
    assert(Object.prototype.hasOwnProperty.call(line, field), `${fixtureName} line[${index}] missing field: ${field}`);
  }

  assert(line.modelVersion.startsWith('odds-history-'), `${fixtureName} line[${index}].modelVersion must be versioned`);
  assert(line.source === 'smart_scan_consensus_ev', `${fixtureName} line[${index}].source is invalid`);
  assert(typeof line.lineId === 'string' && line.lineId.length > 0, `${fixtureName} line[${index}].lineId required`);
  assert(typeof line.snapshotId === 'string' && line.snapshotId.length > 0, `${fixtureName} line[${index}].snapshotId required`);
  assertNumber(line.bestOddsDecimal, `${fixtureName} line[${index}].bestOddsDecimal`, { min: 1.01 });
  assertNumber(line.worstOddsDecimal, `${fixtureName} line[${index}].worstOddsDecimal`, { min: 1.01 });
  assertNumber(line.averageOddsDecimal, `${fixtureName} line[${index}].averageOddsDecimal`, { min: 1.01 });
  assertNumber(line.impliedProbabilityBest, `${fixtureName} line[${index}].impliedProbabilityBest`, { min: 0 });
  assert(line.impliedProbabilityBest <= 1, `${fixtureName} line[${index}].impliedProbabilityBest must be <= 1`);
  assertNumber(line.consensusProbability, `${fixtureName} line[${index}].consensusProbability`, { min: 0 });
  assert(line.consensusProbability <= 1, `${fixtureName} line[${index}].consensusProbability must be <= 1`);
  assertNumber(line.expectedValuePerUnit, `${fixtureName} line[${index}].expectedValuePerUnit`);
  assertNumber(line.bookmakerCount, `${fixtureName} line[${index}].bookmakerCount`, { min: 1 });
  assertNumber(line.priceSpreadPct, `${fixtureName} line[${index}].priceSpreadPct`, { min: 0 });
  assert(typeof line.featuresSnapshot === 'object' && line.featuresSnapshot !== null, `${fixtureName} line[${index}].featuresSnapshot required`);
}

function validateFeatureVector(vector, index, fixtureName) {
  for (const field of requiredFeatureVectorFields) {
    assert(Object.prototype.hasOwnProperty.call(vector, field), `${fixtureName} vector[${index}] missing field: ${field}`);
  }

  assert(vector.featureStoreVersion.startsWith('feature-store-'), `${fixtureName} vector[${index}].featureStoreVersion must be versioned`);
  assert(allowedFeatureSources.has(vector.source), `${fixtureName} vector[${index}].source is invalid`);
  assert(allowedTrends.has(vector.trend), `${fixtureName} vector[${index}].trend is invalid`);
  assert(typeof vector.featureVectorId === 'string' && vector.featureVectorId.length > 0, `${fixtureName} vector[${index}].featureVectorId required`);
  assertNumber(vector.bestOddsDecimal, `${fixtureName} vector[${index}].bestOddsDecimal`, { min: 1.01 });
  assertNumber(vector.averageOddsDecimal, `${fixtureName} vector[${index}].averageOddsDecimal`, { min: 1.01 });
  assertNumber(vector.consensusProbability, `${fixtureName} vector[${index}].consensusProbability`, { min: 0 });
  assert(vector.consensusProbability <= 1, `${fixtureName} vector[${index}].consensusProbability must be <= 1`);
  assertNumber(vector.expectedValuePerUnit, `${fixtureName} vector[${index}].expectedValuePerUnit`);
  assertNumber(vector.bookmakerCount, `${fixtureName} vector[${index}].bookmakerCount`, { min: 1 });
  assertNumber(vector.priceSpreadPct, `${fixtureName} vector[${index}].priceSpreadPct`, { min: 0 });
  assertNumber(vector.lineObservationCount, `${fixtureName} vector[${index}].lineObservationCount`, { min: 0 });
  assertNumber(vector.oddsChangePct, `${fixtureName} vector[${index}].oddsChangePct`);
  assertNumber(vector.expectedValueChange, `${fixtureName} vector[${index}].expectedValueChange`);
  assert(typeof vector.outcomeKnown === 'boolean', `${fixtureName} vector[${index}].outcomeKnown must be boolean`);

  if (vector.source === 'paper_pick') {
    assert(typeof vector.paperPickId === 'string' && vector.paperPickId.length > 0, `${fixtureName} vector[${index}].paperPickId required`);
    assertNumber(vector.paperStake, `${fixtureName} vector[${index}].paperStake`, { min: 0 });
    assertNumber(vector.realStakeSuggested, `${fixtureName} vector[${index}].realStakeSuggested`, { min: 0 });
  }

  if (vector.outcomeKnown) {
    assert(vector.labelProfitLoss !== null, `${fixtureName} vector[${index}] outcome-known vector must carry P/L label`);
  }
}

const openPicks = readValueArrayFixture('paper-picks.sample.json', 'paper pick');
openPicks.forEach((pick, index) => validatePaperPick(pick, index, 'paper-picks.sample.json'));

const settledPicks = readValueArrayFixture('settled-picks.sample.json', 'settled paper pick');
settledPicks.forEach((pick, index) => validatePaperPick(pick, index, 'settled-picks.sample.json'));

const oddsLines = readValueArrayFixture('odds-history-lines.sample.json', 'odds line');
oddsLines.forEach((line, index) => validateOddsLine(line, index, 'odds-history-lines.sample.json'));

const repeatedLineIds = new Set();
for (const line of oddsLines) {
  if (oddsLines.filter((candidate) => candidate.lineId === line.lineId).length > 1) {
    repeatedLineIds.add(line.lineId);
  }
}
assert(repeatedLineIds.size > 0, 'odds-history-lines.sample.json must include at least one repeated lineId to test movement history');

const featureVectors = readValueArrayFixture('feature-store-vectors.sample.json', 'feature vector');
featureVectors.forEach((vector, index) => validateFeatureVector(vector, index, 'feature-store-vectors.sample.json'));
assert(featureVectors.some((vector) => vector.source === 'paper_pick'), 'feature-store fixture must include a paper_pick vector');
assert(featureVectors.some((vector) => vector.source === 'odds_line'), 'feature-store fixture must include an odds_line vector');

console.log(
  `QA fixtures passed: ${openPicks.length} open paper pick(s), ${settledPicks.length} settled paper pick(s), ${oddsLines.length} odds line observation(s), ${featureVectors.length} feature vector(s) validated.`,
);
