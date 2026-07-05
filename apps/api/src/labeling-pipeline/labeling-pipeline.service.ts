import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FeatureVector } from '../feature-store/feature-store.types';
import { RebuildLabelsDto } from './dto/rebuild-labels.dto';
import {
  LabeledTrainingRow,
  LabelFeatures,
  LabelingFilters,
  LabelingRebuildResult,
  LabelingSummary,
  LabelSettlementResult,
} from './labeling-pipeline.types';

const LABELING_VERSION = 'labeling-pipeline-v0.1';
const FEATURE_STORE_DIR = join(process.cwd(), 'data', 'feature-store');
const FEATURES_JSONL = join(FEATURE_STORE_DIR, 'features.jsonl');
const DATA_DIR = join(process.cwd(), 'data', 'labeling-pipeline');
const LABELS_JSONL = join(DATA_DIR, 'labels.jsonl');
const LATEST_REBUILD_JSON = join(DATA_DIR, 'latest-rebuild.json');

@Injectable()
export class LabelingPipelineService {
  async rebuild(dto: RebuildLabelsDto): Promise<LabelingRebuildResult> {
    await this.ensureStorage();

    const filters = this.normalizeFilters(dto);
    const createdAt = new Date().toISOString();
    const rebuildId = this.createId('label_rebuild', createdAt);
    const featureRows = await this.readJsonl<FeatureVector>(FEATURES_JSONL);
    const scopedRows = this.applyFeatureScope(featureRows, filters).slice(-filters.maxRows);
    const outcomeKnownRows = scopedRows.filter((row) => row.outcomeKnown || Boolean(row.settlementResult));

    let labels = outcomeKnownRows.map((row) => this.toLabel(row, createdAt));

    if (!filters.includePushVoid) {
      labels = labels.filter((label) => label.trainingEligible || !['push', 'void'].includes(label.settlementResult ?? ''));
    }

    if (filters.eligibleOnly) {
      labels = labels.filter((label) => label.trainingEligible);
    }

    const summary = this.summarize(labels, scopedRows.length, outcomeKnownRows.length, rebuildId, createdAt);
    const result: LabelingRebuildResult = {
      rebuildId,
      createdAt,
      labelingVersion: LABELING_VERSION,
      filters,
      sourceFeatureRows: scopedRows.length,
      outcomeKnownRows: outcomeKnownRows.length,
      labelsBuilt: labels.length,
      trainingEligibleLabels: labels.filter((label) => label.trainingEligible).length,
      positiveLabels: labels.filter((label) => label.labelWin === 1 && label.trainingEligible).length,
      negativeLabels: labels.filter((label) => label.labelWin === 0 && label.trainingEligible).length,
      skippedRows: scopedRows.length - labels.length,
      sample: labels.slice(0, 10),
      summary,
    };

    if (dto.persist ?? true) {
      await writeFile(LABELS_JSONL, labels.map((label) => JSON.stringify(label)).join('\n') + (labels.length ? '\n' : ''), 'utf-8');
      const persisted: LabelingRebuildResult = {
        ...result,
        saved: {
          labelsPath: this.relativePath(LABELS_JSONL),
          latestRebuildPath: this.relativePath(LATEST_REBUILD_JSON),
        },
      };
      await writeFile(LATEST_REBUILD_JSON, `${JSON.stringify(persisted, null, 2)}\n`, 'utf-8');
      return persisted;
    }

    return result;
  }

  async listLabels(options: { limit?: number; eligibleOnly?: boolean }): Promise<{ value: LabeledTrainingRow[]; count: number }> {
    await this.ensureStorage();
    const limit = Math.max(1, Math.min(options.limit ?? 50, 1000));
    const labels = await this.readJsonl<LabeledTrainingRow>(LABELS_JSONL);
    const filtered = labels.filter((label) => (options.eligibleOnly ? label.trainingEligible : true));
    return { value: filtered.slice(-limit).reverse(), count: filtered.length };
  }

