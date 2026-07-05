import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ExportTrainingDatasetDto } from './dto/export-training-dataset.dto';
import {
  LabeledTrainingRowInput,
  TrainingDatasetExportFilters,
  TrainingDatasetExportRun,
  TrainingDatasetExportSummary,
  TrainingDatasetRowsResponse,
  TrainingDatasetRow,
} from './training-dataset-export.types';

const DATASET_VERSION = 'training-dataset-export-v0.1';
const LABELING_DIR = join(process.cwd(), 'data', 'labeling-pipeline');
const LABELS_JSONL = join(LABELING_DIR, 'labels.jsonl');
const DATA_DIR = join(process.cwd(), 'data', 'training-dataset-export');
const EXPORTS_JSONL = join(DATA_DIR, 'exports.jsonl');
const LATEST_EXPORT_JSON = join(DATA_DIR, 'latest-export.json');

@Injectable()
export class TrainingDatasetExportService {
  async exportDataset(dto: ExportTrainingDatasetDto): Promise<TrainingDatasetExportRun> {
    await this.ensureStorage();

    const filters = this.normalizeFilters(dto);
    const exportedAt = new Date().toISOString();
    const exportId = this.createId('training_dataset_export', exportedAt);
    const labels = await this.readJsonl<LabeledTrainingRowInput>(LABELS_JSONL);
    const scopedLabels = this.applyFilters(labels, filters).slice(-filters.maxRows);
    const rows = scopedLabels.map((label) => this.toDatasetRow(label, exportId, exportedAt, filters.includeMetadata));
    const run = this.toExportRun(exportId, exportedAt, filters, labels.length, rows);

    if (dto.persist ?? true) {
      const saved: NonNullable<TrainingDatasetExportRun['saved']> = {
        exportsPath: this.relativePath(EXPORTS_JSONL),
        latestExportPath: this.relativePath(LATEST_EXPORT_JSON),
      };

      if (filters.format === 'jsonl' || filters.format === 'both') {
        const jsonlPath = join(DATA_DIR, `${exportId}.jsonl`);
        await writeFile(jsonlPath, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), 'utf-8');
        saved.jsonlPath = this.relativePath(jsonlPath);
      }

      if (filters.format === 'csv' || filters.format === 'both') {
        const csvPath = join(DATA_DIR, `${exportId}.csv`);
        await writeFile(csvPath, this.toCsv(rows), 'utf-8');
        saved.csvPath = this.relativePath(csvPath);
      }

      const persisted: TrainingDatasetExportRun = { ...run, saved };
      await appendFile(EXPORTS_JSONL, `${JSON.stringify(persisted)}\n`, 'utf-8');
      await writeFile(LATEST_EXPORT_JSON, `${JSON.stringify(persisted, null, 2)}\n`, 'utf-8');
      return persisted;
    }

