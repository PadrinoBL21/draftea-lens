import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FeatureVector } from '../feature-store/feature-store.types';
import { RunBacktestDto } from './dto/run-backtest.dto';
import {
  BacktestBucketSummary,
  BacktestFilters,
  BacktestReport,
  BacktestResult,
  BacktestTrade,
  BacktestingSummary,
} from './backtesting.types';

const BACKTEST_VERSION = 'backtesting-v0.1';
const FEATURE_STORE_DIR = join(process.cwd(), 'data', 'feature-store');
const FEATURES_JSONL = join(FEATURE_STORE_DIR, 'features.jsonl');
const DATA_DIR = join(process.cwd(), 'data', 'backtesting');
const REPORTS_JSONL = join(DATA_DIR, 'backtest-runs.jsonl');
const LATEST_RUN_JSON = join(DATA_DIR, 'latest-run.json');

@Injectable()
export class BacktestingService {
  async run(dto: RunBacktestDto): Promise<BacktestReport> {
    await this.ensureStorage();

    const filters = this.normalizeFilters(dto);
    const allVectors = await this.readJsonl<FeatureVector>(FEATURES_JSONL);
    const filtered = this.applyFilters(allVectors, filters).slice(-filters.maxRows);
    const trades = filtered
      .filter((vector) => this.isEligibleForBacktest(vector))
      .map((vector) => this.toTrade(vector, filters));

    const generatedAt = new Date().toISOString();
    const runId = this.createId('backtest', generatedAt);
    const aggregate = this.aggregate(trades);

    const report: BacktestReport = {
      runId,
      generatedAt,
      backtestVersion: BACKTEST_VERSION,
      filters,
      rowsConsidered: filtered.length,
      eligibleRows: trades.length,
      skippedRows: filtered.length - trades.length,
      ...aggregate,
      byMarketType: this.bucketize(trades, (trade) => trade.marketType),
      bySport: this.bucketize(trades, (trade) => trade.sportKey),
      sampleTrades: trades.slice(0, 25),
      saved: {
        reportsPath: this.relativePath(REPORTS_JSONL),
        latestRunPath: this.relativePath(LATEST_RUN_JSON),
      },
    };

    await this.appendJsonl(REPORTS_JSONL, report);
    await writeFile(LATEST_RUN_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
    return report;
  }

  async listRuns(limit = 20): Promise<BacktestReport[]> {
    await this.ensureStorage();
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const reports = await this.readJsonl<BacktestReport>(REPORTS_JSONL);
    return reports.slice(-safeLimit).reverse();
  }

  async latest(): Promise<BacktestReport | null> {
    await this.ensureStorage();
    if (!existsSync(LATEST_RUN_JSON)) return null;
    const raw = await readFile(LATEST_RUN_JSON, 'utf-8');
    return raw.trim() ? (JSON.parse(raw) as BacktestReport) : null;
  }

  async summary(): Promise<BacktestingSummary> {
    await this.ensureStorage();
    const reports = await this.readJsonl<BacktestReport>(REPORTS_JSONL);
    const best = [...reports]
      .filter((report) => report.eligibleRows > 0)
      .sort((a, b) => b.roiPct - a.roiPct)[0];
    const latest = reports[reports.length - 1];

    return {
      backtestVersion: BACKTEST_VERSION,
      totalRuns: reports.length,
      latestRunId: latest?.runId ?? null,
      latestGeneratedAt: latest?.generatedAt ?? null,
      bestRoiRunId: best?.runId ?? null,
      bestRoiPct: best?.roiPct ?? null,
      totalEligibleRowsAcrossRuns: reports.reduce((sum, report) => sum + report.eligibleRows, 0),
    };
  }

  private normalizeFilters(dto: RunBacktestDto): BacktestFilters {
    return {
      source: dto.source ?? 'paper_pick',
      sportKey: this.blankToUndefined(dto.sportKey),
      marketType: this.blankToUndefined(dto.marketType),
      trend: dto.trend ?? 'all',
      outcomeKnownOnly: dto.outcomeKnownOnly ?? true,
      minExpectedValue: dto.minExpectedValue ?? Number.NEGATIVE_INFINITY,
      minScannerScore: dto.minScannerScore ?? 0,
      stakingMode: dto.stakingMode ?? 'flat',
      flatStake: this.round(dto.flatStake ?? 1, 2),
      maxRows: Math.max(1, Math.min(dto.maxRows ?? 10000, 100000)),
    };
  }

  private applyFilters(vectors: FeatureVector[], filters: BacktestFilters): FeatureVector[] {
    return vectors.filter((vector) => {
      if (filters.source !== 'all' && vector.source !== filters.source) return false;
      if (filters.sportKey && vector.sportKey !== filters.sportKey) return false;
      if (filters.marketType && vector.marketType !== filters.marketType) return false;
      if (filters.trend !== 'all' && vector.trend !== filters.trend) return false;
      if (filters.outcomeKnownOnly && !vector.outcomeKnown) return false;
      if (vector.expectedValuePerUnit < filters.minExpectedValue) return false;
      if (vector.scannerScore < filters.minScannerScore) return false;
      return true;
    });
  }

  private isEligibleForBacktest(vector: FeatureVector): boolean {
    const result = vector.settlementResult as BacktestResult | undefined;
    if (!result) return false;
    return ['win', 'loss', 'push', 'void', 'half_win', 'half_loss'].includes(result);
  }

  private toTrade(vector: FeatureVector, filters: BacktestFilters): BacktestTrade {
    const result = vector.settlementResult as BacktestResult;
    const simulatedStake = this.stakeFor(vector, filters);
    const simulatedProfitLoss = this.profitLoss(result, vector.bestOddsDecimal, simulatedStake);
    const closingLineValue = typeof vector.closingLineValue === 'number' ? vector.closingLineValue : null;

    return {
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
      oddsDecimal: vector.bestOddsDecimal,
      expectedValuePerUnit: vector.expectedValuePerUnit,
      scannerScore: vector.scannerScore,
      trend: vector.trend,
      settlementResult: result,
      simulatedStake,
      simulatedProfitLoss,
      bankrollAfter: 0,
      closingLineValue,
    };
  }

  private stakeFor(vector: FeatureVector, filters: BacktestFilters): number {
    if (filters.stakingMode === 'paper') {
      return this.round(vector.paperStake && vector.paperStake > 0 ? vector.paperStake : filters.flatStake, 2);
    }

    if (filters.stakingMode === 'ev_scaled') {
      const evScale = Math.max(0.25, Math.min(3, Math.max(0, vector.expectedValuePerUnit) * 100));
      return this.round(filters.flatStake * evScale, 2);
    }

    return filters.flatStake;
  }

  private profitLoss(result: BacktestResult, oddsDecimal: number, stake: number): number {
    if (result === 'win') return this.round((oddsDecimal - 1) * stake, 2);
    if (result === 'loss') return this.round(-stake, 2);
    if (result === 'half_win') return this.round(((oddsDecimal - 1) * stake) / 2, 2);
    if (result === 'half_loss') return this.round(-stake / 2, 2);
    return 0;
  }

  private aggregate(trades: BacktestTrade[]) {
    let bankroll = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let totalStake = 0;
    let profitLoss = 0;

    for (const trade of trades) {
      totalStake += trade.simulatedStake;
      profitLoss += trade.simulatedProfitLoss;
      bankroll += trade.simulatedProfitLoss;
      peak = Math.max(peak, bankroll);
      maxDrawdown = Math.min(maxDrawdown, bankroll - peak);
      trade.bankrollAfter = this.round(bankroll, 2);
    }

    const wins = trades.filter((trade) => trade.settlementResult === 'win').length;
    const losses = trades.filter((trade) => trade.settlementResult === 'loss').length;
    const pushes = trades.filter((trade) => trade.settlementResult === 'push').length;
    const voids = trades.filter((trade) => trade.settlementResult === 'void').length;
    const halfWins = trades.filter((trade) => trade.settlementResult === 'half_win').length;
    const halfLosses = trades.filter((trade) => trade.settlementResult === 'half_loss').length;
    const decisionCount = wins + losses + halfWins + halfLosses;
    const hitRatePct = decisionCount > 0 ? ((wins + halfWins) / decisionCount) * 100 : 0;

    return {
      wins,
      losses,
      pushes,
      voids,
      halfWins,
      halfLosses,
      totalStake: this.round(totalStake, 2),
      profitLoss: this.round(profitLoss, 2),
      roiPct: totalStake > 0 ? this.round((profitLoss / totalStake) * 100, 2) : 0,
      hitRatePct: this.round(hitRatePct, 2),
      averageOddsDecimal: this.average(trades.map((trade) => trade.oddsDecimal)),
      averageExpectedValue: this.average(trades.map((trade) => trade.expectedValuePerUnit)),
      averageClosingLineValue: this.average(trades.map((trade) => trade.closingLineValue).filter((value): value is number => typeof value === 'number')),
      maxDrawdown: this.round(maxDrawdown, 2),
    };
  }

  private bucketize(trades: BacktestTrade[], keyFn: (trade: BacktestTrade) => string): Record<string, BacktestBucketSummary> {
    const groups = new Map<string, BacktestTrade[]>();
    for (const trade of trades) {
      const key = keyFn(trade) || 'unknown';
      groups.set(key, [...(groups.get(key) ?? []), trade]);
    }

    const output: Record<string, BacktestBucketSummary> = {};
    for (const [key, group] of groups.entries()) {
      const aggregate = this.aggregate(group);
      output[key] = {
        count: group.length,
        wins: aggregate.wins,
        losses: aggregate.losses,
        pushes: aggregate.pushes,
        voids: aggregate.voids,
        halfWins: aggregate.halfWins,
        halfLosses: aggregate.halfLosses,
        totalStake: aggregate.totalStake,
        profitLoss: aggregate.profitLoss,
        roiPct: aggregate.roiPct,
        hitRatePct: aggregate.hitRatePct,
        averageExpectedValue: aggregate.averageExpectedValue ?? 0,
        averageClosingLineValue: aggregate.averageClosingLineValue,
      };
    }

    return output;
  }

  private async ensureStorage(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    if (!existsSync(REPORTS_JSONL)) {
      await writeFile(REPORTS_JSONL, '', 'utf-8');
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

  private async appendJsonl(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value)}\n`, { flag: 'a', encoding: 'utf-8' });
  }

  private createId(prefix: string, isoDate: string): string {
    const stamp = isoDate.replace(/[-:.TZ]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${stamp}_${random}`;
  }

  private blankToUndefined(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private average(values: number[]): number | null {
    if (values.length === 0) return null;
    return this.round(values.reduce((sum, value) => sum + value, 0) / values.length, 4);
  }

  private relativePath(path: string): string {
    return path.replace(process.cwd(), '.').replace(/\\/g, '/');
  }

  private round(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
