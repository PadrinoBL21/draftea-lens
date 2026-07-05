import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ContinuousCollectorService } from '../continuous-collector/continuous-collector.service';
import { RunCollectorDto } from '../continuous-collector/dto/run-collector.dto';
import { RunDataCollectionSchedulerOnceDto } from './dto/run-data-collection-scheduler-once.dto';
import { StartDataCollectionSchedulerDto } from './dto/start-data-collection-scheduler.dto';
import {
  DataCollectionSchedulerConfig,
  DataCollectionSchedulerRunResult,
  DataCollectionSchedulerState,
  DataCollectionSchedulerSummary,
  DataCollectionSchedulerTrigger,
} from './data-collection-scheduler.types';

const SCHEDULER_VERSION = 'data-collection-scheduler-v0.1';
const DATA_DIR = join(process.cwd(), 'data', 'data-collection-scheduler');
const RUNS_JSONL = join(DATA_DIR, 'runs.jsonl');
const LATEST_RUN_JSON = join(DATA_DIR, 'latest-run.json');
const STATE_JSON = join(DATA_DIR, 'state.json');

@Injectable()
export class DataCollectionSchedulerService implements OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeConfig: DataCollectionSchedulerConfig | null = null;
  private nextRunAt: string | null = null;
  private running = false;

  constructor(private readonly collectorService: ContinuousCollectorService) {}

  async onModuleDestroy() {
    await this.stop('Nest module shutdown.');
  }

  async start(dto: StartDataCollectionSchedulerDto): Promise<DataCollectionSchedulerState> {
    const config = this.normalizeConfig(dto);
    await this.ensureStorage();

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.activeConfig = config;
    this.nextRunAt = this.isoFromNow(config.intervalMinutes);

    this.timer = setInterval(() => {
      void this.runScheduledTick();
    }, config.intervalMinutes * 60_000);

    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }

    const previousState = await this.readState();
    const state: DataCollectionSchedulerState = {
      schedulerVersion: SCHEDULER_VERSION,
      status: 'running',
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      nextRunAt: this.nextRunAt,
      lastRunAt: previousState?.lastRunAt ?? null,
      runCount: previousState?.runCount ?? 0,
      latestRunId: previousState?.latestRunId ?? null,
      config,
      notes: [
        'In-process local scheduler started.',
        'Scheduler only runs while the API process is alive. Use an external scheduler later for production.',
      ],
    };

    await this.writeState(state);
    return state;
  }

  async stop(reason = 'Stopped manually.'): Promise<DataCollectionSchedulerState> {
    await this.ensureStorage();

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const previousState = await this.readState();
    const state: DataCollectionSchedulerState = {
      schedulerVersion: SCHEDULER_VERSION,
      status: 'stopped',
      startedAt: previousState?.startedAt ?? null,
      stoppedAt: new Date().toISOString(),
      nextRunAt: null,
      lastRunAt: previousState?.lastRunAt ?? null,
      runCount: previousState?.runCount ?? 0,
      latestRunId: previousState?.latestRunId ?? null,
      config: this.activeConfig ?? previousState?.config ?? null,
      notes: [reason],
    };

    this.activeConfig = null;
    this.nextRunAt = null;
    await this.writeState(state);
    return state;
  }

  async status(): Promise<DataCollectionSchedulerState> {
    await this.ensureStorage();
    const state = await this.readState();

    if (!state) {
      return {
        schedulerVersion: SCHEDULER_VERSION,
        status: 'idle',
        startedAt: null,
        stoppedAt: null,
        nextRunAt: null,
        lastRunAt: null,
        runCount: 0,
        latestRunId: null,
        config: null,
        notes: ['Scheduler has not been started in this workspace.'],
      };
    }

    if (state.status === 'running' && !this.timer) {
      return {
        ...state,
        status: 'stopped',
        nextRunAt: null,
        notes: [
          ...state.notes,
          'Persisted state said running, but no in-process timer exists. Restart scheduler after API restarts.',
        ],
      };
    }

    return {
      ...state,
      nextRunAt: this.nextRunAt ?? state.nextRunAt,
      config: this.activeConfig ?? state.config,
    };
  }

  async runNow(dto: RunDataCollectionSchedulerOnceDto = {}): Promise<DataCollectionSchedulerRunResult> {
    const state = await this.status();
    const config = this.normalizeConfig({ ...(state.config ?? {}), ...dto });
    return this.executeRun('manual', config);
  }

  async latest(): Promise<DataCollectionSchedulerRunResult | null> {
    await this.ensureStorage();
    if (!existsSync(LATEST_RUN_JSON)) return null;
    const raw = await readFile(LATEST_RUN_JSON, 'utf-8');
    return JSON.parse(raw) as DataCollectionSchedulerRunResult;
  }

  async runs(limit = 20): Promise<DataCollectionSchedulerRunResult[]> {
    await this.ensureStorage();
    if (!existsSync(RUNS_JSONL)) return [];
    const raw = await readFile(RUNS_JSONL, 'utf-8');
    const runs = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DataCollectionSchedulerRunResult);

    return runs.slice(-Math.max(1, Math.min(limit, 200))).reverse();
  }

  async summary(): Promise<DataCollectionSchedulerSummary> {
    const [state, runs] = await Promise.all([this.status(), this.runs(200)]);
    const latest = runs[0] ?? null;

    return {
      schedulerVersion: SCHEDULER_VERSION,
      status: state.status,
      totalRuns: runs.length,
      successfulRuns: runs.filter((run) => run.status === 'success').length,
      failedRuns: runs.filter((run) => run.status === 'failed').length,
      latestRunId: latest?.runId ?? null,
      latestRunAt: latest?.finishedAt ?? null,
      latestRunStatus: latest?.status ?? null,
      latestCollectorStatus: latest?.collectorStatus ?? null,
      latestReadiness: latest?.dataQualityReadiness ?? null,
      totalPaperPicksSaved: runs.reduce((sum, run) => sum + run.paperPicksSaved, 0),
      totalOddsLinesSaved: runs.reduce((sum, run) => sum + run.oddsLinesSaved, 0),
      totalFeatureVectorsBuilt: runs.reduce((sum, run) => sum + run.featureVectorsBuilt, 0),
      nextRunAt: state.nextRunAt,
      config: state.config,
    };
  }

  private async runScheduledTick(): Promise<void> {
    if (!this.activeConfig || this.running) return;
    await this.executeRun('interval', this.activeConfig);
    this.nextRunAt = this.isoFromNow(this.activeConfig.intervalMinutes);
    const state = await this.status();
    await this.writeState({ ...state, status: 'running', nextRunAt: this.nextRunAt, config: this.activeConfig });
  }

  private async executeRun(
    trigger: DataCollectionSchedulerTrigger,
    config: DataCollectionSchedulerConfig,
  ): Promise<DataCollectionSchedulerRunResult> {
    await this.ensureStorage();

    if (this.running) {
      return this.skippedRun(trigger, config, 'A scheduler run is already in progress.');
    }

    this.running = true;
    const triggeredAt = new Date().toISOString();
    const runId = this.createId('scheduler_run', triggeredAt);

    try {
      const collectorRun = await this.collectorService.runOnce(this.toCollectorDto(config, trigger));
      const finishedAt = new Date().toISOString();
      const result: DataCollectionSchedulerRunResult = {
        runId,
        triggeredAt,
        finishedAt,
        schedulerVersion: SCHEDULER_VERSION,
        trigger,
        status: collectorRun.status === 'failed' ? 'failed' : 'success',
        config,
        collectorRunId: collectorRun.runId,
        collectorStatus: collectorRun.status,
        dataQualityReadiness: collectorRun.summary.dataQualityReadiness,
        paperPicksSaved: collectorRun.summary.paperPicksSaved,
        oddsLinesSaved: collectorRun.summary.oddsLinesSaved,
        featureVectorsBuilt: collectorRun.summary.featureVectorsBuilt,
        blockerCount: collectorRun.summary.blockerCount,
        warningCount: collectorRun.summary.warningCount,
        message: `Collector finished with status ${collectorRun.status}.`,
        saved: this.savedPaths(),
      };

      await this.persistRun(result);
      return result;
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const result: DataCollectionSchedulerRunResult = {
        runId,
        triggeredAt,
        finishedAt,
        schedulerVersion: SCHEDULER_VERSION,
        trigger,
        status: 'failed',
        config,
        collectorRunId: null,
        collectorStatus: null,
        dataQualityReadiness: null,
        paperPicksSaved: 0,
        oddsLinesSaved: 0,
        featureVectorsBuilt: 0,
        blockerCount: null,
        warningCount: null,
        message: 'Scheduled collector run failed.',
        error: error instanceof Error ? error.message : String(error),
        saved: this.savedPaths(),
      };

      await this.persistRun(result);
      return result;
    } finally {
      this.running = false;
    }
  }

  private async skippedRun(
    trigger: DataCollectionSchedulerTrigger,
    config: DataCollectionSchedulerConfig,
    message: string,
  ): Promise<DataCollectionSchedulerRunResult> {
    const now = new Date().toISOString();
    const result: DataCollectionSchedulerRunResult = {
      runId: this.createId('scheduler_run', now),
      triggeredAt: now,
      finishedAt: now,
      schedulerVersion: SCHEDULER_VERSION,
      trigger,
      status: 'skipped',
      config,
      collectorRunId: null,
      collectorStatus: null,
      dataQualityReadiness: null,
      paperPicksSaved: 0,
      oddsLinesSaved: 0,
      featureVectorsBuilt: 0,
      blockerCount: null,
      warningCount: null,
      message,
      saved: this.savedPaths(),
    };

    await this.persistRun(result);
    return result;
  }

  private async persistRun(result: DataCollectionSchedulerRunResult): Promise<void> {
    await appendFile(RUNS_JSONL, `${JSON.stringify(result)}\n`, 'utf-8');
    await writeFile(LATEST_RUN_JSON, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');

    const previousState = await this.readState();
    await this.writeState({
      schedulerVersion: SCHEDULER_VERSION,
      status: this.timer ? 'running' : previousState?.status ?? 'idle',
      startedAt: previousState?.startedAt ?? null,
      stoppedAt: previousState?.stoppedAt ?? null,
      nextRunAt: this.nextRunAt,
      lastRunAt: result.finishedAt,
      runCount: (previousState?.runCount ?? 0) + 1,
      latestRunId: result.runId,
      config: this.activeConfig ?? result.config,
      notes: previousState?.notes ?? [],
    });
  }

  private normalizeConfig(dto: Partial<StartDataCollectionSchedulerDto>): DataCollectionSchedulerConfig {
    const bankroll = Number(dto.bankroll);
    if (!Number.isFinite(bankroll) || bankroll <= 0) {
      throw new BadRequestException('bankroll must be a positive number.');
    }

    return {
      bankroll,
      intervalMinutes: this.clampInt(dto.intervalMinutes ?? 60, 1, 1440),
      runLabel: dto.runLabel ?? 'scheduled-cycle',
      enablePaperPicks: dto.enablePaperPicks ?? true,
      maxPaperPicks: this.clampInt(dto.maxPaperPicks ?? 10, 1, 50),
      enableOddsSnapshot: dto.enableOddsSnapshot ?? true,
      maxLines: this.clampInt(dto.maxLines ?? 200, 1, 500),
      rebuildFeatureStore: dto.rebuildFeatureStore ?? true,
      maxFeatureVectors: this.clampInt(dto.maxFeatureVectors ?? 5000, 1, 50000),
      auditDataQuality: dto.auditDataQuality ?? true,
      persistDataQualityAudit: dto.persistDataQualityAudit ?? true,
    };
  }

  private toCollectorDto(config: DataCollectionSchedulerConfig, trigger: DataCollectionSchedulerTrigger): RunCollectorDto {
    return {
      bankroll: config.bankroll,
      runLabel: `${config.runLabel}-${trigger}`,
      enablePaperPicks: config.enablePaperPicks,
      maxPaperPicks: config.maxPaperPicks,
      enableOddsSnapshot: config.enableOddsSnapshot,
      maxLines: config.maxLines,
      rebuildFeatureStore: config.rebuildFeatureStore,
      maxFeatureVectors: config.maxFeatureVectors,
      auditDataQuality: config.auditDataQuality,
      persistDataQualityAudit: config.persistDataQualityAudit,
    };
  }

  private async ensureStorage(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
  }

  private async readState(): Promise<DataCollectionSchedulerState | null> {
    if (!existsSync(STATE_JSON)) return null;
    const raw = await readFile(STATE_JSON, 'utf-8');
    return JSON.parse(raw) as DataCollectionSchedulerState;
  }

  private async writeState(state: DataCollectionSchedulerState): Promise<void> {
    await writeFile(STATE_JSON, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
  }

  private savedPaths() {
    return {
      runsPath: this.relativePath(RUNS_JSONL),
      latestRunPath: this.relativePath(LATEST_RUN_JSON),
      statePath: this.relativePath(STATE_JSON),
    };
  }

  private isoFromNow(minutes: number): string {
    return new Date(Date.now() + minutes * 60_000).toISOString();
  }

  private createId(prefix: string, iso: string): string {
    const stamp = iso.replace(/[-:.]/g, '').replace('T', 't').replace('Z', 'z');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${stamp}_${suffix}`;
  }

  private relativePath(path: string): string {
    return path.replace(process.cwd(), '.').replace(/\\/g, '/');
  }

  private clampInt(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, Math.trunc(value)));
  }
}
