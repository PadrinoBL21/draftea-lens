import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataQualityService } from '../data-quality/data-quality.service';
import { FeatureStoreService } from '../feature-store/feature-store.service';
import { PaperService } from '../paper/paper.service';
import { PaperPick, PaperSettlementResult } from '../paper/paper.types';
import { ApplySettlementsDto } from './dto/apply-settlements.dto';
import { PreviewSettlementAssistantDto } from './dto/preview-settlement-assistant.dto';
import {
  SettlementAssistantApplyResult,
  SettlementAssistantApplyResultItem,
  SettlementAssistantCandidate,
  SettlementAssistantPreview,
  SettlementAssistantSummary,
} from './settlement-assistant.types';

const ASSISTANT_VERSION = 'settlement-assistant-v0.1';
const DATA_DIR = join(process.cwd(), 'data', 'settlement-assistant');
const RUNS_JSONL = join(DATA_DIR, 'runs.jsonl');
const LATEST_RUN_JSON = join(DATA_DIR, 'latest-run.json');
const ALLOWED_RESULTS: PaperSettlementResult[] = ['win', 'loss', 'push', 'void', 'half_win', 'half_loss'];

@Injectable()
export class SettlementAssistantService {
  constructor(
    private readonly paperService: PaperService,
    private readonly featureStoreService: FeatureStoreService,
    private readonly dataQualityService: DataQualityService,
  ) {}

  async preview(dto: PreviewSettlementAssistantDto = {}): Promise<SettlementAssistantPreview> {
    const generatedAt = new Date().toISOString();
    const settleAfterHours = this.clamp(dto.settleAfterHours ?? 2.5, 0, 168);
    const staleAfterHours = this.clamp(dto.staleAfterHours ?? 72, 1, 720);
    const limit = Math.max(1, Math.min(dto.limit ?? 50, 500));

    const openPicks = await this.paperService.listOpenPicks(500);
    const candidates = openPicks
      .filter((pick) => (dto.sportKey ? pick.sportKey === dto.sportKey : true))
      .filter((pick) => (dto.marketType ? pick.marketType === dto.marketType : true))
      .map((pick) => this.toCandidate(pick, generatedAt, settleAfterHours, staleAfterHours))
      .filter((candidate) => (dto.includeFuture ? true : candidate.status !== 'upcoming'))
      .sort((a, b) => this.rankCandidate(a) - this.rankCandidate(b))
      .slice(0, limit);

    return {
      generatedAt,
      assistantVersion: ASSISTANT_VERSION,
      settleAfterHours,
      staleAfterHours,
      totalOpenPicks: openPicks.length,
      dueCount: candidates.filter((candidate) => candidate.status === 'due').length,
      upcomingCount: candidates.filter((candidate) => candidate.status === 'upcoming').length,
      staleCount: candidates.filter((candidate) => candidate.status === 'stale').length,
      candidates,
    };
  }

