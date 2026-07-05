import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataQualityService } from '../data-quality/data-quality.service';
import { FeatureStoreService } from '../feature-store/feature-store.service';
import { OddsHistoryService } from '../odds-history/odds-history.service';
import { PaperService } from '../paper/paper.service';
import { RunCollectorDto } from './dto/run-collector.dto';
import {
  CollectorRunConfig,
  CollectorRunResult,
  CollectorRunStatus,
  CollectorStepName,
  CollectorStepResult,
  CollectorSummary,
} from './continuous-collector.types';

const COLLECTOR_VERSION = 'continuous-collector-v0.1';
const DATA_DIR = join(process.cwd(), 'data', 'continuous-collector');
const RUNS_JSONL = join(DATA_DIR, 'runs.jsonl');
const LATEST_RUN_JSON = join(DATA_DIR, 'latest-run.json');

@Injectable()
export class ContinuousCollectorService {
  constructor(
    private readonly paperService: PaperService,
    private readonly oddsHistoryService: OddsHistoryService,
    private readonly featureStoreService: FeatureStoreService,
    private readonly dataQualityService: DataQualityService,
  ) {}

  async runOnce(dto: RunCollectorDto): Promise<CollectorRunResult> {
    if (!Number.isFinite(dto.bankroll) || dto.bankroll <= 0) {
      throw new BadRequestException('bankroll must be a positive number.');
    }

    await this.ensureStorage();

    const startedAt = new Date().toISOString();
    const runId = this.createId('collector_run', startedAt);
    const config = this.normalizeConfig(dto);
    const steps: CollectorStepResult[] = [];

    if (config.enablePaperPicks) {
      steps.push(
        await this.runStep('paper_scan', async () => {
          const result = await this.paperService.scanAndSave({
            bankroll: config.bankroll,
            maxPaperPicks: config.maxPaperPicks,
          });

          return {
            message: `Saved ${result.paperPicks.length} paper pick(s).`,
            metrics: {
              scanId: result.scanId,
              paperPicksSaved: result.paperPicks.length,
              watchlistCount: result.watchlist.length,
            },
          };
        }),
      );
    } else {
      steps.push(this.skippedStep('paper_scan', 'Paper scan disabled for this collector run.'));
    }

    if (config.enableOddsSnapshot) {
      steps.push(
        await this.runStep('odds_snapshot', async () => {
          const result = await this.oddsHistoryService.createSnapshot({
            bankroll: config.bankroll,
            maxLines: config.maxLines,
          });

          return {
            message: `Saved ${result.linesSaved} odds line observation(s).`,
            metrics: {
              snapshotId: result.snapshotId,
              oddsLinesSaved: result.linesSaved,
            },
          };
        }),
      );
    } else {
      steps.push(this.skippedStep('odds_snapshot', 'Odds snapshot disabled for this collector run.'));
    }

    if (config.rebuildFeatureStore) {
      steps.push(
        await this.runStep('feature_store_rebuild', async () => {
          const result = await this.featureStoreService.rebuild({
            includePaperPicks: true,
            includeOddsLines: true,
            maxVectors: config.maxFeatureVectors,
          });

          return {
            message: `Built ${result.vectorsBuilt} feature vector(s).`,
            metrics: {
              rebuildId: result.rebuildId,
              featureVectorsBuilt: result.vectorsBuilt,
              paperPickVectors: result.paperPickVectors,
              oddsLineVectors: result.oddsLineVectors,
            },
          };
        }),
      );
    } else {
      steps.push(this.skippedStep('feature_store_rebuild', 'Feature store rebuild disabled for this collector run.'));
    }

    if (config.auditDataQuality) {
      steps.push(
        await this.runStep('data_quality_audit', async () => {
          const result = await this.dataQualityService.audit({ persist: config.persistDataQualityAudit });

          return {
            message: `Data quality readiness: ${result.readiness}.`,
            metrics: {
              auditId: result.auditId,
              readiness: result.readiness,
              blockerCount: result.blockers.length,
              warningCount: result.warnings.length,
              paperPicks: result.counts.paperPicks.total,
              settledPicks: result.counts.paperPicks.settled,
              labelableVectors: result.counts.featureStore.labelableVectors,
              oddsLineObservations: result.counts.oddsHistory.totalLineObservations,
            },
          };
        }),
      );
    } else {
      steps.push(this.skippedStep('data_quality_audit', 'Data quality audit disabled for this collector run.'));
    }

    const finishedAt = new Date().toISOString();
    const status = this.statusFromSteps(steps);
    const summary = this.summarize(status, steps);

    const run: CollectorRunResult = {
      runId,
      startedAt,
      finishedAt,
      collectorVersion: COLLECTOR_VERSION,
      status,
      config,
      steps,
      summary,
      saved: {
        runsPath: this.relativePath(RUNS_JSONL),
        latestRunPath: this.relativePath(LATEST_RUN_JSON),
      },
    };

    await appendFile(RUNS_JSONL, `${JSON.stringify(run)}\n`, 'utf-8');
    await writeFile(LATEST_RUN_JSON, `${JSON.stringify(run, null, 2)}\n`, 'utf-8');

    return run;
  }

  async latest(): Promise<CollectorRunResult | null> {
    await this.ensureStorage();
    if (!existsSync(LATEST_RUN_JSON)) return null;
    const raw = await readFile(LATEST_RUN_JSON, 'utf-8');
    return JSON.parse(raw) as CollectorRunResult;
  }

