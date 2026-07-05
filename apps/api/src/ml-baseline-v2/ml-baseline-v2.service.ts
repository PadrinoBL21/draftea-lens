import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TrainingDatasetExportRun, TrainingDatasetRow } from '../training-dataset-export/training-dataset-export.types';
import { TrainMlBaselineV2Dto } from './dto/train-ml-baseline-v2.dto';
import {
  MlBaselineV2Decision,
  MlBaselineV2Filters,
  MlBaselineV2Metrics,
  MlBaselineV2Model,
  MlBaselineV2Prediction,
  MlBaselineV2Summary,
  MlBaselineV2TrainResult,
} from './ml-baseline-v2.types';

const ML_BASELINE_V2_VERSION = 'ml-baseline-v2-v0.1';
const TRAINING_DATASET_DIR = join(process.cwd(), 'data', 'training-dataset-export');
const LATEST_DATASET_EXPORT_JSON = join(TRAINING_DATASET_DIR, 'latest-export.json');
const DATA_DIR = join(process.cwd(), 'data', 'ml-baseline-v2');
const MODELS_JSONL = join(DATA_DIR, 'models.jsonl');
const LATEST_MODEL_JSON = join(DATA_DIR, 'latest-model.json');
const PREDICTIONS_JSONL = join(DATA_DIR, 'predictions.jsonl');

const FEATURE_NAMES = [
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
] as const;

type FeatureName = (typeof FEATURE_NAMES)[number];

type TrainingRow = {
  row: TrainingDatasetRow;
  label: number;
  weight: number;
  raw: Record<FeatureName, number>;
  normalized: Record<FeatureName, number>;
};

@Injectable()
export class MlBaselineV2Service {
  async train(dto: TrainMlBaselineV2Dto): Promise<MlBaselineV2TrainResult> {
    await this.ensureStorage();

    const filters = this.normalizeFilters(dto);
    const trainedAt = new Date().toISOString();
    const modelId = this.createId('ml_baseline_v2', trainedAt);
    const datasetExport = await this.latestDatasetExport();
    const datasetRows = await this.readLatestDatasetRows(datasetExport);
    const scopedRows = this.applyFilters(datasetRows, filters).slice(-filters.maxRows);
    const labeledRows = scopedRows.filter((row) => typeof row.labelWin === 'number' && row.labelWeight > 0);

    if (!datasetExport) {
      const model = this.emptyModel(modelId, trainedAt, filters, null, datasetRows, labeledRows, [
        'No Training Dataset Export found. Run /training-dataset/export first.',
        'Model was not trained. Predictions are marked as insufficient_data.',
      ]);
      await this.saveModelAndPredictions(model, []);
      return { model, predictions: [] };
    }

    if (labeledRows.length < filters.minTrainingRows) {
      const model = this.emptyModel(modelId, trainedAt, filters, datasetExport, scopedRows, labeledRows, [
        `Only ${labeledRows.length} training dataset row(s) available. Minimum required: ${filters.minTrainingRows}.`,
        'Model was not trained. Predictions are marked as insufficient_data.',
        'ML Baseline v2 reads only the formal Training Dataset Export, not raw feature rows.',
      ]);
      const predictions = this.predictRows(model, scopedRows, trainedAt).slice(0, 500);
      await this.saveModelAndPredictions(model, predictions);
      return { model, predictions };
    }

    const rawRows = labeledRows.map((row) => ({
      row,
      label: row.labelWin as number,
      weight: Math.max(0.0001, row.labelWeight),
      raw: this.extractFeatures(row),
    }));
    const means = this.featureMeans(rawRows.map((row) => row.raw));
    const stdDevs = this.featureStdDevs(rawRows.map((row) => row.raw), means);
    const normalizedRows: TrainingRow[] = rawRows.map((row) => ({
      ...row,
      normalized: this.normalizeFeatureValues(row.raw, means, stdDevs),
    }));

    const validationCount = Math.min(
      Math.floor(normalizedRows.length * filters.validationSplit),
      Math.max(0, normalizedRows.length - 1),
    );
    const splitAt = normalizedRows.length - validationCount;
    const trainRows = normalizedRows.slice(0, splitAt);
    const validationRows = validationCount > 0 ? normalizedRows.slice(splitAt) : normalizedRows;
    const fitted = this.fitLogisticRegression(trainRows, filters);
    const metrics = this.evaluate(validationRows, fitted.intercept, fitted.weights);

    const model: MlBaselineV2Model = {
      modelId,
      trainedAt,
      modelVersion: ML_BASELINE_V2_VERSION,
      status: 'trained',
      sourceDatasetExportId: datasetExport.exportId,
      sourceDatasetVersion: datasetExport.datasetVersion,
      sourceDatasetRows: scopedRows.length,
      sourceTrainingEligibleRows: labeledRows.length,
      filters,
      featureNames: [...FEATURE_NAMES],
      trainingRows: trainRows.length,
      validationRows: validationRows.length,
      positiveLabels: normalizedRows.filter((row) => row.label === 1).length,
      negativeLabels: normalizedRows.filter((row) => row.label === 0).length,
      weightedRows: this.round(normalizedRows.reduce((sum, row) => sum + row.weight, 0), 4),
      intercept: this.round(fitted.intercept, 6),
      weights: this.roundRecord(fitted.weights, 6),
      featureMeans: this.roundRecord(means, 6),
      featureStdDevs: this.roundRecord(stdDevs, 6),
      metrics,
      notes: [
        'ML Baseline v2 is trained from Training Dataset Export rows only.',
        'Predictions are challenger-only and paper-only. Real stake remains blocked at 0.',
      ],
      saved: this.savedPaths(),
    };

    const predictions = this.predictRows(model, scopedRows, trainedAt).slice(0, 500);
    await this.saveModelAndPredictions(model, predictions);
    return { model, predictions };
  }

