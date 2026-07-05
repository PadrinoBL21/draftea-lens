import { MlBaselineV2Source } from './dto/train-ml-baseline-v2.dto';

export type MlBaselineV2ModelStatus = 'trained' | 'insufficient_data';
export type MlBaselineV2Decision = 'paper_candidate' | 'watch' | 'avoid' | 'insufficient_data';

export interface MlBaselineV2Filters {
  source: MlBaselineV2Source;
  sportKey?: string;
  marketType?: string;
  minExpectedValue: number;
  minTrainingRows: number;
  maxRows: number;
  epochs: number;
  learningRate: number;
  validationSplit: number;
}

export interface MlBaselineV2Metrics {
  accuracyPct: number | null;
  logLoss: number | null;
  brierScore: number | null;
  averagePredictedWinProbability: number | null;
}

export interface MlBaselineV2Model {
  modelId: string;
  trainedAt: string;
  modelVersion: string;
  status: MlBaselineV2ModelStatus;
  sourceDatasetExportId: string | null;
  sourceDatasetVersion: string | null;
  sourceDatasetRows: number;
  sourceTrainingEligibleRows: number;
  filters: MlBaselineV2Filters;
  featureNames: string[];
  trainingRows: number;
  validationRows: number;
  positiveLabels: number;
  negativeLabels: number;
  weightedRows: number;
  intercept: number;
  weights: Record<string, number>;
  featureMeans: Record<string, number>;
  featureStdDevs: Record<string, number>;
  metrics: MlBaselineV2Metrics;
  notes: string[];
  saved: {
    modelsPath: string;
    latestModelPath: string;
    predictionsPath: string;
  };
}

export interface MlBaselineV2Prediction {
  predictionId: string;
  generatedAt: string;
  modelVersion: string;
  modelId: string;
  modelStatus: MlBaselineV2ModelStatus;
  sourceDatasetExportId: string | null;
  datasetRowId: string;
  labelWin: number | null;
  labelWeight: number;
  labelKnown: boolean;
  source: string;
  sourceId: string | null;
  eventId: string | null;
  eventName: string | null;
  commenceTime: string | null;
  sportKey: string | null;
  marketKey: string | null;
  marketType: string | null;
  selection: string | null;
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
  decision: MlBaselineV2Decision;
  realStakeSuggested: 0;
  reasons: string[];
  featureSnapshot: Record<string, number | string | null | undefined>;
}

export interface MlBaselineV2TrainResult {
  model: MlBaselineV2Model;
  predictions: MlBaselineV2Prediction[];
}

export interface MlBaselineV2Summary {
  modelVersion: string;
  totalModels: number;
  latestModelId: string | null;
  latestTrainedAt: string | null;
  latestStatus: MlBaselineV2ModelStatus | null;
  latestSourceDatasetExportId: string | null;
  latestTrainingRows: number | null;
  latestValidationRows: number | null;
  latestAccuracyPct: number | null;
  totalPredictions: number;
  paperCandidates: number;
  watch: number;
  avoid: number;
  insufficientDataPredictions: number;
}
