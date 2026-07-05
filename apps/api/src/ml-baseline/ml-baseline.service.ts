import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FeatureVector } from '../feature-store/feature-store.types';
import { MlBaselineSource, TrainMlBaselineDto } from './dto/train-ml-baseline.dto';
import {
  MlBaselineDecision,
  MlBaselineFilters,
  MlBaselineMetrics,
  MlBaselineModel,
  MlBaselinePrediction,
  MlBaselineSummary,
  MlBaselineTrainResult,
} from './ml-baseline.types';

const ML_BASELINE_VERSION = 'ml-baseline-v0.1';
const FEATURE_STORE_DIR = join(process.cwd(), 'data', 'feature-store');
const FEATURES_JSONL = join(FEATURE_STORE_DIR, 'features.jsonl');
const DATA_DIR = join(process.cwd(), 'data', 'ml-baseline');
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
  vector: FeatureVector;
  label: number;
  raw: Record<FeatureName, number>;
  normalized: Record<FeatureName, number>;
};

@Injectable()
export class MlBaselineService {
  async train(dto: TrainMlBaselineDto): Promise<MlBaselineTrainResult> {
    await this.ensureStorage();

    const filters = this.normalizeFilters(dto);
    const allVectors = await this.readJsonl<FeatureVector>(FEATURES_JSONL);
    const scopedVectors = this.applyFilters(allVectors, filters).slice(-filters.maxRows);
    const labeledVectors = scopedVectors.filter((vector) => typeof vector.labelWin === 'number' && Number.isFinite(vector.labelWin));
    const trainedAt = new Date().toISOString();
    const modelId = this.createId('ml_baseline', trainedAt);

    if (labeledVectors.length < filters.minTrainingRows) {
      const model = this.emptyModel(modelId, trainedAt, filters, labeledVectors, [
        `Only ${labeledVectors.length} labeled row(s) available. Minimum required: ${filters.minTrainingRows}.`,
        'Model was not trained. Predictions are marked as insufficient_data.',
      ]);
      const predictions = this.predictVectors(model, scopedVectors, trainedAt).slice(0, 500);
      await this.saveModelAndPredictions(model, predictions);
      return { model, predictions };
    }

    const rawRows = labeledVectors.map((vector) => ({
      vector,
      label: vector.labelWin as number,
      raw: this.extractFeatures(vector),
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

    const model: MlBaselineModel = {
      modelId,
      trainedAt,
      modelVersion: ML_BASELINE_VERSION,
      status: 'trained',
      filters,
      featureNames: [...FEATURE_NAMES],
      trainingRows: trainRows.length,
      validationRows: validationRows.length,
      positiveLabels: normalizedRows.filter((row) => row.label === 1).length,
      negativeLabels: normalizedRows.filter((row) => row.label === 0).length,
      intercept: this.round(fitted.intercept, 6),
      weights: this.roundRecord(fitted.weights, 6),
      featureMeans: this.roundRecord(means, 6),
      featureStdDevs: this.roundRecord(stdDevs, 6),
      metrics,
      notes: [
        'First baseline model. It is intentionally simple and should be treated as challenger-only.',
        'Predictions are for paper learning only. Real stake remains blocked at 0.',
      ],
      saved: this.savedPaths(),
    };

    const predictions = this.predictVectors(model, scopedVectors, trainedAt).slice(0, 500);
    await this.saveModelAndPredictions(model, predictions);
    return { model, predictions };
  }

  async latest(): Promise<MlBaselineModel | null> {
    if (!existsSync(LATEST_MODEL_JSON)) return null;
    return JSON.parse(await readFile(LATEST_MODEL_JSON, 'utf-8')) as MlBaselineModel;
  }

  async predictions(limit = 50): Promise<MlBaselinePrediction[]> {
    const safeLimit = Math.max(1, Math.min(limit, 1000));
    const predictions = await this.readJsonl<MlBaselinePrediction>(PREDICTIONS_JSONL);
    return predictions.slice(-safeLimit).reverse();
  }

  async summary(): Promise<MlBaselineSummary> {
    const models = await this.readJsonl<MlBaselineModel>(MODELS_JSONL);
    const predictions = await this.readJsonl<MlBaselinePrediction>(PREDICTIONS_JSONL);
    const latest = models[models.length - 1];

    return {
      modelVersion: ML_BASELINE_VERSION,
      totalModels: models.length,
      latestModelId: latest?.modelId ?? null,
      latestTrainedAt: latest?.trainedAt ?? null,
      latestStatus: latest?.status ?? null,
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

  private normalizeFilters(dto: TrainMlBaselineDto): MlBaselineFilters {
    return {
      source: dto.source ?? 'paper_pick',
      sportKey: dto.sportKey,
      marketType: dto.marketType,
      minTrainingRows: Math.max(2, Math.min(dto.minTrainingRows ?? 20, 100000)),
      maxRows: Math.max(10, Math.min(dto.maxRows ?? 10000, 100000)),
      epochs: Math.max(10, Math.min(dto.epochs ?? 500, 5000)),
      learningRate: Math.max(0.0001, Math.min(dto.learningRate ?? 0.05, 1)),
      validationSplit: Math.max(0, Math.min(dto.validationSplit ?? 0.2, 0.5)),
    };
  }

  private applyFilters(vectors: FeatureVector[], filters: MlBaselineFilters): FeatureVector[] {
    return vectors.filter((vector) => {
      if (filters.source !== 'all' && vector.source !== filters.source) return false;
      if (filters.sportKey && vector.sportKey !== filters.sportKey) return false;
      if (filters.marketType && vector.marketType !== filters.marketType) return false;
      return true;
    });
  }

  private emptyModel(
    modelId: string,
    trainedAt: string,
    filters: MlBaselineFilters,
    labeledVectors: FeatureVector[],
    notes: string[],
  ): MlBaselineModel {
    const zeroRecord = this.zeroRecord();
    return {
      modelId,
      trainedAt,
      modelVersion: ML_BASELINE_VERSION,
      status: 'insufficient_data',
      filters,
      featureNames: [...FEATURE_NAMES],
      trainingRows: 0,
      validationRows: 0,
      positiveLabels: labeledVectors.filter((vector) => vector.labelWin === 1).length,
      negativeLabels: labeledVectors.filter((vector) => vector.labelWin === 0).length,
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

  private extractFeatures(vector: FeatureVector): Record<FeatureName, number> {
    return {
      logBestOdds: Math.log(Math.max(1.01, vector.bestOddsDecimal)),
      consensusProbability: this.safeNumber(vector.consensusProbability),
      edgeVsConsensus: this.safeNumber(vector.edgeVsConsensus),
      expectedValuePerUnit: this.safeNumber(vector.expectedValuePerUnit),
      scannerScore: this.safeNumber(vector.scannerScore),
      priceSpreadPct: this.safeNumber(vector.priceSpreadPct),
      marketHoldPct: this.safeNumber(vector.marketHoldPct),
      lineObservationCount: this.safeNumber(vector.lineObservationCount),
      oddsChangePct: this.safeNumber(vector.oddsChangePct),
      impliedProbabilityChange: this.safeNumber(vector.impliedProbabilityChange),
      consensusProbabilityChange: this.safeNumber(vector.consensusProbabilityChange),
      expectedValueChange: this.safeNumber(vector.expectedValueChange),
      sourcePaperPick: vector.source === 'paper_pick' ? 1 : 0,
      trendShortening: vector.trend === 'shortening' ? 1 : 0,
      trendDrifting: vector.trend === 'drifting' ? 1 : 0,
      recommendationValueCandidate: vector.scannerRecommendation === 'value_candidate' ? 1 : 0,
    };
  }

  private fitLogisticRegression(rows: TrainingRow[], filters: MlBaselineFilters) {
    const weights = this.zeroRecord();
    let intercept = this.initialIntercept(rows);
    const l2 = 0.001;

    for (let epoch = 0; epoch < filters.epochs; epoch += 1) {
      let interceptGradient = 0;
      const gradients = this.zeroRecord();

      for (const row of rows) {
        const prediction = this.predictProbabilityFromNormalized(row.normalized, intercept, weights);
        const error = prediction - row.label;
        interceptGradient += error;
        for (const featureName of FEATURE_NAMES) {
          gradients[featureName] += error * row.normalized[featureName];
        }
      }

      const rowCount = Math.max(1, rows.length);
      intercept -= filters.learningRate * (interceptGradient / rowCount);
      for (const featureName of FEATURE_NAMES) {
        const regularizedGradient = gradients[featureName] / rowCount + l2 * weights[featureName];
        weights[featureName] -= filters.learningRate * regularizedGradient;
      }
    }

    return { intercept, weights };
  }

  private evaluate(rows: TrainingRow[], intercept: number, weights: Record<FeatureName, number>): MlBaselineMetrics {
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

    for (const row of rows) {
      const prediction = this.clampProbability(this.predictProbabilityFromNormalized(row.normalized, intercept, weights));
      const predictedLabel = prediction >= 0.5 ? 1 : 0;
      if (predictedLabel === row.label) correct += 1;
      logLoss += -(row.label * Math.log(prediction) + (1 - row.label) * Math.log(1 - prediction));
      brier += (prediction - row.label) ** 2;
      probabilitySum += prediction;
    }

    return {
      accuracyPct: this.round((correct / rows.length) * 100, 2),
      logLoss: this.round(logLoss / rows.length, 6),
      brierScore: this.round(brier / rows.length, 6),
      averagePredictedWinProbability: this.round(probabilitySum / rows.length, 4),
    };
  }

  private predictVectors(model: MlBaselineModel, vectors: FeatureVector[], generatedAt: string): MlBaselinePrediction[] {
    return vectors.map((vector) => this.predictVector(model, vector, generatedAt));
  }

  private predictVector(model: MlBaselineModel, vector: FeatureVector, generatedAt: string): MlBaselinePrediction {
    const raw = this.extractFeatures(vector);
    const normalized = this.normalizeFeatureValues(raw, model.featureMeans as Record<FeatureName, number>, model.featureStdDevs as Record<FeatureName, number>);
    const breakEvenProbability = vector.bestOddsDecimal > 0 ? 1 / vector.bestOddsDecimal : 0;
    const predictedWinProbability =
      model.status === 'trained'
        ? this.round(this.predictProbabilityFromNormalized(normalized, model.intercept, model.weights as Record<FeatureName, number>), 4)
        : null;
    const predictedEdge = predictedWinProbability === null ? null : this.round(predictedWinProbability - breakEvenProbability, 4);
    const predictedExpectedValuePerUnit =
      predictedWinProbability === null ? null : this.round(predictedWinProbability * vector.bestOddsDecimal - 1, 4);
    const decision = this.decision(model.status, predictedWinProbability, predictedExpectedValuePerUnit, vector);

    return {
      predictionId: this.createId('ml_prediction', `${generatedAt}_${vector.featureVectorId}`),
      generatedAt,
      modelVersion: model.modelVersion,
      modelId: model.modelId,
      modelStatus: model.status,
      featureVectorId: vector.featureVectorId,
      source: vector.source,
      sourceId: vector.sourceId,
      eventId: vector.eventId,
      eventName: vector.eventName,
      commenceTime: vector.commenceTime,
      sportKey: vector.sportKey,
      marketKey: vector.marketKey,
      marketType: vector.marketType,
      selection: vector.selection,
      point: vector.point,
      bestOddsDecimal: vector.bestOddsDecimal,
      scannerRecommendation: vector.scannerRecommendation,
      expectedValuePerUnit: vector.expectedValuePerUnit,
      scannerScore: vector.scannerScore,
      trend: vector.trend,
      predictedWinProbability,
      breakEvenProbability: this.round(breakEvenProbability, 4),
      predictedEdge,
      predictedExpectedValuePerUnit,
      decision,
      realStakeSuggested: 0,
      reasons: this.predictionReasons(model.status, decision, predictedWinProbability, predictedExpectedValuePerUnit, vector),
      featureSnapshot: {
        expectedValuePerUnit: vector.expectedValuePerUnit,
        scannerScore: vector.scannerScore,
        priceSpreadPct: vector.priceSpreadPct,
        marketHoldPct: vector.marketHoldPct,
        lineObservationCount: vector.lineObservationCount,
        oddsChangePct: vector.oddsChangePct,
        trend: vector.trend,
        outcomeKnown: String(vector.outcomeKnown),
      },
    };
  }

  private decision(
    status: MlBaselineModel['status'],
    predictedWinProbability: number | null,
    predictedExpectedValuePerUnit: number | null,
    vector: FeatureVector,
  ): MlBaselineDecision {
    if (status !== 'trained' || predictedWinProbability === null || predictedExpectedValuePerUnit === null) {
      return 'insufficient_data';
    }
    if (predictedWinProbability >= 0.58 && predictedExpectedValuePerUnit > 0.02 && vector.expectedValuePerUnit > 0) {
      return 'paper_candidate';
    }
    if (predictedWinProbability >= 0.52 || predictedExpectedValuePerUnit > 0) {
      return 'watch';
    }
    return 'avoid';
  }

  private predictionReasons(
    status: MlBaselineModel['status'],
    decision: MlBaselineDecision,
    predictedWinProbability: number | null,
    predictedExpectedValuePerUnit: number | null,
    vector: FeatureVector,
  ): string[] {
    if (status !== 'trained') {
      return ['Not enough labeled settlements to train ML baseline yet.', 'Prediction saved for pipeline validation only.'];
    }

    const reasons = [
      `Predicted win probability: ${((predictedWinProbability ?? 0) * 100).toFixed(2)}%.`,
      `Predicted EV per unit: ${((predictedExpectedValuePerUnit ?? 0) * 100).toFixed(2)}%.`,
      `Scanner EV per unit: ${(vector.expectedValuePerUnit * 100).toFixed(2)}%.`,
      `Scanner score: ${vector.scannerScore.toFixed(2)}.`,
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
    const positiveRate = rows.filter((row) => row.label === 1).length / Math.max(1, rows.length);
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

  private async saveModelAndPredictions(model: MlBaselineModel, predictions: MlBaselinePrediction[]) {
    const existingModels = await this.readJsonl<MlBaselineModel>(MODELS_JSONL);
    existingModels.push(model);
    await writeFile(MODELS_JSONL, existingModels.map((item) => JSON.stringify(item)).join('\n') + '\n', 'utf-8');
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

  private async ensureStorage() {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
  }

  private savedPaths() {
    return {
      modelsPath: this.relativePath(MODELS_JSONL),
      latestModelPath: this.relativePath(LATEST_MODEL_JSON),
      predictionsPath: this.relativePath(PREDICTIONS_JSONL),
    };
  }

  private relativePath(path: string): string {
    return path.replace(`${process.cwd()}${join('/')}`, '').replaceAll('\\', '/');
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
