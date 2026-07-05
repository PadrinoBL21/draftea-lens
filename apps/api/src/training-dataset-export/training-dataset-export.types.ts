import { LabelFeatures, LabeledTrainingRow } from '../labeling-pipeline/labeling-pipeline.types';

export type TrainingDatasetFormat = 'jsonl' | 'csv' | 'both';

export interface TrainingDatasetExportFilters {
  format: TrainingDatasetFormat;
  eligibleOnly: boolean;
  includeMetadata: boolean;
  sportKey?: string;
  marketType?: string;
  minExpectedValue: number;
  maxRows: number;
}

export interface TrainingDatasetMetadata {
  labelId: string;
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
  settlementResult: string | null;
  outcomeClass: string;
  exclusionReason: string | null;
  bestOddsDecimal: number;
  breakEvenProbability: number;
  expectedValuePerUnit: number;
  scannerScore: number;
  trend: string;
  labelProfitLoss: number | null;
  labelClosingLineValue: number | null;
}

export interface TrainingDatasetRow {
  datasetRowId: string;
  exportedAt: string;
  datasetVersion: string;
  labelWin: number | null;
  labelWeight: number;
  features: LabelFeatures;
  metadata?: TrainingDatasetMetadata;
}

export interface TrainingDatasetExportSummary {
  datasetVersion: string;
  latestExportId: string | null;
  latestExportedAt: string | null;
  totalExports: number;
  latestRowsExported: number;
  latestTrainingEligibleRows: number;
  latestPositiveLabels: number;
  latestNegativeLabels: number;
  latestExcludedRows: number;
  latestNeutralRows: number;
  latestUniqueSports: number;
  latestUniqueMarketTypes: number;
  latestFormat: TrainingDatasetFormat | null;
  latestReadyForTraining: boolean;
}

export interface TrainingDatasetExportRun {
  exportId: string;
  exportedAt: string;
  datasetVersion: string;
  filters: TrainingDatasetExportFilters;
  sourceLabels: number;
  rowsExported: number;
  trainingEligibleRows: number;
  positiveLabels: number;
  negativeLabels: number;
  neutralRows: number;
  excludedRows: number;
  uniqueSports: number;
  uniqueMarketTypes: number;
  readyForTraining: boolean;
  sample: TrainingDatasetRow[];
  saved?: {
    exportsPath: string;
    latestExportPath: string;
    jsonlPath?: string;
    csvPath?: string;
  };
}

export interface TrainingDatasetListResponse {
  value: TrainingDatasetExportRun[];
  count: number;
}

export interface TrainingDatasetRowsResponse {
  value: TrainingDatasetRow[];
  count: number;
  sourceExportId: string | null;
}

export type LabeledTrainingRowInput = LabeledTrainingRow;