  async dataset(options: { limit?: number }): Promise<{ value: LabeledTrainingRow[]; count: number }> {
    await this.ensureStorage();
    const limit = Math.max(1, Math.min(options.limit ?? 500, 10000));
    const labels = await this.readJsonl<LabeledTrainingRow>(LABELS_JSONL);
    const eligible = labels.filter((label) => label.trainingEligible);
    return { value: eligible.slice(-limit).reverse(), count: eligible.length };
  }

  async summary(): Promise<LabelingSummary> {
    await this.ensureStorage();
    if (existsSync(LATEST_REBUILD_JSON)) {
      const raw = await readFile(LATEST_REBUILD_JSON, 'utf-8');
      if (raw.trim()) {
        const latest = JSON.parse(raw) as LabelingRebuildResult;
        return latest.summary;
      }
    }

    const labels = await this.readJsonl<LabeledTrainingRow>(LABELS_JSONL);
    return this.summarize(labels, labels.length, labels.length, null, null);
  }

  private normalizeFilters(dto: RebuildLabelsDto): LabelingFilters {
    return {
      source: dto.source ?? 'paper_pick',
      includePushVoid: dto.includePushVoid ?? true,
      eligibleOnly: dto.eligibleOnly ?? false,
      minExpectedValue: dto.minExpectedValue ?? Number.NEGATIVE_INFINITY,
      maxRows: Math.max(1, Math.min(dto.maxRows ?? 50000, 100000)),
    };
  }

  private applyFeatureScope(rows: FeatureVector[], filters: LabelingFilters): FeatureVector[] {
    return rows.filter((row) => {
      if (filters.source !== 'all' && row.source !== filters.source) return false;
      if (row.expectedValuePerUnit < filters.minExpectedValue) return false;
      return true;
    });
  }

  private toLabel(row: FeatureVector, createdAt: string): LabeledTrainingRow {
    const settlementResult = this.normalizeSettlement(row.settlementResult);
    const eligibility = this.labelEligibility(settlementResult);

    return {
      labelId: `label__${this.slug(row.featureVectorId)}`,
      createdAt,
      labelingVersion: LABELING_VERSION,
      featureVectorId: row.featureVectorId,
      featureStoreVersion: row.featureStoreVersion,
      source: row.source,
      sourceId: row.sourceId,
      eventId: row.eventId,
      eventName: row.eventName,
      commenceTime: row.commenceTime,
      sportKey: row.sportKey,
      marketKey: row.marketKey,
      marketType: row.marketType,
      selection: row.selection,
      point: row.point,
      settlementResult,
      outcomeClass: eligibility.outcomeClass,
      trainingEligible: eligibility.trainingEligible,
      exclusionReason: eligibility.exclusionReason,
      labelWin: eligibility.labelWin,
      labelWeight: eligibility.labelWeight,
      labelProfitLoss: typeof row.labelProfitLoss === 'number' ? row.labelProfitLoss : null,
      labelClosingLineValue: typeof row.labelClosingLineValue === 'number' ? row.labelClosingLineValue : null,
      bestOddsDecimal: row.bestOddsDecimal,
      breakEvenProbability: this.round(row.bestOddsDecimal > 0 ? 1 / row.bestOddsDecimal : 0, 4),
      expectedValuePerUnit: row.expectedValuePerUnit,
      scannerScore: row.scannerScore,
      trend: row.trend,
      features: this.toFeatures(row),
    };
  }

  private normalizeSettlement(result: string | undefined): LabelSettlementResult | null {
    if (!result) return null;
    if (['win', 'loss', 'push', 'void', 'half_win', 'half_loss'].includes(result)) {
      return result as LabelSettlementResult;
    }
    return null;
  }

