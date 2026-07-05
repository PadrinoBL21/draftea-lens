import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const allowedResults = new Set(['win', 'loss', 'push', 'void', 'half_win', 'half_loss']);
const allowedStakingModes = new Set(['flat', 'paper', 'ev_scaled']);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNumber(value, fieldName, { min = Number.NEGATIVE_INFINITY } = {}) {
  assert(typeof value === 'number' && Number.isFinite(value), `${fieldName} must be a finite number`);
  assert(value >= min, `${fieldName} must be >= ${min}`);
}

function validateBucket(bucket, name) {
  const fields = ['count', 'wins', 'losses', 'pushes', 'voids', 'halfWins', 'halfLosses', 'totalStake', 'profitLoss', 'roiPct', 'hitRatePct', 'averageExpectedValue'];
  for (const field of fields) {
    assert(Object.prototype.hasOwnProperty.call(bucket, field), `${name} missing field: ${field}`);
  }
  assertNumber(bucket.count, `${name}.count`, { min: 0 });
  assertNumber(bucket.totalStake, `${name}.totalStake`, { min: 0 });
  assertNumber(bucket.profitLoss, `${name}.profitLoss`);
  assertNumber(bucket.roiPct, `${name}.roiPct`);
}

function validateTrade(trade, index) {
  const required = [
    'featureVectorId',
    'source',
    'sourceId',
    'eventId',
    'eventName',
    'commenceTime',
    'sportKey',
    'marketKey',
    'marketType',
    'selection',
    'oddsDecimal',
    'expectedValuePerUnit',
    'scannerScore',
    'trend',
    'settlementResult',
    'simulatedStake',
    'simulatedProfitLoss',
    'bankrollAfter',
  ];

  for (const field of required) {
    assert(Object.prototype.hasOwnProperty.call(trade, field), `trade[${index}] missing field: ${field}`);
  }

  assert(allowedResults.has(trade.settlementResult), `trade[${index}].settlementResult invalid`);
  assertNumber(trade.oddsDecimal, `trade[${index}].oddsDecimal`, { min: 1.01 });
  assertNumber(trade.simulatedStake, `trade[${index}].simulatedStake`, { min: 0 });
  assertNumber(trade.simulatedProfitLoss, `trade[${index}].simulatedProfitLoss`);
  assertNumber(trade.bankrollAfter, `trade[${index}].bankrollAfter`);
}

function validateBacktestReport(report) {
  const required = [
    'runId',
    'generatedAt',
    'backtestVersion',
    'filters',
    'rowsConsidered',
    'eligibleRows',
    'skippedRows',
    'wins',
    'losses',
    'pushes',
    'voids',
    'halfWins',
    'halfLosses',
    'totalStake',
    'profitLoss',
    'roiPct',
    'hitRatePct',
    'maxDrawdown',
    'byMarketType',
    'bySport',
    'sampleTrades',
    'saved',
  ];

  for (const field of required) {
    assert(Object.prototype.hasOwnProperty.call(report, field), `report missing field: ${field}`);
  }

  assert(report.backtestVersion.startsWith('backtesting-'), 'backtestVersion must be versioned');
  assert(allowedStakingModes.has(report.filters.stakingMode), 'filters.stakingMode invalid');
  assertNumber(report.rowsConsidered, 'rowsConsidered', { min: 0 });
  assertNumber(report.eligibleRows, 'eligibleRows', { min: 0 });
  assertNumber(report.skippedRows, 'skippedRows', { min: 0 });
  assert(report.rowsConsidered === report.eligibleRows + report.skippedRows, 'rowsConsidered must equal eligibleRows + skippedRows');
  assertNumber(report.totalStake, 'totalStake', { min: 0 });
  assertNumber(report.profitLoss, 'profitLoss');
  assertNumber(report.roiPct, 'roiPct');
  assert(Array.isArray(report.sampleTrades), 'sampleTrades must be an array');

  for (const [key, bucket] of Object.entries(report.byMarketType)) {
    validateBucket(bucket, `byMarketType.${key}`);
  }

  for (const [key, bucket] of Object.entries(report.bySport)) {
    validateBucket(bucket, `bySport.${key}`);
  }

  report.sampleTrades.forEach(validateTrade);
}

const reportPath = join(__dirname, 'fixtures', 'backtest-report.sample.json');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
validateBacktestReport(report);

console.log(`QA backtesting passed: sample report ${report.runId} validated.`);