  async latest(): Promise<MlBaselineV2Model | null> {
    await this.ensureStorage();
    if (!existsSync(LATEST_MODEL_JSON)) return null;
    return JSON.parse(await readFile(LATEST_MODEL_JSON, 'utf-8')) as MlBaselineV2Model;
  }

  async predictions(limit = 50): Promise<MlBaselineV2Prediction[]> {
    await this.ensureStorage();
    const safeLimit = Math.max(1, Math.min(limit, 1000));
    const predictions = await this.readJsonl<MlBaselineV2Prediction>(PREDICTIONS_JSONL);
    return predictions.slice(-safeLimit).reverse();
  }

  async summary(): Promise<MlBaselineV2Summary> {
    await this.ensureStorage();
    const models = await this.readJsonl<MlBaselineV2Model>(MODELS_JSONL);
    const predictions = await this.readJsonl<MlBaselineV2Prediction>(PREDICTIONS_JSONL);
    const latest = models[models.length - 1];

    return {
      modelVersion: ML_BASELINE_V2_VERSION,
      totalModels: models.length,
      latestModelId: latest?.modelId ?? null,
      latestTrainedAt: latest?.trainedAt ?? null,
      latestStatus: latest?.status ?? null,
      latestSourceDatasetExportId: latest?.sourceDatasetExportId ?? null,
      latestTrainingRows: latest?.trainingRows ?? null,
      latestValidationRows: latest?.validationRows ?? null,
      latestAccuracyPct: latest?.metrics.accuracyPct ?? null,
      totalPredictions: predictions.length,
      paperCandidates: predictions.filter((prediction) => prediction.decision === 'paper_candidate').length,
      watch: predictions.filter((prediction) => prediction.decision === 'watch').length,
      avoid: predictions.filter((prediction) => prediction.decision === 'avoid').length,
      insufficientDataPredictions: predictions.filter((prediction) => prediction.decision === 'insufficient_data').length,
    };
  }

  private normalizeFilters(dto: TrainMlBaselineV2Dto): MlBaselineV2Filters {
    return {
      source: dto.source ?? 'training_dataset',
      sportKey: dto.sportKey,
      marketType: dto.marketType,
      minExpectedValue: dto.minExpectedValue ?? -10,
      minTrainingRows: Math.max(1, Math.min(dto.minTrainingRows ?? 50, 100000)),
      maxRows: Math.max(1, Math.min(dto.maxRows ?? 50000, 1000000)),
      epochs: Math.max(10, Math.min(dto.epochs ?? 500, 10000)),
      learningRate: Math.max(0.0001, Math.min(dto.learningRate ?? 0.03, 1)),
      validationSplit: Math.max(0, Math.min(dto.validationSplit ?? 0.2, 0.5)),
    };
  }

