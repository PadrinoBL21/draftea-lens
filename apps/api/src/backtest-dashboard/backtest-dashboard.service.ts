import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BacktestDashboardOverview,
  DashboardBacktestingView,
  DashboardCollectionView,
  DashboardCounts,
  DashboardModelView,
  DashboardRiskView,
} from './backtest-dashboard.types';

const DASHBOARD_VERSION = 'backtest-dashboard-v0.1';
const DATA_ROOT = join(process.cwd(), 'data');
const BACKTESTING_DIR = join(DATA_ROOT, 'backtesting');
const BACKTESTING_RUNS_JSONL = join(BACKTESTING_DIR, 'backtest-runs.jsonl');
const BACKTESTING_LATEST_JSON = join(BACKTESTING_DIR, 'latest-run.json');
const DATA_QUALITY_LATEST_JSON = join(DATA_ROOT, 'data-quality', 'latest-audit.json');
const MODEL_GOVERNANCE_CHAMPION_JSON = join(DATA_ROOT, 'model-governance', 'champion.json');
const MODEL_GOVERNANCE_LATEST_EVAL_JSON = join(DATA_ROOT, 'model-governance', 'latest-evaluation.json');
const ML_LATEST_MODEL_JSON = join(DATA_ROOT, 'ml-baseline', 'latest-model.json');
const ML_PREDICTIONS_JSONL = join(DATA_ROOT, 'ml-baseline', 'predictions.jsonl');
const COLLECTOR_RUNS_JSONL = join(DATA_ROOT, 'continuous-collector', 'runs.jsonl');
const COLLECTOR_LATEST_JSON = join(DATA_ROOT, 'continuous-collector', 'latest-run.json');
const SCHEDULER_RUNS_JSONL = join(DATA_ROOT, 'data-collection-scheduler', 'runs.jsonl');
const SCHEDULER_LATEST_JSON = join(DATA_ROOT, 'data-collection-scheduler', 'latest-run.json');
const PAPER_PICKS_JSONL = join(DATA_ROOT, 'paper-ledger', 'paper-picks.jsonl');
const ODDS_LINES_JSONL = join(DATA_ROOT, 'odds-history', 'odds-lines.jsonl');
const FEATURES_JSONL = join(DATA_ROOT, 'feature-store', 'features.jsonl');

@Injectable()
export class BacktestDashboardService {
  async overview(): Promise<BacktestDashboardOverview> {
    await this.ensureStorage();
    const generatedAt = new Date().toISOString();
    const dataQuality = await this.readJson(DATA_QUALITY_LATEST_JSON);
    const counts = await this.counts(dataQuality);
    const champion = await this.readJson(MODEL_GOVERNANCE_CHAMPION_JSON);
    const latestMlModel = await this.readJson(ML_LATEST_MODEL_JSON);
    const latestBacktest = await this.readJson(BACKTESTING_LATEST_JSON);
    const latestCollectorRun = await this.readJson(COLLECTOR_LATEST_JSON);
    const latestSchedulerRun = await this.readJson(SCHEDULER_LATEST_JSON);
    const readiness = this.stringValue(dataQuality?.readiness, 'unknown');
    const blockers = this.arrayOfStrings(dataQuality?.blockers);
    const warnings = this.arrayOfStrings(dataQuality?.warnings);

    return {
      dashboardVersion: DASHBOARD_VERSION,
      generatedAt,
      readiness,
      cards: [
        {
          label: 'Data readiness',
          value: readiness,
          status: blockers.length > 0 ? 'blocked' : readiness === 'collecting_data' ? 'collecting_data' : 'ok',
          detail: blockers.length > 0 ? `${blockers.length} blocker(s) remain.` : 'Dataset readiness gate has no blockers.',
        },
        {
          label: 'Paper picks',
          value: counts.paperPicks,
          status: counts.paperPicks >= 50 ? 'ok' : 'collecting_data',
          detail: `${counts.settledPicks} settled pick(s), ${counts.labelableRows} labelable row(s).`,
        },
        {
          label: 'Odds observations',
          value: counts.oddsLineObservations,
          status: counts.oddsLineObservations >= 250 ? 'ok' : 'collecting_data',
          detail: `${counts.lineMovementObservations} line movement observation(s).`,
        },
        {
          label: 'Latest backtest rows',
          value: counts.backtestEligibleRows,
          status: counts.backtestEligibleRows >= 100 ? 'ok' : 'warning',
          detail: this.latestBacktestDetail(latestBacktest),
        },
        {
          label: 'ML training rows',
          value: counts.mlTrainingRows,
          status: counts.mlTrainingRows >= 100 ? 'ok' : 'blocked',
          detail: `Latest ML status: ${this.stringValue(latestMlModel?.status, 'missing')}.`,
        },
      ],
      counts,
      champion,
      latestMlModel,
      latestBacktest,
      latestCollectorRun,
      latestSchedulerRun,
      dataQuality,
      recommendations: this.arrayOfStrings(dataQuality?.recommendations).length
        ? this.arrayOfStrings(dataQuality?.recommendations)
        : this.defaultRecommendations(counts, warnings),
    };
  }

