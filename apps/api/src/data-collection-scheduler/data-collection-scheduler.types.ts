import { CollectorRunConfig, CollectorRunStatus } from '../continuous-collector/continuous-collector.types';

export type DataCollectionSchedulerStatus = 'idle' | 'running' | 'stopped';
export type DataCollectionSchedulerTrigger = 'manual' | 'interval';
export type DataCollectionSchedulerRunStatus = 'success' | 'failed' | 'skipped';

export interface DataCollectionSchedulerConfig extends CollectorRunConfig {
  intervalMinutes: number;
}

export interface DataCollectionSchedulerState {
  schedulerVersion: string;
  status: DataCollectionSchedulerStatus;
  startedAt: string | null;
  stoppedAt: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  runCount: number;
  latestRunId: string | null;
  config: DataCollectionSchedulerConfig | null;
  notes: string[];
}

export interface DataCollectionSchedulerRunResult {
  runId: string;
  triggeredAt: string;
  finishedAt: string;
  schedulerVersion: string;
  trigger: DataCollectionSchedulerTrigger;
  status: DataCollectionSchedulerRunStatus;
  config: DataCollectionSchedulerConfig;
  collectorRunId: string | null;
  collectorStatus: CollectorRunStatus | null;
  dataQualityReadiness: string | null;
  paperPicksSaved: number;
  oddsLinesSaved: number;
  featureVectorsBuilt: number;
  blockerCount: number | null;
  warningCount: number | null;
  message: string;
  error?: string;
  saved: {
    runsPath: string;
    latestRunPath: string;
    statePath: string;
  };
}

export interface DataCollectionSchedulerSummary {
  schedulerVersion: string;
  status: DataCollectionSchedulerStatus;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  latestRunId: string | null;
  latestRunAt: string | null;
  latestRunStatus: DataCollectionSchedulerRunStatus | null;
  latestCollectorStatus: CollectorRunStatus | null;
  latestReadiness: string | null;
  totalPaperPicksSaved: number;
  totalOddsLinesSaved: number;
  totalFeatureVectorsBuilt: number;
  nextRunAt: string | null;
  config: DataCollectionSchedulerConfig | null;
}