  private applyFilters(rows: TrainingDatasetRow[], filters: MlBaselineV2Filters): TrainingDatasetRow[] {
    return rows.filter((row) => {
      if (filters.sportKey && row.metadata?.sportKey !== filters.sportKey) return false;
      if (filters.marketType && row.metadata?.marketType !== filters.marketType) return false;
      const expectedValue = row.metadata?.expectedValuePerUnit ?? row.features.expectedValuePerUnit ?? 0;
      if (expectedValue < filters.minExpectedValue) return false;
      return true;
    });
  }

  private emptyModel(
    modelId: string,
    trainedAt: string,
    filters: MlBaselineV2Filters,
    datasetExport: TrainingDatasetExportRun | null,
    scopedRows: TrainingDatasetRow[],
    labeledRows: TrainingDatasetRow[],
    notes: string[],
  ): MlBaselineV2Model {
    const zeroRecord = this.zeroRecord();
    return {
      modelId,
      trainedAt,
      modelVersion: ML_BASELINE_V2_VERSION,
      status: 'insufficient_data',
      sourceDatasetExportId: datasetExport?.exportId ?? null,
      sourceDatasetVersion: datasetExport?.datasetVersion ?? null,
      sourceDatasetRows: scopedRows.length,
      sourceTrainingEligibleRows: labeledRows.length,
      filters,
      featureNames: [...FEATURE_NAMES],
      trainingRows: 0,
      validationRows: 0,
      positiveLabels: labeledRows.filter((row) => row.labelWin === 1).length,
      negativeLabels: labeledRows.filter((row) => row.labelWin === 0).length,
      weightedRows: this.round(labeledRows.reduce((sum, row) => sum + Math.max(0, row.labelWeight), 0), 4),
      intercept: 0,
      weights: zeroRecord,
      featureMeans: zeroRecord,
      featureStdDevs: this.oneRecord(),
      metrics: {
        accuracyPct: null,
        logLoss: null,
        brierScore: null,
        averagePredictedWinProbability: null,
      },
      notes,
      saved: this.savedPaths(),
    };
  }

  private extractFeatures(row: TrainingDatasetRow): Record<FeatureName, number> {
    return {
      logBestOdds: this.safeNumber(row.features.logBestOdds),
      consensusProbability: this.safeNumber(row.features.consensusProbability),
      edgeVsConsensus: this.safeNumber(row.features.edgeVsConsensus),
      expectedValuePerUnit: this.safeNumber(row.features.expectedValuePerUnit),
      scannerScore: this.safeNumber(row.features.scannerScore),
      priceSpreadPct: this.safeNumber(row.features.priceSpreadPct),
      marketHoldPct: this.safeNumber(row.features.marketHoldPct),
      lineObservationCount: this.safeNumber(row.features.lineObservationCount),
      oddsChangePct: this.safeNumber(row.features.oddsChangePct),
      impliedProbabilityChange: this.safeNumber(row.features.impliedProbabilityChange),
      consensusProbabilityChange: this.safeNumber(row.features.consensusProbabilityChange),
      expectedValueChange: this.safeNumber(row.features.expectedValueChange),
      sourcePaperPick: this.safeNumber(row.features.sourcePaperPick),
      trendShortening: this.safeNumber(row.features.trendShortening),
      trendDrifting: this.safeNumber(row.features.trendDrifting),
      recommendationValueCandidate: this.safeNumber(row.features.recommendationValueCandidate),
    };
  }

  private fitLogisticRegression(rows: TrainingRow[], filters: MlBaselineV2Filters) {
    const weights = this.zeroRecord();
    let intercept = this.initialIntercept(rows);
    const l2 = 0.001;

    for (let epoch = 0; epoch < filters.epochs; epoch += 1) {
      let interceptGradient = 0;
      const gradients = this.zeroRecord();
      let weightTotal = 0;

      for (const row of rows) {
        const prediction = this.predictProbabilityFromNormalized(row.normalized, intercept, weights);
        const error = (prediction - row.label) * row.weight;
        weightTotal += row.weight;
        interceptGradient += error;
        for (const featureName of FEATURE_NAMES) {
          gradients[featureName] += error * row.normalized[featureName];
        }
      }

      const denominator = Math.max(0.0001, weightTotal);
      intercept -= filters.learningRate * (interceptGradient / denominator);
      for (const featureName of FEATURE_NAMES) {
        const regularizedGradient = gradients[featureName] / denominator + l2 * weights[featureName];
        weights[featureName] -= filters.learningRate * regularizedGradient;
      }
    }

    return { intercept, weights };
  }

