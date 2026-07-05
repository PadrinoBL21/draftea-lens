import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuditDataQualityDto } from './dto/audit-data-quality.dto';
import {
  DataQualityCheck,
  DataQualityCounts,
  DataQualityReadiness,
  DataQualityReport,
  DataQualitySummary,
  DataQualityThresholds,
} from './data-quality.types';

const DATA_QUALITY_VERSION = 'data-quality-v0.1';
const DATA_DIR = join(process.cwd(), 'data', 'data-quality');
const AUDITS_JSONL = join(DATA_DIR, 'audits.jsonl');
const LATEST_AUDIT_JSON = join(DATA_DIR, 'latest-audit.json');

const PAPER_PICKS_JSONL = join(process.cwd(), 'data', 'paper-ledger', 'paper-picks.jsonl');
const ODDS_LINES_JSONL = join(process.cwd(), 'data', 'odds-history', 'odds-lines.jsonl');
const FEATURES_JSONL = join(process.cwd(), 'data', 'feature-store', 'features.jsonl');
const BACKTEST_LATEST_JSON = join(process.cwd(), 'data', 'backtesting', 'latest-run.json');
const ML_LATEST_MODEL_JSON = join(process.cwd(), 'data', 'ml-baseline', 'latest-model.json');

type AnyRecord = Record<string, any>;

interface ReadJsonlResult<T> {
  rows: T[];
  malformedRows: number;
}