  async listRuns(limit = 20): Promise<CollectorRunResult[]> {
    await this.ensureStorage();
    if (!existsSync(RUNS_JSONL)) return [];
    const raw = await readFile(RUNS_JSONL, 'utf-8');
    const runs = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CollectorRunResult);

    return runs.slice(-Math.max(1, Math.min(limit, 200))).reverse();
  }

  async summary(): Promise<CollectorSummary> {
    const runs = await this.listRuns(200);
    const latest = runs[0] ?? null;

    return {
      collectorVersion: COLLECTOR_VERSION,
      totalRuns: runs.length,
      latestRunId: latest?.runId ?? null,
      latestRunAt: latest?.finishedAt ?? null,
      latestStatus: latest?.status ?? null,
      latestReadiness: latest?.summary.dataQualityReadiness ?? null,
      totalPaperPicksSaved: this.sumMetric(runs, 'paperPicksSaved'),
      totalOddsLinesSaved: this.sumMetric(runs, 'oddsLinesSaved'),
      totalFeatureVectorsBuilt: this.sumMetric(runs, 'featureVectorsBuilt'),
      failedRuns: runs.filter((run) => run.status === 'failed').length,
    };
  }

  private async runStep(
    name: CollectorStepName,
    action: () => Promise<{ message: string; metrics: Record<string, number | string | boolean | null> }>,
  ): Promise<CollectorStepResult> {
    const startedAt = new Date().toISOString();
    const start = Date.now();

    try {
      const result = await action();
      const finishedAt = new Date().toISOString();
      return {
        name,
        status: 'success',
        startedAt,
        finishedAt,
        durationMs: Date.now() - start,
        message: result.message,
        metrics: result.metrics,
      };
    } catch (error) {
      const finishedAt = new Date().toISOString();
      return {
        name,
        status: 'failed',
        startedAt,
        finishedAt,
        durationMs: Date.now() - start,
        message: `${name} failed.`,
        metrics: {},
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private skippedStep(name: CollectorStepName, message: string): CollectorStepResult {
    const now = new Date().toISOString();
    return {
      name,
      status: 'skipped',
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      message,
      metrics: {},
    };
  }

  private normalizeConfig(dto: RunCollectorDto): CollectorRunConfig {
    return {
      bankroll: dto.bankroll,
      runLabel: dto.runLabel,
      enablePaperPicks: dto.enablePaperPicks ?? true,
      maxPaperPicks: Math.max(1, Math.min(dto.maxPaperPicks ?? 10, 50)),
      enableOddsSnapshot: dto.enableOddsSnapshot ?? true,
      maxLines: Math.max(1, Math.min(dto.maxLines ?? 200, 500)),
      rebuildFeatureStore: dto.rebuildFeatureStore ?? true,
      maxFeatureVectors: Math.max(1, Math.min(dto.maxFeatureVectors ?? 5000, 50000)),
      auditDataQuality: dto.auditDataQuality ?? true,
      persistDataQualityAudit: dto.persistDataQualityAudit ?? true,
    };
  }

  private statusFromSteps(steps: CollectorStepResult[]): CollectorRunStatus {
    if (steps.some((step) => step.status === 'failed')) return 'failed';
    const audit = steps.find((step) => step.name === 'data_quality_audit' && step.status === 'success');
    const blockers = Number(audit?.metrics.blockerCount ?? 0);
    const warnings = Number(audit?.metrics.warningCount ?? 0);
    return blockers > 0 || warnings > 0 ? 'completed_with_warnings' : 'completed';
  }

  private summarize(status: CollectorRunStatus, steps: CollectorStepResult[]): CollectorRunResult['summary'] {
    const audit = steps.find((step) => step.name === 'data_quality_audit' && step.status === 'success');

    const recommendation =
      status === 'failed'
        ? 'collector_failed'
        : Number(audit?.metrics.blockerCount ?? 0) > 0
          ? 'collecting_data'
          : 'ready_for_training_checks';

    return {
      paperPicksSaved: Number(steps.find((step) => step.name === 'paper_scan')?.metrics.paperPicksSaved ?? 0),
      oddsLinesSaved: Number(steps.find((step) => step.name === 'odds_snapshot')?.metrics.oddsLinesSaved ?? 0),
      featureVectorsBuilt: Number(steps.find((step) => step.name === 'feature_store_rebuild')?.metrics.featureVectorsBuilt ?? 0),
      dataQualityReadiness: audit?.metrics.readiness === undefined ? null : String(audit.metrics.readiness),
      blockerCount: Number(audit?.metrics.blockerCount ?? 0),
      warningCount: Number(audit?.metrics.warningCount ?? 0),
      recommendation,
    };
  }

  private sumMetric(runs: CollectorRunResult[], metric: 'paperPicksSaved' | 'oddsLinesSaved' | 'featureVectorsBuilt'): number {
    return runs.reduce((total, run) => total + run.summary[metric], 0);
  }

  private async ensureStorage(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    if (!existsSync(RUNS_JSONL)) {
      await writeFile(RUNS_JSONL, '', 'utf-8');
    }
  }

  private createId(prefix: string, isoDate: string): string {
    const stamp = isoDate.replace(/[-:.TZ]/g, '').slice(0, 17).toLowerCase();
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${stamp}_${random}`;
  }

  private relativePath(path: string): string {
    return path.replace(process.cwd(), '.').replace(/\\/g, '/');
  }
}