  async backtesting(limit = 10): Promise<DashboardBacktestingView> {
    await this.ensureStorage();
    const reports = await this.readJsonl<Record<string, unknown>>(BACKTESTING_RUNS_JSONL);
    const recentBacktests = reports.slice(-this.safeLimit(limit)).reverse();
    const bestRoiBacktest = [...reports]
      .filter((report) => this.numberValue(report.eligibleRows) > 0)
      .sort((a, b) => this.numberValue(b.roiPct) - this.numberValue(a.roiPct))[0] ?? null;
    const latestBacktest = await this.readJson(BACKTESTING_LATEST_JSON);

    return {
      dashboardVersion: DASHBOARD_VERSION,
      generatedAt: new Date().toISOString(),
      latestBacktest,
      recentBacktests,
      bestRoiBacktest,
      aggregate: {
        totalRuns: reports.length,
        totalEligibleRows: reports.reduce((sum, report) => sum + this.numberValue(report.eligibleRows), 0),
        bestRoiPct: bestRoiBacktest ? this.numberValue(bestRoiBacktest.roiPct) : null,
        latestRoiPct: latestBacktest ? this.numberValue(latestBacktest.roiPct) : null,
        latestProfitLoss: latestBacktest ? this.numberValue(latestBacktest.profitLoss) : null,
      },
    };
  }

  async collection(limit = 10): Promise<DashboardCollectionView> {
    await this.ensureStorage();
    const collectorRuns = await this.readJsonl<Record<string, unknown>>(COLLECTOR_RUNS_JSONL);
    const schedulerRuns = await this.readJsonl<Record<string, unknown>>(SCHEDULER_RUNS_JSONL);
    const paperPickCount = await this.countJsonl(PAPER_PICKS_JSONL);
    const oddsLineObservationCount = await this.countJsonl(ODDS_LINES_JSONL);
    const featureVectorCount = await this.countJsonl(FEATURES_JSONL);

    return {
      dashboardVersion: DASHBOARD_VERSION,
      generatedAt: new Date().toISOString(),
      latestCollectorRun: await this.readJson(COLLECTOR_LATEST_JSON),
      latestSchedulerRun: await this.readJson(SCHEDULER_LATEST_JSON),
      paperPickCount,
      oddsLineObservationCount,
      featureVectorCount,
      recentCollectorRuns: collectorRuns.slice(-this.safeLimit(limit)).reverse(),
      recentSchedulerRuns: schedulerRuns.slice(-this.safeLimit(limit)).reverse(),
    };
  }

  async models(limit = 10): Promise<DashboardModelView> {
    await this.ensureStorage();
    const champion = await this.readJson(MODEL_GOVERNANCE_CHAMPION_JSON);
    const latestMlModel = await this.readJson(ML_LATEST_MODEL_JSON);
    const latestGovernanceEvaluation = await this.readJson(MODEL_GOVERNANCE_LATEST_EVAL_JSON);
    const predictions = await this.readJsonl<Record<string, unknown>>(ML_PREDICTIONS_JSONL);

    return {
      dashboardVersion: DASHBOARD_VERSION,
      generatedAt: new Date().toISOString(),
      champion,
      latestMlModel,
      latestGovernanceEvaluation,
      recentMlPredictions: predictions.slice(-this.safeLimit(limit)).reverse(),
      modelSafety: {
        championActive: this.stringValue(champion?.status, 'missing') === 'active',
        challengerPromotable: latestGovernanceEvaluation?.promotable === true,
        latestMlStatus: latestMlModel ? this.stringValue(latestMlModel.status, null) : null,
        latestGovernanceStatus: latestGovernanceEvaluation ? this.stringValue(latestGovernanceEvaluation.status, null) : null,
      },
    };
  }