@Injectable()
export class DataQualityService {
  async audit(dto: AuditDataQualityDto = {}): Promise<DataQualityReport> {
    await this.ensureStorage();
    const auditedAt = new Date().toISOString();
    const thresholds = this.thresholds(dto);
    const counts = await this.counts();
    const checks = this.checks(counts, thresholds);
    const blockers = checks.filter((check) => check.status === 'fail').map((check) => check.message);
    const warnings = checks.filter((check) => check.status === 'warn').map((check) => check.message);
    const readiness = this.readinessFromCounts(counts, thresholds, blockers);

    const report: DataQualityReport = {
      auditId: this.createId('data_quality_audit', auditedAt),
      auditedAt,
      dataQualityVersion: DATA_QUALITY_VERSION,
      readiness,
      thresholds,
      counts,
      checks,
      blockers,
      warnings,
      recommendations: this.recommendations(readiness, counts, thresholds, blockers, warnings),
    };

    if (dto.persist ?? true) {
      report.saved = {
        auditsPath: 'data/data-quality/audits.jsonl',
        latestAuditPath: 'data/data-quality/latest-audit.json',
      };
      await this.appendJsonl(AUDITS_JSONL, report);
      await writeFile(LATEST_AUDIT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
    }

    return report;
  }

  async report(): Promise<DataQualityReport> {
    await this.ensureStorage();
    if (!existsSync(LATEST_AUDIT_JSON)) return this.audit({ persist: true });
    const raw = await readFile(LATEST_AUDIT_JSON, 'utf-8');
    if (!raw.trim()) return this.audit({ persist: true });
    return JSON.parse(raw) as DataQualityReport;
  }

  async readiness(): Promise<Pick<DataQualityReport, 'auditId' | 'auditedAt' | 'dataQualityVersion' | 'readiness' | 'blockers' | 'warnings' | 'recommendations' | 'counts'>> {
    const report = await this.audit({ persist: false });
    return {
      auditId: report.auditId,
      auditedAt: report.auditedAt,
      dataQualityVersion: report.dataQualityVersion,
      readiness: report.readiness,
      blockers: report.blockers,
      warnings: report.warnings,
      recommendations: report.recommendations,
      counts: report.counts,
    };
  }

  async summary(): Promise<DataQualitySummary> {
    const report = await this.audit({ persist: false });
    return {
      dataQualityVersion: DATA_QUALITY_VERSION,
      latestAuditId: report.auditId,
      latestAuditedAt: report.auditedAt,
      readiness: report.readiness,
      blockerCount: report.blockers.length,
      warningCount: report.warnings.length,
      keyCounts: {
        paperPicks: report.counts.paperPicks.total,
        settledPicks: report.counts.paperPicks.settled,
        labelableRows: report.counts.featureStore.labelableVectors,
        featureVectors: report.counts.featureStore.totalFeatureVectors,
        oddsLineObservations: report.counts.oddsHistory.totalLineObservations,
        lineMovementObservations: report.counts.oddsHistory.lineMovementObservations,
        latestBacktestEligibleRows: report.counts.backtesting.latestEligibleRows,
        latestMlTrainingRows: report.counts.mlBaseline.latestTrainingRows,
      },
    };
  }

  private thresholds(dto: AuditDataQualityDto): DataQualityThresholds {
    return {
      minPaperPicks: this.int(dto.minPaperPicks, 50, 0, 1_000_000),
      minSettledPicks: this.int(dto.minSettledPicks, 50, 0, 1_000_000),
      minLabelableRows: this.int(dto.minLabelableRows, 100, 0, 1_000_000),
      minFeatureVectors: this.int(dto.minFeatureVectors, 100, 0, 1_000_000),
      minOddsLineObservations: this.int(dto.minOddsLineObservations, 250, 0, 1_000_000),
      minLineMovementObservations: this.int(dto.minLineMovementObservations, 50, 0, 1_000_000),
      minBacktestEligibleRows: this.int(dto.minBacktestEligibleRows, 100, 0, 1_000_000),
      minPositiveLabels: this.int(dto.minPositiveLabels, 25, 0, 1_000_000),
      minNegativeLabels: this.int(dto.minNegativeLabels, 25, 0, 1_000_000),
      minTrackedSports: this.int(dto.minTrackedSports, 1, 0, 1000),
      minTrackedMarketTypes: this.int(dto.minTrackedMarketTypes, 2, 0, 1000),
      maxVoidRatePct: this.num(dto.maxVoidRatePct, 30, 0, 100),
      minNeuralTrainingRows: this.int(dto.minNeuralTrainingRows, 1000, 0, 10_000_000),
      minNeuralSettledPicks: this.int(dto.minNeuralSettledPicks, 500, 0, 10_000_000),
    };
  }

  private async counts(): Promise<DataQualityCounts> {
    const paper = await this.readJsonl<AnyRecord>(PAPER_PICKS_JSONL);
    const odds = await this.readJsonl<AnyRecord>(ODDS_LINES_JSONL);
    const features = await this.readJsonl<AnyRecord>(FEATURES_JSONL);
    const latestBacktest = await this.readJson<AnyRecord>(BACKTEST_LATEST_JSON);
    const latestMlModel = await this.readJson<AnyRecord>(ML_LATEST_MODEL_JSON);

    const paperIds = new Set<string>();
    let duplicatePaperIds = 0;
    for (const pick of paper.rows) {
      const id = String(pick.paperPickId ?? '');
      if (!id) continue;
      if (paperIds.has(id)) duplicatePaperIds += 1;
      paperIds.add(id);
    }

    const paperResults = paper.rows.map((pick) => String(pick.settlement?.result ?? pick.status ?? 'open'));
    const settledEconomic = paperResults.filter((result) => ['win', 'loss', 'push', 'half_win', 'half_loss'].includes(result));
    const voidCount = paperResults.filter((result) => result === 'void').length;
    const win = paperResults.filter((result) => result === 'win').length;
    const loss = paperResults.filter((result) => result === 'loss').length;
    const halfWin = paperResults.filter((result) => result === 'half_win').length;
    const halfLoss = paperResults.filter((result) => result === 'half_loss').length;
    const push = paperResults.filter((result) => result === 'push').length;
    const labelablePicks = win + loss + halfWin + halfLoss;
    const settledOrVoid = settledEconomic.length + voidCount;

    const lineCounts = new Map<string, number>();
    const sports = new Set<string>();
    const events = new Set<string>();
    const marketTypes = new Set<string>();
    for (const line of odds.rows) {
      const lineId = String(line.lineId ?? '');
      if (lineId) lineCounts.set(lineId, (lineCounts.get(lineId) ?? 0) + 1);
      if (line.sportKey) sports.add(String(line.sportKey));
      if (line.eventId) events.add(String(line.eventId));
      if (line.marketType) marketTypes.add(String(line.marketType));
    }

    const featureIds = new Set<string>();
    let duplicateFeatureIds = 0;
    let incompleteVectors = 0;
    for (const vector of features.rows) {
      const id = String(vector.featureVectorId ?? '');
      if (!id) incompleteVectors += 1;
      if (id && featureIds.has(id)) duplicateFeatureIds += 1;
      if (id) featureIds.add(id);
      if (!this.isFiniteNumber(vector.bestOddsDecimal) || !this.isFiniteNumber(vector.expectedValuePerUnit)) incompleteVectors += 1;
    }

    const labelableVectors = features.rows.filter((vector) => vector.labelWin === 0 || vector.labelWin === 1);
    const latestBacktestRows = this.num(latestBacktest?.eligibleRows, 0, 0, 1_000_000);
    const latestTrainingRows = this.num(latestMlModel?.trainingRows, 0, 0, 1_000_000);
    const latestValidationRows = this.num(latestMlModel?.validationRows, 0, 0, 1_000_000);

    return {
      paperPicks: {
        total: paper.rows.length,
        open: paper.rows.filter((pick) => pick.status === 'open').length,
        settled: settledEconomic.length,
        void: voidCount,
        win,
        loss,
        push,
        halfWin,
        halfLoss,
        labelable: labelablePicks,
        positiveLabels: win + halfWin,
        negativeLabels: loss + halfLoss,
        duplicateIds: duplicatePaperIds,
        missingSettlement: paper.rows.filter((pick) => pick.status !== 'open' && !pick.settlement).length,
        malformedRows: paper.malformedRows,
        voidRatePct: settledOrVoid === 0 ? 0 : this.round((voidCount / settledOrVoid) * 100, 2),
      },
      oddsHistory: {
        totalLineObservations: odds.rows.length,
        uniqueLines: lineCounts.size,
        lineMovementObservations: [...lineCounts.values()].filter((count) => count > 1).length,
        trackedSports: sports.size,
        trackedEvents: events.size,
        trackedMarketTypes: marketTypes.size,
        malformedRows: odds.malformedRows,
      },
      featureStore: {
        totalFeatureVectors: features.rows.length,
        paperPickVectors: features.rows.filter((vector) => vector.source === 'paper_pick').length,
        oddsLineVectors: features.rows.filter((vector) => vector.source === 'odds_line').length,
        outcomeKnownVectors: features.rows.filter((vector) => vector.outcomeKnown === true).length,
        labelableVectors: labelableVectors.length,
        positiveLabels: labelableVectors.filter((vector) => vector.labelWin === 1).length,
        negativeLabels: labelableVectors.filter((vector) => vector.labelWin === 0).length,
        incompleteVectors,
        duplicateIds: duplicateFeatureIds,
        malformedRows: features.malformedRows,
      },
      backtesting: {
        latestRunId: latestBacktest?.runId ?? null,
        latestEligibleRows: latestBacktestRows,
        latestRoiPct: this.nullableNumber(latestBacktest?.roiPct),
        latestMaxDrawdown: this.nullableNumber(latestBacktest?.maxDrawdown),
        latestAverageClosingLineValue: this.nullableNumber(latestBacktest?.averageClosingLineValue),
        hasLatestRun: Boolean(latestBacktest),
      },
      mlBaseline: {
        latestModelId: latestMlModel?.modelId ?? null,
        latestStatus: latestMlModel?.status ?? null,
        latestTrainingRows,
        latestValidationRows,
        positiveLabels: this.num(latestMlModel?.positiveLabels, 0, 0, 1_000_000),
        negativeLabels: this.num(latestMlModel?.negativeLabels, 0, 0, 1_000_000),
        hasLatestModel: Boolean(latestMlModel),
      },
    };
  }

  private checks(counts: DataQualityCounts, thresholds: DataQualityThresholds): DataQualityCheck[] {
    const checks: DataQualityCheck[] = [];
    checks.push(this.minCheck('paper_picks_total', counts.paperPicks.total, thresholds.minPaperPicks, 'Collect enough paper picks before trusting aggregate metrics.'));
    checks.push(this.minCheck('settled_picks', counts.paperPicks.settled, thresholds.minSettledPicks, 'Settle more non-void picks to create reliable labels.'));
    checks.push(this.minCheck('labelable_feature_vectors', counts.featureStore.labelableVectors, thresholds.minLabelableRows, 'Feature store needs win/loss labels before ML training.'));
    checks.push(this.minCheck('positive_labels', counts.featureStore.positiveLabels, thresholds.minPositiveLabels, 'Dataset needs enough winning labels.'));
    checks.push(this.minCheck('negative_labels', counts.featureStore.negativeLabels, thresholds.minNegativeLabels, 'Dataset needs enough losing labels.'));
    checks.push(this.minCheck('feature_vectors_total', counts.featureStore.totalFeatureVectors, thresholds.minFeatureVectors, 'Rebuild feature store after paper scans, settlements, and odds snapshots.'));
    checks.push(this.minCheck('odds_line_observations', counts.oddsHistory.totalLineObservations, thresholds.minOddsLineObservations, 'Collect more odds snapshots.'));
    checks.push(this.minCheck('line_movement_observations', counts.oddsHistory.lineMovementObservations, thresholds.minLineMovementObservations, 'Take repeated snapshots of the same markets to measure movement.'));
    checks.push(this.minCheck('backtest_eligible_rows', counts.backtesting.latestEligibleRows, thresholds.minBacktestEligibleRows, 'Run backtests with enough eligible rows.'));
    checks.push(this.minCheck('tracked_sports', counts.oddsHistory.trackedSports, thresholds.minTrackedSports, 'Track enough sports for the configured scope.'));
    checks.push(this.minCheck('tracked_market_types', counts.oddsHistory.trackedMarketTypes, thresholds.minTrackedMarketTypes, 'Track enough market types for robust comparisons.'));
    checks.push(this.maxCheck('void_rate_pct', counts.paperPicks.voidRatePct, thresholds.maxVoidRatePct, 'Void rate is too high; labels may be weak or too sparse.'));
    checks.push(this.zeroCheck('duplicate_paper_pick_ids', counts.paperPicks.duplicateIds, 'Duplicate paper pick ids can corrupt training labels.'));
    checks.push(this.zeroCheck('duplicate_feature_vector_ids', counts.featureStore.duplicateIds, 'Duplicate feature vector ids can corrupt datasets.'));
    checks.push(this.zeroCheck('malformed_runtime_rows', counts.paperPicks.malformedRows + counts.oddsHistory.malformedRows + counts.featureStore.malformedRows, 'Malformed JSONL rows found in runtime data.'));
    checks.push(this.zeroCheck('incomplete_feature_vectors', counts.featureStore.incompleteVectors, 'Some feature vectors are missing required numeric fields.'));
    return checks;
  }

  private readinessFromCounts(
    counts: DataQualityCounts,
    thresholds: DataQualityThresholds,
    blockers: string[],
  ): DataQualityReadiness {
    if (counts.paperPicks.total === 0 && counts.featureStore.totalFeatureVectors === 0 && counts.oddsHistory.totalLineObservations === 0) {
      return 'not_ready';
    }

    const cleanEnough = blockers.length === 0;
    const baselineReady =
      counts.featureStore.labelableVectors >= thresholds.minLabelableRows &&
      counts.featureStore.positiveLabels >= thresholds.minPositiveLabels &&
      counts.featureStore.negativeLabels >= thresholds.minNegativeLabels &&
      counts.featureStore.incompleteVectors === 0 &&
      counts.featureStore.duplicateIds === 0;

    const backtestReady = baselineReady && counts.backtesting.latestEligibleRows >= thresholds.minBacktestEligibleRows;

    const neuralReady =
      backtestReady &&
      cleanEnough &&
      counts.featureStore.labelableVectors >= thresholds.minNeuralTrainingRows &&
      counts.paperPicks.settled >= thresholds.minNeuralSettledPicks &&
      counts.oddsHistory.lineMovementObservations >= thresholds.minLineMovementObservations;

    if (neuralReady) return 'ready_for_neural_training';
    if (backtestReady) return 'ready_for_backtesting';
    if (baselineReady) return 'ready_for_baseline_training';
    return 'collecting_data';
  }

  private recommendations(
    readiness: DataQualityReadiness,
    counts: DataQualityCounts,
    thresholds: DataQualityThresholds,
    blockers: string[],
    warnings: string[],
  ): string[] {
    const recommendations: string[] = [];

    if (readiness === 'not_ready') {
      recommendations.push('Run smart scans, save paper picks, create odds snapshots, then rebuild the feature store.');
    }
    if (counts.paperPicks.settled < thresholds.minSettledPicks) {
      recommendations.push('Settle more paper picks with real outcomes before training models.');
    }
    if (counts.featureStore.totalFeatureVectors < thresholds.minFeatureVectors) {
      recommendations.push('Rebuild the feature store after collecting new picks and odds history.');
    }
    if (counts.oddsHistory.lineMovementObservations < thresholds.minLineMovementObservations) {
      recommendations.push('Collect repeated odds snapshots for the same markets to improve line movement features.');
    }
    if (counts.featureStore.positiveLabels < thresholds.minPositiveLabels || counts.featureStore.negativeLabels < thresholds.minNegativeLabels) {
      recommendations.push('Balance the dataset with both winning and losing settled picks.');
    }
    if (blockers.length > 0) {
      recommendations.push('Keep Champion model active. Do not promote ML or neural models while data quality checks fail.');
    }
    if (warnings.length > 0 && blockers.length === 0) {
      recommendations.push('Data is usable for the current stage, but review warnings before widening model scope.');
    }
    if (readiness === 'ready_for_neural_training') {
      recommendations.push('Dataset meets minimum neural-training gates. Proceed only with backtested paper-only neural experiments.');
    }

    return [...new Set(recommendations)];
  }

  private minCheck(name: string, actual: number, required: number, message: string): DataQualityCheck {
    if (actual >= required) return { name, status: 'pass', actual, required, message: `${name} passed.` };
    return { name, status: actual > 0 ? 'warn' : 'fail', actual, required, message };
  }

  private maxCheck(name: string, actual: number, required: number, message: string): DataQualityCheck {
    if (actual <= required) return { name, status: 'pass', actual, required, message: `${name} passed.` };
    return { name, status: 'warn', actual, required, message };
  }

  private zeroCheck(name: string, actual: number, message: string): DataQualityCheck {
    if (actual === 0) return { name, status: 'pass', actual, required: 0, message: `${name} passed.` };
    return { name, status: 'fail', actual, required: 0, message };
  }

  private async readJsonl<T>(path: string): Promise<ReadJsonlResult<T>> {
    if (!existsSync(path)) return { rows: [], malformedRows: 0 };
    const raw = await readFile(path, 'utf-8');
    const rows: T[] = [];
    let malformedRows = 0;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed) as T);
      } catch {
        malformedRows += 1;
      }
    }
    return { rows, malformedRows };
  }

  private async readJson<T>(path: string): Promise<T | null> {
    if (!existsSync(path)) return null;
    const raw = await readFile(path, 'utf-8');
    if (!raw.trim()) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private async appendJsonl(path: string, value: unknown): Promise<void> {
    const existing = existsSync(path) ? await readFile(path, 'utf-8') : '';
    const next = `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${JSON.stringify(value)}\n`;
    await writeFile(path, next, 'utf-8');
  }

  private async ensureStorage(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
  }

  private createId(prefix: string, iso: string): string {
    const safeTime = iso.replace(/[-:.]/g, '').toLowerCase();
    return `${prefix}_${safeTime}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private int(value: unknown, fallback: number, min: number, max: number): number {
    const numberValue = Number(value ?? fallback);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(min, Math.min(Math.trunc(numberValue), max));
  }

  private num(value: unknown, fallback: number, min: number, max: number): number {
    const numberValue = Number(value ?? fallback);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(min, Math.min(numberValue, max));
  }

  private nullableNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private isFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
  }

  private round(value: number, digits = 4): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }
}