  private evaluate(rows: TrainingRow[], intercept: number, weights: Record<FeatureName, number>): MlBaselineV2Metrics {
    if (!rows.length) {
      return {
        accuracyPct: null,
        logLoss: null,
        brierScore: null,
        averagePredictedWinProbability: null,
      };
    }

    let correct = 0;
    let logLoss = 0;
    let brier = 0;
    let probabilitySum = 0;
    let weightTotal = 0;

    for (const row of rows) {
      const prediction = this.clampProbability(this.predictProbabilityFromNormalized(row.normalized, intercept, weights));
      const predictedLabel = prediction >= 0.5 ? 1 : 0;
      if (predictedLabel === row.label) correct += row.weight;
      logLoss += -(row.label * Math.log(prediction) + (1 - row.label) * Math.log(1 - prediction)) * row.weight;
      brier += (prediction - row.label) ** 2 * row.weight;
      probabilitySum += prediction * row.weight;
      weightTotal += row.weight;
    }

    const denominator = Math.max(0.0001, weightTotal);
    return {
      accuracyPct: this.round((correct / denominator) * 100, 2),
      logLoss: this.round(logLoss / denominator, 6),
      brierScore: this.round(brier / denominator, 6),
      averagePredictedWinProbability: this.round(probabilitySum / denominator, 4),
    };
  }

  private predictRows(model: MlBaselineV2Model, rows: TrainingDatasetRow[], generatedAt: string): MlBaselineV2Prediction[] {
    return rows.map((row) => this.predictRow(model, row, generatedAt));
  }

  private predictRow(model: MlBaselineV2Model, row: TrainingDatasetRow, generatedAt: string): MlBaselineV2Prediction {
    const raw = this.extractFeatures(row);
    const normalized = this.normalizeFeatureValues(raw, model.featureMeans as Record<FeatureName, number>, model.featureStdDevs as Record<FeatureName, number>);
    const bestOddsDecimal = row.metadata?.bestOddsDecimal ?? Math.exp(raw.logBestOdds);
    const breakEvenProbability = bestOddsDecimal > 0 ? 1 / bestOddsDecimal : 0;
    const predictedWinProbability =
      model.status === 'trained'
        ? this.round(this.predictProbabilityFromNormalized(normalized, model.intercept, model.weights as Record<FeatureName, number>), 4)
        : null;
    const predictedEdge = predictedWinProbability === null ? null : this.round(predictedWinProbability - breakEvenProbability, 4);
    const predictedExpectedValuePerUnit =
      predictedWinProbability === null ? null : this.round(predictedWinProbability * bestOddsDecimal - 1, 4);
    const decision = this.decision(model.status, predictedWinProbability, predictedExpectedValuePerUnit, row);

    return {
      predictionId: this.createId('ml_v2_prediction', `${generatedAt}_${row.datasetRowId}`),
      generatedAt,
      modelVersion: model.modelVersion,
      modelId: model.modelId,
      modelStatus: model.status,
      sourceDatasetExportId: model.sourceDatasetExportId,
      datasetRowId: row.datasetRowId,
      labelWin: row.labelWin,
      labelWeight: row.labelWeight,
      labelKnown: typeof row.labelWin === 'number',
      source: row.metadata?.source ?? 'training_dataset',
      sourceId: row.metadata?.sourceId ?? null,
      eventId: row.metadata?.eventId ?? null,
      eventName: row.metadata?.eventName ?? null,
      commenceTime: row.metadata?.commenceTime ?? null,
      sportKey: row.metadata?.sportKey ?? null,
      marketKey: row.metadata?.marketKey ?? null,
      marketType: row.metadata?.marketType ?? null,
      selection: row.metadata?.selection ?? null,
      point: row.metadata?.point,
      bestOddsDecimal: this.round(bestOddsDecimal, 4),
      scannerRecommendation: raw.recommendationValueCandidate === 1 ? 'value_candidate' : 'dataset_row',
      expectedValuePerUnit: row.metadata?.expectedValuePerUnit ?? raw.expectedValuePerUnit,
      scannerScore: row.metadata?.scannerScore ?? raw.scannerScore,
      trend: row.metadata?.trend ?? (raw.trendShortening ? 'shortening' : raw.trendDrifting ? 'drifting' : 'flat'),
      predictedWinProbability,
      breakEvenProbability: this.round(breakEvenProbability, 4),
      predictedEdge,
      predictedExpectedValuePerUnit,
      decision,
      realStakeSuggested: 0,
      reasons: this.predictionReasons(model.status, decision, predictedWinProbability, predictedExpectedValuePerUnit, row),
      featureSnapshot: {
        expectedValuePerUnit: row.metadata?.expectedValuePerUnit ?? raw.expectedValuePerUnit,
        scannerScore: row.metadata?.scannerScore ?? raw.scannerScore,
        priceSpreadPct: raw.priceSpreadPct,
        marketHoldPct: raw.marketHoldPct,
        lineObservationCount: raw.lineObservationCount,
        oddsChangePct: raw.oddsChangePct,
        labelWeight: row.labelWeight,
        labelKnown: String(typeof row.labelWin === 'number'),
        settlementResult: row.metadata?.settlementResult ?? null,
      },
    };
  }