  async apply(dto: ApplySettlementsDto): Promise<SettlementAssistantApplyResult> {
    if (!dto.settlements?.length) {
      throw new BadRequestException('settlements must contain at least one item.');
    }

    await this.ensureStorage();

    const appliedAt = new Date().toISOString();
    const runId = this.createId('settlement_assistant_run', appliedAt);
    const results: SettlementAssistantApplyResultItem[] = [];
    const seen = new Set<string>();

    for (const item of dto.settlements) {
      if (seen.has(item.paperPickId)) {
        results.push({
          paperPickId: item.paperPickId,
          status: 'failed',
          error: 'Duplicate paperPickId in same settlement batch.',
        });
        continue;
      }
      seen.add(item.paperPickId);

      try {
        const notes = [dto.notesPrefix, item.notes].filter(Boolean).join(' | ') || undefined;
        const settledPick = await this.paperService.settlePick({
          paperPickId: item.paperPickId,
          result: item.result,
          closingOdds: item.closingOdds,
          closingLineValue: item.closingLineValue,
          notes,
        });

        results.push({
          paperPickId: item.paperPickId,
          status: 'settled',
          result: item.result,
          settledPick,
        });
      } catch (error) {
        results.push({
          paperPickId: item.paperPickId,
          status: 'failed',
          result: item.result,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const postSettlement: SettlementAssistantApplyResult['postSettlement'] = {};
    const settledCount = results.filter((result) => result.status === 'settled').length;

    if (settledCount > 0 && (dto.rebuildFeatureStore ?? true)) {
      const rebuild = await this.featureStoreService.rebuild({
        includePaperPicks: true,
        includeOddsLines: true,
        maxVectors: dto.maxFeatureVectors ?? 5000,
      });
      postSettlement.featureRebuildId = rebuild.rebuildId;
      postSettlement.featureVectorsBuilt = rebuild.vectorsBuilt;
    }

    if (settledCount > 0 && (dto.auditDataQuality ?? true)) {
      const audit = await this.dataQualityService.audit({ persist: dto.persistDataQualityAudit ?? true });
      postSettlement.dataQualityAuditId = audit.auditId;
      postSettlement.dataQualityReadiness = audit.readiness;
      postSettlement.blockerCount = audit.blockers.length;
      postSettlement.warningCount = audit.warnings.length;
    }

    const result: SettlementAssistantApplyResult = {
      runId,
      appliedAt,
      assistantVersion: ASSISTANT_VERSION,
      status: results.some((item) => item.status === 'failed') ? 'completed_with_errors' : 'completed',
      requested: dto.settlements.length,
      settled: settledCount,
      failed: results.filter((item) => item.status === 'failed').length,
      results,
      postSettlement,
      saved: {
        runsPath: this.relativePath(RUNS_JSONL),
        latestRunPath: this.relativePath(LATEST_RUN_JSON),
      },
    };

    await appendFile(RUNS_JSONL, `${JSON.stringify(result)}\n`, 'utf-8');
    await writeFile(LATEST_RUN_JSON, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');

    return result;
  }

  async latest(): Promise<SettlementAssistantApplyResult | null> {
    await this.ensureStorage();
    if (!existsSync(LATEST_RUN_JSON)) return null;
    const raw = await readFile(LATEST_RUN_JSON, 'utf-8');
    return JSON.parse(raw) as SettlementAssistantApplyResult;
  }

  async runs(limit = 20): Promise<SettlementAssistantApplyResult[]> {
    await this.ensureStorage();
    if (!existsSync(RUNS_JSONL)) return [];
    const raw = await readFile(RUNS_JSONL, 'utf-8');
    const runs = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SettlementAssistantApplyResult);

    return runs.slice(-Math.max(1, Math.min(limit, 200))).reverse();
  }

  async summary(): Promise<SettlementAssistantSummary> {
    const preview = await this.preview({ includeFuture: true, limit: 500 });
    const runs = await this.runs(200);
    const latest = runs[0] ?? null;

    return {
      assistantVersion: ASSISTANT_VERSION,
      openPicks: preview.totalOpenPicks,
      duePicks: preview.candidates.filter((candidate) => candidate.status === 'due').length,
      stalePicks: preview.candidates.filter((candidate) => candidate.status === 'stale').length,
      upcomingPicks: preview.candidates.filter((candidate) => candidate.status === 'upcoming').length,
      latestRunId: latest?.runId ?? null,
      latestRunAt: latest?.appliedAt ?? null,
      latestRunStatus: latest?.status ?? null,
      totalRuns: runs.length,
      totalSettledByAssistant: runs.reduce((sum, run) => sum + run.settled, 0),
      totalFailedSettlements: runs.reduce((sum, run) => sum + run.failed, 0),
    };
  }

  private toCandidate(
    pick: PaperPick,
    generatedAt: string,
    settleAfterHours: number,
    staleAfterHours: number,
  ): SettlementAssistantCandidate {
    const generatedMs = new Date(generatedAt).getTime();
    const commenceMs = new Date(pick.commenceTime).getTime();
    const hoursSinceCommence = this.round((generatedMs - commenceMs) / 3_600_000, 2);
    const hoursUntilCommence = this.round((commenceMs - generatedMs) / 3_600_000, 2);

    const status =
      hoursSinceCommence >= staleAfterHours ? 'stale' : hoursSinceCommence >= settleAfterHours ? 'due' : 'upcoming';

    const recommendation =
      status === 'stale' ? 'settle_soon' : status === 'due' ? 'manual_result_required' : 'wait_for_match';

    return {
      paperPickId: pick.paperPickId,
      scanId: pick.scanId,
      eventId: pick.eventId,
      eventName: pick.eventName,
      commenceTime: pick.commenceTime,
      sportKey: pick.sportKey,
      marketKey: pick.marketKey,
      marketType: pick.marketType,
      selection: pick.selection,
      point: pick.point,
      bestOddsDecimal: pick.bestOddsDecimal,
      bestBookmaker: pick.bestBookmaker,
      paperStake: pick.paperStake,
      expectedValuePerUnit: pick.expectedValuePerUnit,
      scannerScore: pick.scannerScore,
      scannerRecommendation: pick.scannerRecommendation,
      generatedAt: pick.generatedAt,
      hoursUntilCommence,
      hoursSinceCommence,
      status,
      recommendation,
      allowedResults: ALLOWED_RESULTS,
      suggestedNotes:
        status === 'upcoming'
          ? 'Match has not reached settlement window yet. Do not settle unless correcting a test or void.'
          : 'Enter the real market result manually. Do not guess; use official final result/settlement from the book.',
      originalPick: pick,
    };
  }

  private rankCandidate(candidate: SettlementAssistantCandidate): number {
    const statusRank = candidate.status === 'stale' ? 0 : candidate.status === 'due' ? 1 : 2;
    return statusRank * 10_000 + Math.max(0, candidate.hoursUntilCommence);
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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }

  private round(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