  private labelEligibility(result: LabelSettlementResult | null): {
    outcomeClass: 'positive' | 'negative' | 'neutral' | 'excluded';
    trainingEligible: boolean;
    exclusionReason: string | null;
    labelWin: number | null;
    labelWeight: number;
  } {
    if (result === 'win') {
      return { outcomeClass: 'positive', trainingEligible: true, exclusionReason: null, labelWin: 1, labelWeight: 1 };
    }
    if (result === 'half_win') {
      return { outcomeClass: 'positive', trainingEligible: true, exclusionReason: null, labelWin: 1, labelWeight: 0.5 };
    }
    if (result === 'loss') {
      return { outcomeClass: 'negative', trainingEligible: true, exclusionReason: null, labelWin: 0, labelWeight: 1 };
    }
    if (result === 'half_loss') {
      return { outcomeClass: 'negative', trainingEligible: true, exclusionReason: null, labelWin: 0, labelWeight: 0.5 };
    }
    if (result === 'push') {
      return { outcomeClass: 'neutral', trainingEligible: false, exclusionReason: 'push_not_trainable', labelWin: null, labelWeight: 0 };
    }
    if (result === 'void') {
      return { outcomeClass: 'excluded', trainingEligible: false, exclusionReason: 'void_not_trainable', labelWin: null, labelWeight: 0 };
    }
    return { outcomeClass: 'excluded', trainingEligible: false, exclusionReason: 'missing_or_unknown_settlement', labelWin: null, labelWeight: 0 };
  }

  private toFeatures(row: FeatureVector): LabelFeatures {
    return {
      logBestOdds: this.round(Math.log(Math.max(1.01, row.bestOddsDecimal)), 6),
      consensusProbability: this.safeNumber(row.consensusProbability),
      edgeVsConsensus: this.safeNumber(row.edgeVsConsensus),
      expectedValuePerUnit: this.safeNumber(row.expectedValuePerUnit),
      scannerScore: this.safeNumber(row.scannerScore),
      priceSpreadPct: this.safeNumber(row.priceSpreadPct),
      marketHoldPct: this.safeNumber(row.marketHoldPct),
      lineObservationCount: this.safeNumber(row.lineObservationCount),
      oddsChangePct: this.safeNumber(row.oddsChangePct),
      impliedProbabilityChange: this.safeNumber(row.impliedProbabilityChange),
      consensusProbabilityChange: this.safeNumber(row.consensusProbabilityChange),
      expectedValueChange: this.safeNumber(row.expectedValueChange),
      sourcePaperPick: row.source === 'paper_pick' ? 1 : 0,
      trendShortening: row.trend === 'shortening' ? 1 : 0,
      trendDrifting: row.trend === 'drifting' ? 1 : 0,
      recommendationValueCandidate: row.scannerRecommendation === 'value_candidate' ? 1 : 0,
    };
  }

  private summarize(
    labels: LabeledTrainingRow[],
    totalFeatureRowsScanned: number,
    outcomeKnownRows: number,
    latestRebuildId: string | null,
    latestCreatedAt: string | null,
  ): LabelingSummary {
    const sports = new Set(labels.map((label) => label.sportKey));
    const marketTypes = new Set(labels.map((label) => label.marketType));
    const bySettlementResult = labels.reduce<Record<string, number>>((acc, label) => {
      const key = label.settlementResult ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      labelingVersion: LABELING_VERSION,
      latestRebuildId,
      latestCreatedAt,
      totalLabels: labels.length,
      trainingEligibleLabels: labels.filter((label) => label.trainingEligible).length,
      positiveLabels: labels.filter((label) => label.labelWin === 1 && label.trainingEligible).length,
      negativeLabels: labels.filter((label) => label.labelWin === 0 && label.trainingEligible).length,
      neutralLabels: labels.filter((label) => label.outcomeClass === 'neutral').length,
      excludedLabels: labels.filter((label) => label.outcomeClass === 'excluded').length,
      halfWeightLabels: labels.filter((label) => label.labelWeight === 0.5).length,
      totalFeatureRowsScanned,
      outcomeKnownRows,
      uniqueSports: sports.size,
      uniqueMarketTypes: marketTypes.size,
      bySettlementResult,
    };
  }

  private async ensureStorage(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    if (!existsSync(LABELS_JSONL)) {
      await writeFile(LABELS_JSONL, '', 'utf-8');
    }
  }

  private async readJsonl<T>(path: string): Promise<T[]> {
    if (!existsSync(path)) return [];
    const raw = await readFile(path, 'utf-8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }

  private createId(prefix: string, isoDate: string): string {
    const stamp = isoDate.replace(/[-:.TZ]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${stamp}_${random}`;
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private safeNumber(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private relativePath(path: string): string {
    return path.replace(process.cwd(), '.').replace(/\\/g, '/');
  }

  private round(value: number, decimals = 4): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