  private decision(
    status: MlBaselineV2Model['status'],
    predictedWinProbability: number | null,
    predictedExpectedValuePerUnit: number | null,
    row: TrainingDatasetRow,
  ): MlBaselineV2Decision {
    if (status !== 'trained' || predictedWinProbability === null || predictedExpectedValuePerUnit === null) {
      return 'insufficient_data';
    }
    const scannerEv = row.metadata?.expectedValuePerUnit ?? row.features.expectedValuePerUnit ?? 0;
    if (predictedWinProbability >= 0.58 && predictedExpectedValuePerUnit > 0.02 && scannerEv > 0) {
      return 'paper_candidate';
    }
    if (predictedWinProbability >= 0.52 || predictedExpectedValuePerUnit > 0) {
      return 'watch';
    }
    return 'avoid';
  }

  private predictionReasons(
    status: MlBaselineV2Model['status'],
    decision: MlBaselineV2Decision,
    predictedWinProbability: number | null,
    predictedExpectedValuePerUnit: number | null,
    row: TrainingDatasetRow,
  ): string[] {
    if (status !== 'trained') {
      return [
        'Not enough labeled Training Dataset Export rows to train ML Baseline v2 yet.',
        'Prediction saved for pipeline validation only.',
      ];
    }

    const reasons = [
      `Predicted win probability: ${((predictedWinProbability ?? 0) * 100).toFixed(2)}%.`,
      `Predicted EV per unit: ${((predictedExpectedValuePerUnit ?? 0) * 100).toFixed(2)}%.`,
      `Scanner EV per unit: ${((row.metadata?.expectedValuePerUnit ?? row.features.expectedValuePerUnit ?? 0) * 100).toFixed(2)}%.`,
      `Label weight used by training pipeline: ${row.labelWeight}.`,
    ];

    if (decision === 'paper_candidate') reasons.push('Eligible only for paper learning, not real staking.');
    if (decision === 'watch') reasons.push('Model sees a signal, but not enough for paper candidate threshold.');
    if (decision === 'avoid') reasons.push('Model does not see enough signal.');
    return reasons;
  }

  private predictProbabilityFromNormalized(
    normalized: Record<FeatureName, number>,
    intercept: number,
    weights: Record<FeatureName, number>,
  ): number {
    let z = intercept;
    for (const featureName of FEATURE_NAMES) {
      z += weights[featureName] * normalized[featureName];
    }
    return this.sigmoid(z);
  }

  private initialIntercept(rows: TrainingRow[]): number {
    const weightTotal = rows.reduce((sum, row) => sum + row.weight, 0);
    const positiveWeight = rows.filter((row) => row.label === 1).reduce((sum, row) => sum + row.weight, 0);
    const positiveRate = positiveWeight / Math.max(0.0001, weightTotal);
    const clamped = Math.max(0.01, Math.min(0.99, positiveRate));
    return Math.log(clamped / (1 - clamped));
  }

  private featureMeans(records: Record<FeatureName, number>[]): Record<FeatureName, number> {
    const means = this.zeroRecord();
    for (const record of records) {
      for (const featureName of FEATURE_NAMES) {
        means[featureName] += record[featureName];
      }
    }
    for (const featureName of FEATURE_NAMES) {
      means[featureName] = means[featureName] / Math.max(1, records.length);
    }
    return means;
  }

