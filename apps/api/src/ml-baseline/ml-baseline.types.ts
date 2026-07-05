import { MlBaselineSource } from './dto/train-ml-baseline.dto';

export type MlBaselineModelStatus = 'trained' | 'insufficient_data';
export type MlBaselineDecision = 'paper_candidate' | 'watch' | 'avoid' | 'insufficient_data';

export interface MlBaselineFilters {
  source: MlBaselineSource;
  sportKey?: string;
  marketType?: string;
  minTrainingRows: number;
  maxRows: number;
  epochs: number;
  learningRate: number;
  validationSplit: number;
}

export interface MlBaselineMetrics {
  accuracyPct: number | null;
  logLoss: number | null;
  brierScore: number | null;
  averagePredictedWinProbability: number | null;
}

export interface MlBaselineModel {
  modelId: string;
  trainedAt: string;
  modelVersion: string;
  status: MlBaselineModelStatus;
  filters: MlBaselineFilters;
  featureNames: string[];
  trainingRows: number;
  validationRows: number;
  positiveLabels: number;
  negativeLabels: number;
  intercept: number;
  weights: Record<string, number>;
  featureMeans: Record<string, number>;
  featureStdDevs: Record<string, number>;
  metrics: MlBaselineMetrics;
  notes: string[];
  saved: {
    modelsPath: string;
    latestModelPath: string;
    predictionsPath: string;
  };
}

export interface MlBaselinePrediction {
  predictionId: string;
  generatedAt: string;
  modelVersion: string;
  modelId: string;
  modelStatus: MlBaselineModelStatus;
  featureVectorId: string;
  source: string;
  sourceId: string;
  eventId: string;
  eventName: string;
  commenceTime: string;
  sportKey: string;
  marketKey: string;
  marketType: string;
  selection: string;
  point?: number;
  bestOddsDecimal: number;
  scannerRecommendation: string;
  expectedValuePerUnit: number;
  scannerScore: number;
  trend: string;
  predictedWinProbability: number | null;
  breakEvenProbability: number;
  predictedEdge: number | null;
  predictedExpectedValuePerUnit: number | null;
  decision: MlBaselineDecision;
  realStakeSuggested: 0;
  reasons: string[];
  featureSnapshot: Record<string, number | string | null | undefined>;
}

export interface MlBaselineTrainResult {
  model: MlBaselineModel;
  predictions: MlBaselinePrediction[];
}

export interface MlBaselineSummary {
  modelVersion: string;
  totalModels: number;
  latestModelId: string | null;
  latestTrainedAt: string | null;
  latestStatus: MlBaselineModelStatus | null;
  latestTrainingRows: number | null;
  latestValidationRows: number | null;
  latestAccuracyPct: number | null;
  totalPredictions: number;
  paperCandidates: number;
  watch: number;
  avoid: number;
  insufficientDataPredictions: number;
}