  async risks(): Promise<DashboardRiskView> {
    await this.ensureStorage();
    const dataQuality = await this.readJson(DATA_QUALITY_LATEST_JSON);
    const checks = Array.isArray(dataQuality?.checks) ? (dataQuality.checks as Record<string, unknown>[]) : [];

    return {
      dashboardVersion: DASHBOARD_VERSION,
      generatedAt: new Date().toISOString(),
      readiness: this.stringValue(dataQuality?.readiness, 'unknown'),
      blockers: this.arrayOfStrings(dataQuality?.blockers),
      warnings: this.arrayOfStrings(dataQuality?.warnings),
      failedChecks: checks.filter((check) => check.status === 'fail'),
      warnChecks: checks.filter((check) => check.status === 'warn'),
      recommendations: this.arrayOfStrings(dataQuality?.recommendations),
    };
  }

  private async counts(dataQuality: Record<string, unknown> | null): Promise<DashboardCounts> {
    const keyCounts = this.objectValue(dataQuality?.keyCounts);
    const counts = this.objectValue(dataQuality?.counts);
    const paperPicks = this.objectValue(counts?.paperPicks);
    const featureStore = this.objectValue(counts?.featureStore);
    const oddsHistory = this.objectValue(counts?.oddsHistory);
    const backtesting = this.objectValue(counts?.backtesting);
    const mlBaseline = this.objectValue(counts?.mlBaseline);

    return {
      paperPicks: this.numberValue(keyCounts?.paperPicks, this.numberValue(paperPicks?.total, await this.countJsonl(PAPER_PICKS_JSONL))),
      settledPicks: this.numberValue(keyCounts?.settledPicks, this.numberValue(paperPicks?.settled)),
      labelableRows: this.numberValue(keyCounts?.labelableRows, this.numberValue(featureStore?.labelableVectors)),
      featureVectors: this.numberValue(keyCounts?.featureVectors, this.numberValue(featureStore?.totalFeatureVectors, await this.countJsonl(FEATURES_JSONL))),
      oddsLineObservations: this.numberValue(keyCounts?.oddsLineObservations, this.numberValue(oddsHistory?.totalLineObservations, await this.countJsonl(ODDS_LINES_JSONL))),
      lineMovementObservations: this.numberValue(keyCounts?.lineMovementObservations, this.numberValue(oddsHistory?.lineMovementObservations)),
      backtestEligibleRows: this.numberValue(keyCounts?.latestBacktestEligibleRows, this.numberValue(backtesting?.latestEligibleRows)),
      mlTrainingRows: this.numberValue(keyCounts?.latestMlTrainingRows, this.numberValue(mlBaseline?.latestTrainingRows)),
    };
  }

  private latestBacktestDetail(backtest: Record<string, unknown> | null): string {
    if (!backtest) return 'No backtest run found yet.';
    return `ROI ${this.numberValue(backtest.roiPct)}%, P/L ${this.numberValue(backtest.profitLoss)}, rows ${this.numberValue(backtest.eligibleRows)}.`;
  }

  private defaultRecommendations(counts: DashboardCounts, warnings: string[]): string[] {
    const recommendations: string[] = [];
    if (counts.paperPicks < 50) recommendations.push('Run the collector until paper picks reach the minimum dataset threshold.');
    if (counts.labelableRows < 100) recommendations.push('Settle real win/loss outcomes to create labelable rows.');
    if (counts.oddsLineObservations < 250) recommendations.push('Keep repeated odds snapshots running to build line movement history.');
    if (warnings.length) recommendations.push(...warnings.slice(0, 5));
    return recommendations.length ? recommendations : ['Dashboard health is stable. Continue scheduled data collection.'];
  }

  private async ensureStorage() {
    await mkdir(join(DATA_ROOT, 'dashboard'), { recursive: true });
  }

  private async readJson(path: string): Promise<Record<string, unknown> | null> {
    if (!existsSync(path)) return null;
    const raw = await readFile(path, 'utf-8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  }

  private async readJsonl<T>(path: string): Promise<T[]> {
    if (!existsSync(path)) return [];
    const raw = await readFile(path, 'utf-8');
    if (!raw.trim()) return [];
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }

  private async countJsonl(path: string): Promise<number> {
    return (await this.readJsonl<Record<string, unknown>>(path)).length;
  }

  private safeLimit(limit: number): number {
    return Math.max(1, Math.min(Number.isFinite(limit) ? Math.floor(limit) : 10, 100));
  }

  private objectValue(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  }

  private stringValue(value: unknown, fallback: string): string;
  private stringValue(value: unknown, fallback: null): string | null;
  private stringValue(value: unknown, fallback: string | null): string | null {
    return typeof value === 'string' ? value : fallback;
  }

  private numberValue(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private arrayOfStrings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }
}