  private featureStdDevs(records: Record<FeatureName, number>[], means: Record<FeatureName, number>): Record<FeatureName, number> {
    const variances = this.zeroRecord();
    for (const record of records) {
      for (const featureName of FEATURE_NAMES) {
        variances[featureName] += (record[featureName] - means[featureName]) ** 2;
      }
    }

    const stdDevs = this.oneRecord();
    for (const featureName of FEATURE_NAMES) {
      const variance = variances[featureName] / Math.max(1, records.length);
      stdDevs[featureName] = Math.sqrt(variance) || 1;
    }
    return stdDevs;
  }

  private normalizeFeatureValues(
    record: Record<FeatureName, number>,
    means: Record<FeatureName, number>,
    stdDevs: Record<FeatureName, number>,
  ): Record<FeatureName, number> {
    const normalized = this.zeroRecord();
    for (const featureName of FEATURE_NAMES) {
      normalized[featureName] = (record[featureName] - (means[featureName] ?? 0)) / (stdDevs[featureName] || 1);
    }
    return normalized;
  }

  private async latestDatasetExport(): Promise<TrainingDatasetExportRun | null> {
    if (!existsSync(LATEST_DATASET_EXPORT_JSON)) return null;
    const raw = await readFile(LATEST_DATASET_EXPORT_JSON, 'utf-8');
    return raw.trim() ? (JSON.parse(raw) as TrainingDatasetExportRun) : null;
  }

  private async readLatestDatasetRows(datasetExport: TrainingDatasetExportRun | null): Promise<TrainingDatasetRow[]> {
    if (!datasetExport?.saved?.jsonlPath) return [];
    const path = this.absoluteFromRelative(datasetExport.saved.jsonlPath);
    return this.readJsonl<TrainingDatasetRow>(path);
  }

  private async saveModelAndPredictions(model: MlBaselineV2Model, predictions: MlBaselineV2Prediction[]): Promise<void> {
    await appendFile(MODELS_JSONL, `${JSON.stringify(model)}\n`, 'utf-8');
    await writeFile(LATEST_MODEL_JSON, `${JSON.stringify(model, null, 2)}\n`, 'utf-8');
    await writeFile(PREDICTIONS_JSONL, predictions.map((item) => JSON.stringify(item)).join('\n') + (predictions.length ? '\n' : ''), 'utf-8');
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

  private async ensureStorage(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    if (!existsSync(MODELS_JSONL)) await writeFile(MODELS_JSONL, '', 'utf-8');
    if (!existsSync(PREDICTIONS_JSONL)) await writeFile(PREDICTIONS_JSONL, '', 'utf-8');
  }

  private absoluteFromRelative(path: string): string {
    return path.startsWith('.') ? join(process.cwd(), path.replace(/^\.\//, '')) : path;
  }

  private savedPaths() {
    return {
      modelsPath: this.relativePath(MODELS_JSONL),
      latestModelPath: this.relativePath(LATEST_MODEL_JSON),
      predictionsPath: this.relativePath(PREDICTIONS_JSONL),
    };
  }

  private relativePath(path: string): string {
    return path.replace(process.cwd(), '.').replace(/\\/g, '/');
  }

  private zeroRecord(): Record<FeatureName, number> {
    return Object.fromEntries(FEATURE_NAMES.map((featureName) => [featureName, 0])) as Record<FeatureName, number>;
  }

  private oneRecord(): Record<FeatureName, number> {
    return Object.fromEntries(FEATURE_NAMES.map((featureName) => [featureName, 1])) as Record<FeatureName, number>;
  }

  private roundRecord(record: Record<string, number>, decimals: number): Record<string, number> {
    return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, this.round(value, decimals)]));
  }

  private sigmoid(value: number): number {
    if (value >= 40) return 1;
    if (value <= -40) return 0;
    return 1 / (1 + Math.exp(-value));
  }

  private clampProbability(value: number): number {
    return Math.max(0.000001, Math.min(0.999999, value));
  }

  private safeNumber(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private round(value: number, decimals = 4): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  private createId(prefix: string, seed: string): string {
    const compact = seed.replace(/[^0-9A-Za-z]/g, '').slice(0, 24);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${compact}_${random}`.toLowerCase();
  }
}
