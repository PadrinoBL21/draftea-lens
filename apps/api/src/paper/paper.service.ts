import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, readFile, readdir, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ScannerService } from '../scanner/scanner.service';
import { AutoScanCandidate, AutoScanResult } from '../scanner/scanner.types';
import { ScanAndSaveDto } from './dto/scan-and-save.dto';
import { PaperPick, PaperPickType, PaperScanAndSaveResult, PaperScanRecord } from './paper.types';

const MODEL_VERSION = 'consensus-ev-v0.1';
const DATA_DIR = join(process.cwd(), 'data', 'paper-ledger');
const SCANS_DIR = join(DATA_DIR, 'scans');
const PICKS_JSONL = join(DATA_DIR, 'paper-picks.jsonl');

@Injectable()
export class PaperService {
  constructor(private readonly scannerService: ScannerService) {}

  async scanAndSave(dto: ScanAndSaveDto): Promise<PaperScanAndSaveResult> {
    if (!Number.isFinite(dto.bankroll) || dto.bankroll <= 0) {
      throw new BadRequestException('bankroll must be a positive number.');
    }

    await this.ensureStorage();

    const scan = await this.scannerService.smartScan({ bankroll: dto.bankroll });
    const generatedAt = new Date().toISOString();
    const scanId = this.createId('scan', generatedAt);
    const maxPaperPicks = dto.maxPaperPicks ?? 10;

    const paperPicks = this.buildPaperPicks(scanId, generatedAt, dto.bankroll, scan, maxPaperPicks);
    const watchlist = scan.candidates.slice(0, Math.max(maxPaperPicks, 10));

    const record: PaperScanRecord = {
      scanId,
      generatedAt,
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
      paperPicks,
      watchlist,
    };

    const scanPath = join(SCANS_DIR, `${scanId}.json`);
    await writeFile(scanPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');

    for (const pick of paperPicks) {
      await appendFile(PICKS_JSONL, `${JSON.stringify(pick)}\n`, 'utf-8');
    }

    return {
      scanId,
      generatedAt,
      modelVersion: MODEL_VERSION,
      bankroll: dto.bankroll,
      paperPicks,
      watchlist,
      saved: {
        scanPath: this.relativePath(scanPath),
        picksPath: this.relativePath(PICKS_JSONL),
      },
      summary: {
        recommendation: paperPicks.length > 0 ? 'paper_picks_saved' : 'paper_watch_only',
        message:
          paperPicks.length > 0
            ? `Saved ${paperPicks.length} paper pick(s) for learning.`
            : 'No paper picks met the minimum rules, but the scan was saved for reference.',
      },
    };
  }

  async listLatestScans(limit = 10): Promise<PaperScanRecord[]> {
    await this.ensureStorage();
    const files = (await readdir(SCANS_DIR))
      .filter((file) => file.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, Math.max(1, Math.min(limit, 50)));

    const records: PaperScanRecord[] = [];
    for (const file of files) {
      const raw = await readFile(join(SCANS_DIR, file), 'utf-8');
      records.push(JSON.parse(raw) as PaperScanRecord);
    }

    return records;
  }

  async listLatestPicks(limit = 25): Promise<PaperPick[]> {
    await this.ensureStorage();
    if (!existsSync(PICKS_JSONL)) return [];

    const raw = await readFile(PICKS_JSONL, 'utf-8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-Math.max(1, Math.min(limit, 200)))
      .reverse()
      .map((line) => JSON.parse(line) as PaperPick);
  }

  private buildPaperPicks(
    scanId: string,
    generatedAt: string,
    bankroll: number,
    scan: AutoScanResult,
    maxPaperPicks: number,
  ): PaperPick[] {
    const learningUnit = this.round(Math.max(1, Math.min(bankroll * 0.001, bankroll * 0.005, 10)), 2);

    const positiveEv = scan.candidates
      .filter((candidate) => candidate.expectedValuePerUnit > 0)
      .sort((a, b) => this.paperRank(b) - this.paperRank(a));

    const picksSource = positiveEv.length > 0 ? positiveEv : scan.candidates.slice(0, 1);

    return picksSource.slice(0, maxPaperPicks).map((candidate, index) => {
      const type = this.paperPickType(candidate, positiveEv.length === 0);
      const conservativePaperStake = candidate.stakeSuggested > 0 ? candidate.stakeSuggested : learningUnit;

      return {
        paperPickId: this.createId(`paper_${index + 1}`, generatedAt),
        scanId,
        generatedAt,
        modelVersion: MODEL_VERSION,
        source: 'smart_scan_consensus_ev',
        type,
        status: 'open',
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
        averageOddsDecimal: candidate.averageOddsDecimal,
        consensusProbability: candidate.consensusProbability,
        fairOddsConsensus: candidate.fairOddsConsensus,
        edgeVsConsensus: candidate.edgeVsConsensus,
        expectedValuePerUnit: candidate.expectedValuePerUnit,
        kellyFractional: candidate.kellyFractional,
        scannerScore: candidate.score,
        scannerRecommendation: candidate.recommendation,
        paperStake: this.round(conservativePaperStake, 2),
        realStakeSuggested: candidate.recommendation === 'value_candidate' ? this.round(candidate.stakeSuggested, 2) : 0,
        learningEligible: true,
        reasons: [
          ...candidate.reasons,
          type === 'shadow_reference_pick'
            ? 'Paper-only reference pick forced for learning coverage; not a real betting recommendation.'
            : 'Paper-only pick saved for learning. Real stake remains gated by recommendation quality.',
        ],
        featuresSnapshot: candidate,
      };
    });
  }

  private paperPickType(candidate: AutoScanCandidate, forcedFallback: boolean): PaperPickType {
    if (forcedFallback) return 'shadow_reference_pick';
    if (candidate.recommendation === 'value_candidate') return 'value_paper_pick';
    return 'learning_probe';
  }

  private paperRank(candidate: AutoScanCandidate): number {
    const ev = Math.max(0, candidate.expectedValuePerUnit) * 100;
    const edge = Math.max(0, candidate.edgeVsConsensus) * 40;
    const liquidity = Math.min(candidate.bookmakerCount, 10) * 0.25;
    const marketQuality = candidate.bestBookmakerHoldPct === null ? 0 : Math.max(0, 0.07 - candidate.bestBookmakerHoldPct) * 50;
    return ev + edge + liquidity + marketQuality + candidate.score * 0.05;
  }

  private async ensureStorage(): Promise<void> {
    await mkdir(SCANS_DIR, { recursive: true });
    if (!existsSync(PICKS_JSONL)) {
      await writeFile(PICKS_JSONL, '', 'utf-8');
    }
  }

  private createId(prefix: string, isoDate: string): string {
    const stamp = isoDate.replace(/[-:.TZ]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${stamp}_${random}`;
  }

  private relativePath(path: string): string {
    return path.replace(process.cwd(), '.').replace(/\\/g, '/');
  }

  private round(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
