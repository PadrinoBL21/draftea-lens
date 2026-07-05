import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OddsLineSnapshot } from '../odds-history/odds-history.types';
import { PaperPick } from '../paper/paper.types';
import { RebuildFeatureStoreDto } from './dto/rebuild-feature-store.dto';
import {
  FeatureStoreRebuildResult,
  FeatureStoreSummary,
  FeatureVector,
  FeatureVectorSource,
  FeatureVectorTrend,
} from './feature-store.types';

const FEATURE_STORE_VERSION = 'feature-store-v0.1';
const PAPER_LEDGER_DIR = join(process.cwd(), 'data', 'paper-ledger');
const PAPER_PICKS_JSONL = join(PAPER_LEDGER_DIR, 'paper-picks.jsonl');
const ODDS_HISTORY_DIR = join(process.cwd(), 'data', 'odds-history');
const ODDS_LINES_JSONL = join(ODDS_HISTORY_DIR, 'odds-lines.jsonl');
const DATA_DIR = join(process.cwd(), 'data', 'feature-store');
const FEATURES_JSONL = join(DATA_DIR, 'features.jsonl');
const MANIFEST_JSON = join(DATA_DIR, 'latest-rebuild.json');

@Injectable()
export class FeatureStoreService {
  async rebuild(dto: RebuildFeatureStoreDto): Promise<FeatureStoreRebuildResult> {
    const includePaperPicks = dto.includePaperPicks ?? true;
    const includeOddsLines = dto.includeOddsLines ?? true;
    const maxVectors = Math.max(1, Math.min(dto.maxVectors ?? 5000, 50000));

    if (!includePaperPicks && !includeOddsLines) {
      throw new BadRequestException('At least one source must be enabled.');
    }

    await this.ensureStorage();

    const createdAt = new Date().toISOString();
    const rebuildId = this.createId('feature_rebuild', createdAt);
    const paperPicks = includePaperPicks ? await this.readJsonl<PaperPick>(PAPER_PICKS_JSONL) : [];
    const oddsLines = includeOddsLines ? await this.readJsonl<OddsLineSnapshot>(ODDS_LINES_JSONL) : [];
    const movementByLine = this.buildMovementMap(oddsLines);

    const vectors: FeatureVector[] = [];

    if (includePaperPicks) {
      for (const pick of paperPicks) {
        vectors.push(this.fromPaperPick(pick, createdAt, movementByLine.get(this.createLineIdFromPick(pick))));
      }
    }

    if (includeOddsLines) {
      const latestLines = this.latestLineSnapshots(oddsLines);
      for (const line of latestLines) {
        vectors.push(this.fromOddsLine(line, createdAt, movementByLine.get(line.lineId)));
      }
    }

    const cappedVectors = vectors.slice(-maxVectors);
    await writeFile(FEATURES_JSONL, cappedVectors.map((vector) => JSON.stringify(vector)).join('\n') + (cappedVectors.length ? '\n' : ''), 'utf-8');

    const summary = this.summarize(cappedVectors);
    const result: FeatureStoreRebuildResult = {
      rebuildId,
      createdAt,
      featureStoreVersion: FEATURE_STORE_VERSION,
      vectorsBuilt: cappedVectors.length,
      paperPickVectors: cappedVectors.filter((vector) => vector.source === 'paper_pick').length,
      oddsLineVectors: cappedVectors.filter((vector) => vector.source === 'odds_line').length,
      saved: {
        featuresPath: this.relativePath(FEATURES_JSONL),
        manifestPath: this.relativePath(MANIFEST_JSON),
      },
      sample: cappedVectors.slice(0, 5),
      summary,
    };

    await writeFile(MANIFEST_JSON, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
    return result;
  }

  async listFeatures(options: { limit?: number; source?: string }): Promise<FeatureVector[]> {
    const vectors = await this.readFeatures();
    const limit = Math.max(1, Math.min(options.limit ?? 50, 1000));
    const source = options.source as FeatureVectorSource | undefined;

    return vectors
      .filter((vector) => (source ? vector.source === source : true))
      .slice(-limit)
      .reverse();
  }

  async dataset(options: { limit?: number; outcomeKnownOnly?: boolean }): Promise<FeatureVector[]> {
    const vectors = await this.readFeatures();
    const limit = Math.max(1, Math.min(options.limit ?? 200, 10000));

    return vectors
      .filter((vector) => (options.outcomeKnownOnly ? vector.outcomeKnown : true))
      .slice(-limit)
      .reverse();
  }

  async summary(): Promise<FeatureStoreSummary> {
    const vectors = await this.readFeatures();
    return this.summarize(vectors);
  }

  private fromPaperPick(
    pick: PaperPick,
    createdAt: string,
    movement: FeatureMovement | undefined,
  ): FeatureVector {
    const snapshot = pick.featuresSnapshot;
    const labelWin = this.labelWin(pick);

    return {
      featureVectorId: this.featureId('paper_pick', pick.paperPickId),
      createdAt,
      featureStoreVersion: FEATURE_STORE_VERSION,
      source: 'paper_pick',
      sourceId: pick.paperPickId,
      eventId: pick.eventId,
      eventName: pick.eventName,
      commenceTime: pick.commenceTime,
      sportKey: pick.sportKey,
      marketKey: pick.marketKey,
      marketType: pick.marketType,
      selection: pick.selection,
      point: pick.point,
      bestOddsDecimal: pick.bestOddsDecimal,
      averageOddsDecimal: pick.averageOddsDecimal,
      consensusProbability: pick.consensusProbability,
      fairOddsConsensus: pick.fairOddsConsensus,
      edgeVsConsensus: pick.edgeVsConsensus,
      expectedValuePerUnit: pick.expectedValuePerUnit,
      bookmakerCount: snapshot.bookmakerCount,
      priceSpreadPct: snapshot.priceSpreadPct,
      marketHoldPct: snapshot.bestBookmakerHoldPct,
      scannerScore: pick.scannerScore,
      scannerRecommendation: pick.scannerRecommendation,
      lineId: this.createLineIdFromPick(pick),
      ...this.movementFeatures(movement),
      paperPickId: pick.paperPickId,
      paperStake: pick.paperStake,
      realStakeSuggested: pick.realStakeSuggested,
      paperStatus: pick.status,
      settlementResult: pick.settlement?.result,
      paperProfitLoss: pick.settlement?.paperProfitLoss,
      closingLineValue: pick.settlement?.closingLineValue,
      outcomeKnown: pick.status === 'settled' || pick.status === 'void',
      labelWin,
      labelProfitLoss: pick.settlement?.paperProfitLoss ?? null,
      labelClosingLineValue: pick.settlement?.closingLineValue ?? null,
    };
  }

  private fromOddsLine(
    line: OddsLineSnapshot,
    createdAt: string,
    movement: FeatureMovement | undefined,
  ): FeatureVector {
    return {
      featureVectorId: this.featureId('odds_line', line.lineId),
      createdAt,
      featureStoreVersion: FEATURE_STORE_VERSION,
      source: 'odds_line',
      sourceId: line.lineId,
      eventId: line.eventId,
      eventName: line.eventName,
      commenceTime: line.commenceTime,
      sportKey: line.sportKey,
      marketKey: line.marketKey,
      marketType: line.marketType,
      selection: line.selection,
      point: line.point,
      bestOddsDecimal: line.bestOddsDecimal,
      averageOddsDecimal: line.averageOddsDecimal,
      consensusProbability: line.consensusProbability,
      fairOddsConsensus: line.fairOddsConsensus,
      edgeVsConsensus: line.edgeVsConsensus,
      expectedValuePerUnit: line.expectedValuePerUnit,
      bookmakerCount: line.bookmakerCount,
      priceSpreadPct: line.priceSpreadPct,
      marketHoldPct: line.marketHoldPct,
      scannerScore: line.scannerScore,
      scannerRecommendation: line.scannerRecommendation,
      lineId: line.lineId,
      ...this.movementFeatures(movement),
      outcomeKnown: false,
      labelWin: null,
      labelProfitLoss: null,
      labelClosingLineValue: null,
    };
  }

  private buildMovementMap(lines: OddsLineSnapshot[]): Map<string, FeatureMovement> {
    const grouped = new Map<string, OddsLineSnapshot[]>();
    for (const line of lines) {
      const existing = grouped.get(line.lineId) ?? [];
      existing.push(line);
      grouped.set(line.lineId, existing);
    }

    const movements = new Map<string, FeatureMovement>();
    for (const [lineId, observations] of grouped.entries()) {
      const sorted = observations.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      const first = sorted[0];
      const latest = sorted[sorted.length - 1];
      const oddsChange = latest.bestOddsDecimal - first.bestOddsDecimal;
      const oddsChangePct = first.bestOddsDecimal > 0 ? oddsChange / first.bestOddsDecimal : 0;

      movements.set(lineId, {
        lineObservationCount: sorted.length,
        oddsChangePct: this.round(oddsChangePct, 4),
        impliedProbabilityChange: this.round(latest.impliedProbabilityBest - first.impliedProbabilityBest, 4),
        consensusProbabilityChange: this.round(latest.consensusProbability - first.consensusProbability, 4),
        expectedValueChange: this.round(latest.expectedValuePerUnit - first.expectedValuePerUnit, 4),
        trend: this.trend(first.bestOddsDecimal, latest.bestOddsDecimal),
      });
    }

    return movements;
  }

  private latestLineSnapshots(lines: OddsLineSnapshot[]): OddsLineSnapshot[] {
    const latestByLine = new Map<string, OddsLineSnapshot>();
    for (const line of lines) {
      const current = latestByLine.get(line.lineId);
      if (!current || line.capturedAt.localeCompare(current.capturedAt) > 0) {
        latestByLine.set(line.lineId, line);
      }
    }

    return [...latestByLine.values()].sort((a, b) => a.lineId.localeCompare(b.lineId));
  }

  private movementFeatures(movement: FeatureMovement | undefined) {
    return {
      lineObservationCount: movement?.lineObservationCount ?? 0,
      oddsChangePct: movement?.oddsChangePct ?? 0,
      impliedProbabilityChange: movement?.impliedProbabilityChange ?? 0,
      consensusProbabilityChange: movement?.consensusProbabilityChange ?? 0,
      expectedValueChange: movement?.expectedValueChange ?? 0,
      trend: movement?.trend ?? 'unknown',
    };
  }

  private labelWin(pick: PaperPick): number | null {
    const result = pick.settlement?.result;
    if (!result || result === 'void' || result === 'push') return null;
    if (result === 'win' || result === 'half_win') return 1;
    if (result === 'loss' || result === 'half_loss') return 0;
    return null;
  }

  private summarize(vectors: FeatureVector[]): FeatureStoreSummary {
    const sports = new Set(vectors.map((vector) => vector.sportKey));
    const events = new Set(vectors.map((vector) => vector.eventId));
    const trendCounts: Record<FeatureVectorTrend, number> = {
      shortening: 0,
      drifting: 0,
      flat: 0,
      unknown: 0,
    };

    for (const vector of vectors) {
      trendCounts[vector.trend] += 1;
    }

    return {
      featureStoreVersion: FEATURE_STORE_VERSION,
      totalFeatureVectors: vectors.length,
      paperPickVectors: vectors.filter((vector) => vector.source === 'paper_pick').length,
      oddsLineVectors: vectors.filter((vector) => vector.source === 'odds_line').length,
      outcomeKnownVectors: vectors.filter((vector) => vector.outcomeKnown).length,
      positiveEvVectors: vectors.filter((vector) => vector.expectedValuePerUnit > 0).length,
      valueCandidateVectors: vectors.filter((vector) => vector.scannerRecommendation === 'value_candidate').length,
      latestCreatedAt: vectors.length > 0 ? vectors[vectors.length - 1].createdAt : null,
      trackedSports: sports.size,
      trackedEvents: events.size,
      trendCounts,
    };
  }

  private async readFeatures(): Promise<FeatureVector[]> {
    await this.ensureStorage();
    return this.readJsonl<FeatureVector>(FEATURES_JSONL);
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
    if (!existsSync(FEATURES_JSONL)) {
      await writeFile(FEATURES_JSONL, '', 'utf-8');
    }
  }

  private createLineIdFromPick(pick: PaperPick): string {
    const point = typeof pick.point === 'number' ? String(pick.point) : 'na';
    return [pick.eventId, pick.marketKey, pick.marketType, pick.selection, point]
      .map((part) => this.slug(String(part)))
      .join('__');
  }

  private featureId(source: FeatureVectorSource, sourceId: string): string {
    return `${source}__${this.slug(sourceId)}`;
  }

  private trend(firstOdds: number, latestOdds: number): FeatureVectorTrend {
    const change = latestOdds - firstOdds;
    if (Math.abs(change) < 0.001) return 'flat';
    return change < 0 ? 'shortening' : 'drifting';
  }

  private createId(prefix: string, isoDate: string): string {
    const stamp = isoDate.replace(/[-:.TZ]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${stamp}_${random}`;
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private relativePath(path: string): string {
    return path.replace(process.cwd(), '.').replace(/\\/g, '/');
  }

  private round(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}

interface FeatureMovement {
  lineObservationCount: number;
  oddsChangePct: number;
  impliedProbabilityChange: number;
  consensusProbabilityChange: number;
  expectedValueChange: number;
  trend: FeatureVectorTrend;
}
