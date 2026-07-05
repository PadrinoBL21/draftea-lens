import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ScannerService } from '../scanner/scanner.service';
import { AutoScanCandidate } from '../scanner/scanner.types';
import { CreateOddsSnapshotDto } from './dto/create-odds-snapshot.dto';
import {
  CreateOddsSnapshotResult,
  OddsHistorySummary,
  OddsLineMovement,
  OddsLineSnapshot,
  OddsSnapshotRecord,
  OddsTrend,
} from './odds-history.types';

const MODEL_VERSION = 'odds-history-v0.1';
const DATA_DIR = join(process.cwd(), 'data', 'odds-history');
const SNAPSHOTS_DIR = join(DATA_DIR, 'snapshots');
const LINES_JSONL = join(DATA_DIR, 'odds-lines.jsonl');

@Injectable()
export class OddsHistoryService {
  constructor(private readonly scannerService: ScannerService) {}

  async createSnapshot(dto: CreateOddsSnapshotDto): Promise<CreateOddsSnapshotResult> {
    if (!Number.isFinite(dto.bankroll) || dto.bankroll <= 0) {
      throw new BadRequestException('bankroll must be a positive number.');
    }

    await this.ensureStorage();

    const scan = await this.scannerService.smartScan({ bankroll: dto.bankroll });
    const capturedAt = new Date().toISOString();
    const snapshotId = this.createId('odds_snapshot', capturedAt);
    const maxLines = dto.maxLines ?? 200;

    const lines = scan.candidates.slice(0, maxLines).map((candidate) => this.toLineSnapshot(snapshotId, capturedAt, candidate));

    const record: OddsSnapshotRecord = {
      snapshotId,
      capturedAt,
      modelVersion: MODEL_VERSION,
      bankroll: dto.bankroll,
      sourceScan: {
        scanner: scan.scanner,
        mode: scan.mode,
        scannedAt: scan.scannedAt,
        query: scan.query,
        usage: scan.usage,
        totals: scan.totals,
        summary: scan.summary,
      },
      lines,
    };

    const snapshotPath = join(SNAPSHOTS_DIR, `${snapshotId}.json`);
    await writeFile(snapshotPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');

    for (const line of lines) {
      await appendFile(LINES_JSONL, `${JSON.stringify(line)}\n`, 'utf-8');
    }

    return {
      snapshotId,
      capturedAt,
      modelVersion: MODEL_VERSION,
      bankroll: dto.bankroll,
      linesSaved: lines.length,
      lines,
      saved: {
        snapshotPath: this.relativePath(snapshotPath),
        historyPath: this.relativePath(LINES_JSONL),
      },
      summary: {
        recommendation: lines.length > 0 ? 'odds_history_saved' : 'odds_history_empty',
        message:
          lines.length > 0
            ? `Saved ${lines.length} odds line observation(s) for movement tracking.`
            : 'No scanner candidates were available, so no line observations were saved.',
      },
    };
  }

  async listLatestSnapshots(limit = 10): Promise<OddsSnapshotRecord[]> {
    await this.ensureStorage();
    const files = (await readdir(SNAPSHOTS_DIR))
      .filter((file) => file.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, Math.max(1, Math.min(limit, 50)));

    const snapshots: OddsSnapshotRecord[] = [];
    for (const file of files) {
      const raw = await readFile(join(SNAPSHOTS_DIR, file), 'utf-8');
      snapshots.push(JSON.parse(raw) as OddsSnapshotRecord);
    }

    return snapshots;
  }

  async listLines(options: { limit?: number; eventId?: string; lineId?: string }): Promise<OddsLineSnapshot[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
    const lines = await this.readAllLines();

    return lines
      .filter((line) => (options.eventId ? line.eventId === options.eventId : true))
      .filter((line) => (options.lineId ? line.lineId === options.lineId : true))
      .slice(-limit)
      .reverse();
  }

  async listMovements(limit = 25): Promise<OddsLineMovement[]> {
    const lines = await this.readAllLines();
    const movements = this.buildMovements(lines);
    return movements.slice(0, Math.max(1, Math.min(limit, 200)));
  }

  async summary(): Promise<OddsHistorySummary> {
    await this.ensureStorage();
    const snapshotFiles = (await readdir(SNAPSHOTS_DIR)).filter((file) => file.endsWith('.json'));
    const lines = await this.readAllLines();
    const uniqueLineIds = new Set(lines.map((line) => line.lineId));
    const sports = new Set(lines.map((line) => line.sportKey));
    const events = new Set(lines.map((line) => line.eventId));
    const latest = lines.length > 0 ? lines[lines.length - 1].capturedAt : null;

    return {
      totalSnapshots: snapshotFiles.length,
      totalLineObservations: lines.length,
      uniqueLines: uniqueLineIds.size,
      latestCapturedAt: latest,
      trackedSports: sports.size,
      trackedEvents: events.size,
      lineMovements: this.buildMovements(lines).filter((movement) => movement.observations > 1).length,
    };
  }

  private toLineSnapshot(snapshotId: string, capturedAt: string, candidate: AutoScanCandidate): OddsLineSnapshot {
    return {
      lineId: this.createLineId(candidate),
      snapshotId,
      capturedAt,
      modelVersion: MODEL_VERSION,
      source: 'smart_scan_consensus_ev',
      eventId: candidate.eventId,
      eventName: candidate.eventName,
      commenceTime: candidate.commenceTime,
      sportKey: candidate.sportKey,
      marketKey: candidate.marketKey,
      marketType: candidate.marketType,
      selection: candidate.selection,
      point: candidate.point,
      bestOddsDecimal: candidate.bestOddsDecimal,
      bestBookmaker: candidate.bestBookmaker,
      worstOddsDecimal: candidate.worstOddsDecimal,
      averageOddsDecimal: candidate.averageOddsDecimal,
      impliedProbabilityBest: candidate.impliedProbabilityBest,
      consensusImpliedProbability: candidate.consensusImpliedProbability,
      consensusProbability: candidate.consensusProbability,
      fairOddsConsensus: candidate.fairOddsConsensus,
      edgeVsConsensus: candidate.edgeVsConsensus,
      expectedValuePerUnit: candidate.expectedValuePerUnit,
      bookmakerCount: candidate.bookmakerCount,
      priceSpreadPct: candidate.priceSpreadPct,
      marketHoldPct: candidate.bestBookmakerHoldPct,
      scannerScore: candidate.score,
      scannerRecommendation: candidate.recommendation,
      featuresSnapshot: candidate,
    };
  }

  private buildMovements(lines: OddsLineSnapshot[]): OddsLineMovement[] {
    const grouped = new Map<string, OddsLineSnapshot[]>();
    for (const line of lines) {
      const existing = grouped.get(line.lineId) ?? [];
      existing.push(line);
      grouped.set(line.lineId, existing);
    }

    return [...grouped.values()]
      .map((observations) => observations.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)))
      .map((observations) => this.toMovement(observations))
      .sort((a, b) => Math.abs(b.oddsChangePct) - Math.abs(a.oddsChangePct));
  }

  private toMovement(observations: OddsLineSnapshot[]): OddsLineMovement {
    const first = observations[0];
    const latest = observations[observations.length - 1];
    const oddsChange = this.round(latest.bestOddsDecimal - first.bestOddsDecimal, 4);
    const oddsChangePct = this.round(first.bestOddsDecimal > 0 ? oddsChange / first.bestOddsDecimal : 0, 4);
    const impliedProbabilityChange = this.round(latest.impliedProbabilityBest - first.impliedProbabilityBest, 4);
    const consensusProbabilityChange = this.round(latest.consensusProbability - first.consensusProbability, 4);
    const expectedValueChange = this.round(latest.expectedValuePerUnit - first.expectedValuePerUnit, 4);

    return {
      lineId: latest.lineId,
      eventId: latest.eventId,
      eventName: latest.eventName,
      commenceTime: latest.commenceTime,
      sportKey: latest.sportKey,
      marketKey: latest.marketKey,
      marketType: latest.marketType,
      selection: latest.selection,
      point: latest.point,
      observations: observations.length,
      firstCapturedAt: first.capturedAt,
      latestCapturedAt: latest.capturedAt,
      firstOddsDecimal: first.bestOddsDecimal,
      latestOddsDecimal: latest.bestOddsDecimal,
      oddsChange,
      oddsChangePct,
      impliedProbabilityChange,
      consensusProbabilityChange,
      expectedValueChange,
      firstBookmaker: first.bestBookmaker,
      latestBookmaker: latest.bestBookmaker,
      bestBookmakerChanged: first.bestBookmaker !== latest.bestBookmaker,
      trend: this.trend(first.bestOddsDecimal, latest.bestOddsDecimal),
    };
  }

  private trend(firstOdds: number, latestOdds: number): OddsTrend {
    const change = latestOdds - firstOdds;
    if (Math.abs(change) < 0.001) return 'flat';
    return change < 0 ? 'shortening' : 'drifting';
  }

  private async readAllLines(): Promise<OddsLineSnapshot[]> {
    await this.ensureStorage();
    if (!existsSync(LINES_JSONL)) return [];

    const raw = await readFile(LINES_JSONL, 'utf-8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as OddsLineSnapshot);
  }

  private async ensureStorage(): Promise<void> {
    await mkdir(SNAPSHOTS_DIR, { recursive: true });
    if (!existsSync(LINES_JSONL)) {
      await writeFile(LINES_JSONL, '', 'utf-8');
    }
  }

  private createLineId(candidate: AutoScanCandidate): string {
    const point = typeof candidate.point === 'number' ? String(candidate.point) : 'na';
    return [candidate.eventId, candidate.marketKey, candidate.marketType, candidate.selection, point]
      .map((part) => this.slug(String(part)))
      .join('__');
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