    return run;
  }

  async listExports(limit = 25): Promise<{ value: TrainingDatasetExportRun[]; count: number }> {
    await this.ensureStorage();
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const exports = await this.readJsonl<TrainingDatasetExportRun>(EXPORTS_JSONL);
    return { value: exports.slice(-safeLimit).reverse(), count: exports.length };
  }

  async latest(): Promise<TrainingDatasetExportRun | null> {
    await this.ensureStorage();
    if (!existsSync(LATEST_EXPORT_JSON)) return null;
    const raw = await readFile(LATEST_EXPORT_JSON, 'utf-8');
    return raw.trim() ? (JSON.parse(raw) as TrainingDatasetExportRun) : null;
  }

  async dataset(limit = 500): Promise<TrainingDatasetRowsResponse> {
    await this.ensureStorage();
    const safeLimit = Math.max(1, Math.min(limit, 10000));
    const latest = await this.latest();
    if (!latest?.saved?.jsonlPath) {
      return { value: [], count: 0, sourceExportId: latest?.exportId ?? null };
    }

    const jsonlPath = this.absoluteFromRelative(latest.saved.jsonlPath);
    const rows = await this.readJsonl<TrainingDatasetRow>(jsonlPath);
    return { value: rows.slice(-safeLimit).reverse(), count: rows.length, sourceExportId: latest.exportId };
  }

  async summary(): Promise<TrainingDatasetExportSummary> {
    await this.ensureStorage();
    const exports = await this.readJsonl<TrainingDatasetExportRun>(EXPORTS_JSONL);
    const latest = exports[exports.length - 1];

    return {
      datasetVersion: DATASET_VERSION,
      latestExportId: latest?.exportId ?? null,
      latestExportedAt: latest?.exportedAt ?? null,
      totalExports: exports.length,
      latestRowsExported: latest?.rowsExported ?? 0,
      latestTrainingEligibleRows: latest?.trainingEligibleRows ?? 0,
      latestPositiveLabels: latest?.positiveLabels ?? 0,
      latestNegativeLabels: latest?.negativeLabels ?? 0,
      latestExcludedRows: latest?.excludedRows ?? 0,
      latestNeutralRows: latest?.neutralRows ?? 0,
      latestUniqueSports: latest?.uniqueSports ?? 0,
      latestUniqueMarketTypes: latest?.uniqueMarketTypes ?? 0,
      latestFormat: latest?.filters.format ?? null,
      latestReadyForTraining: latest?.readyForTraining ?? false,
    };
  }

  private normalizeFilters(dto: ExportTrainingDatasetDto): TrainingDatasetExportFilters {
    return {
      format: dto.format ?? 'both',
      eligibleOnly: dto.eligibleOnly ?? true,
      includeMetadata: dto.includeMetadata ?? true,
      sportKey: dto.sportKey,
      marketType: dto.marketType,
      minExpectedValue: dto.minExpectedValue ?? Number.NEGATIVE_INFINITY,
      maxRows: Math.max(1, Math.min(dto.maxRows ?? 50000, 1000000)),
    };
  }

  private applyFilters(labels: LabeledTrainingRowInput[], filters: TrainingDatasetExportFilters): LabeledTrainingRowInput[] {
    return labels.filter((label) => {
      if (filters.eligibleOnly && !label.trainingEligible) return false;
      if (filters.eligibleOnly && typeof label.labelWin !== 'number') return false;
      if (filters.sportKey && label.sportKey !== filters.sportKey) return false;
      if (filters.marketType && label.marketType !== filters.marketType) return false;
      if (label.expectedValuePerUnit < filters.minExpectedValue) return false;
      return true;
    });
  }

  private toDatasetRow(
    label: LabeledTrainingRowInput,
    exportId: string,
    exportedAt: string,
    includeMetadata: boolean,
  ): TrainingDatasetRow {
    const row: TrainingDatasetRow = {
      datasetRowId: `dataset_row__${this.slug(exportId)}__${this.slug(label.labelId)}`,
      exportedAt,
      datasetVersion: DATASET_VERSION,
      labelWin: label.labelWin,
      labelWeight: label.labelWeight,
      features: label.features,
    };

    if (includeMetadata) {
      row.metadata = {
        labelId: label.labelId,
        featureVectorId: label.featureVectorId,
        source: label.source,
        sourceId: label.sourceId,
        eventId: label.eventId,
        eventName: label.eventName,
        commenceTime: label.commenceTime,
        sportKey: label.sportKey,
        marketKey: label.marketKey,
        marketType: label.marketType,
        selection: label.selection,
        point: label.point,
        settlementResult: label.settlementResult,
        outcomeClass: label.outcomeClass,
        exclusionReason: label.exclusionReason,
        bestOddsDecimal: label.bestOddsDecimal,
        breakEvenProbability: label.breakEvenProbability,
        expectedValuePerUnit: label.expectedValuePerUnit,
        scannerScore: label.scannerScore,
        trend: label.trend,
        labelProfitLoss: label.labelProfitLoss,
        labelClosingLineValue: label.labelClosingLineValue,
      };
    }

    return row;
  }

  private toExportRun(
    exportId: string,
    exportedAt: string,
    filters: TrainingDatasetExportFilters,
    sourceLabels: number,
    rows: TrainingDatasetRow[],
  ): TrainingDatasetExportRun {
    const eligibleRows = rows.filter((row) => typeof row.labelWin === 'number' && row.labelWeight > 0);
    const sports = new Set(rows.map((row) => row.metadata?.sportKey).filter(Boolean));
    const marketTypes = new Set(rows.map((row) => row.metadata?.marketType).filter(Boolean));

    return {
      exportId,
      exportedAt,
      datasetVersion: DATASET_VERSION,
      filters,
      sourceLabels,
      rowsExported: rows.length,
      trainingEligibleRows: eligibleRows.length,
      positiveLabels: eligibleRows.filter((row) => row.labelWin === 1).length,
      negativeLabels: eligibleRows.filter((row) => row.labelWin === 0).length,
      neutralRows: rows.filter((row) => row.metadata?.outcomeClass === 'neutral').length,
      excludedRows: rows.filter((row) => row.metadata?.outcomeClass === 'excluded').length,
      uniqueSports: sports.size,
      uniqueMarketTypes: marketTypes.size,
      readyForTraining: eligibleRows.length >= 100 && eligibleRows.some((row) => row.labelWin === 1) && eligibleRows.some((row) => row.labelWin === 0),
      sample: rows.slice(0, 10),
    };
  }

  private toCsv(rows: TrainingDatasetRow[]): string {
    const featureColumns = [
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
    const metadataColumns = [
      'labelId',
      'featureVectorId',
      'sourceId',
      'eventId',
      'eventName',
      'commenceTime',
      'sportKey',
      'marketKey',
      'marketType',
      'selection',
      'settlementResult',
      'outcomeClass',
      'exclusionReason',
      'bestOddsDecimal',
      'breakEvenProbability',
      'labelProfitLoss',
      'labelClosingLineValue',
    ];
    const columns = ['datasetRowId', 'labelWin', 'labelWeight', ...featureColumns, ...metadataColumns];
    const lines = [columns.join(',')];

    for (const row of rows) {
      const values = columns.map((column) => {
        if (column === 'datasetRowId') return row.datasetRowId;
        if (column === 'labelWin') return row.labelWin;
        if (column === 'labelWeight') return row.labelWeight;
        if (column in row.features) return row.features[column as keyof typeof row.features];
        return row.metadata?.[column as keyof typeof row.metadata] ?? '';
      });
      lines.push(values.map((value) => this.csvCell(value)).join(','));
    }

    return `${lines.join('\n')}\n`;
  }

  private async ensureStorage(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    if (!existsSync(EXPORTS_JSONL)) {
      await writeFile(EXPORTS_JSONL, '', 'utf-8');
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

  private absoluteFromRelative(path: string): string {
    return path.startsWith('.') ? join(process.cwd(), path.replace(/^\.\//, '')) : path;
  }

  private createId(prefix: string, isoDate: string): string {
    const stamp = isoDate.replace(/[-:.TZ]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${stamp}_${random}`;
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private relativePath(path: string): string {
    return path.replace(process.cwd(), '.').replace(/\\/g, '/');
  }

  private csvCell(value: unknown): string {
    if (value === null || typeof value === 'undefined') return '';
    const raw = String(value);
    if (/[",\n\r]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  }
}
