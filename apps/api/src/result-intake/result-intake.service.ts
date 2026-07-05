import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataQualityService } from '../data-quality/data-quality.service';
import { FeatureStoreService } from '../feature-store/feature-store.service';
import { PaperService } from '../paper/paper.service';
import { PaperPick, PaperSettlementResult } from '../paper/paper.types';
import { ApplyResultMatchesDto, ResultIntakeSettlementDto } from './dto/apply-result-matches.dto';
import { ImportManualResultsDto, ManualOfficialResultDto } from './dto/import-manual-results.dto';
import { MatchOpenPicksDto } from './dto/match-open-picks.dto';
import {
  OfficialResultRecord,
  ResultIntakeApplyResult,
  ResultIntakeApplyItem,
  ResultIntakeImportResult,
  ResultIntakeSummary,
  ResultMatchCandidate,
  ResultMatchRun,
  SuggestedSettlement,
} from './result-intake.types';

const RESULT_INTAKE_VERSION = 'result-intake-v0.1';
const DATA_DIR = join(process.cwd(), 'data', 'result-intake');
const RESULTS_JSONL = join(DATA_DIR, 'official-results.jsonl');
const IMPORTS_JSONL = join(DATA_DIR, 'imports.jsonl');
const LATEST_IMPORT_JSON = join(DATA_DIR, 'latest-import.json');
const MATCH_RUNS_JSONL = join(DATA_DIR, 'match-runs.jsonl');
const LATEST_MATCH_RUN_JSON = join(DATA_DIR, 'latest-match-run.json');
const APPLY_RUNS_JSONL = join(DATA_DIR, 'apply-runs.jsonl');
const LATEST_APPLY_RUN_JSON = join(DATA_DIR, 'latest-apply-run.json');

@Injectable()
export class ResultIntakeService {
  constructor(
    private readonly paperService: PaperService,
    private readonly featureStoreService: FeatureStoreService,
    private readonly dataQualityService: DataQualityService,
  ) {}

  async importManual(dto: ImportManualResultsDto): Promise<ResultIntakeImportResult> {
    await this.ensureStorage();
    const importedAt = new Date().toISOString();
    const sourceName = dto.sourceName?.trim() || 'manual-official-result';
    const existing = await this.readResults();
    const existingKeys = new Set(existing.map((result) => this.resultDedupKey(result)));
    const results: OfficialResultRecord[] = [];
    let duplicateResultIds = 0;
    let skipped = 0;

    for (const item of dto.results) {
      const normalized = this.normalizeManualResult(item, sourceName, importedAt);
      const key = this.resultDedupKey(normalized);
      if (existingKeys.has(key)) {
        duplicateResultIds += 1;
        skipped += 1;
        continue;
      }
      existingKeys.add(key);
      results.push(normalized);
    }

    const importRecord: ResultIntakeImportResult = {
      importId: this.createId('result_import', importedAt),
      importedAt,
      resultIntakeVersion: RESULT_INTAKE_VERSION,
      sourceName,
      imported: results.length,
      skipped,
      duplicateResultIds,
      results,
    };

    if (dto.persist ?? true) {
      importRecord.saved = {
        resultsPath: this.relativePath(RESULTS_JSONL),
        importsPath: this.relativePath(IMPORTS_JSONL),
        latestImportPath: this.relativePath(LATEST_IMPORT_JSON),
      };
      for (const result of results) {
        await appendFile(RESULTS_JSONL, `${JSON.stringify(result)}\n`, 'utf-8');
      }
      await appendFile(IMPORTS_JSONL, `${JSON.stringify(importRecord)}\n`, 'utf-8');
      await writeFile(LATEST_IMPORT_JSON, `${JSON.stringify(importRecord, null, 2)}\n`, 'utf-8');
    }

    return importRecord;
  }

  async matchOpenPicks(dto: MatchOpenPicksDto = {}): Promise<ResultMatchRun> {
    await this.ensureStorage();
    const generatedAt = new Date().toISOString();
    const limit = Math.max(1, Math.min(dto.limit ?? 100, 500));
    const openPicks = (await this.paperService.listOpenPicks(500))
      .filter((pick) => (dto.sportKey ? pick.sportKey === dto.sportKey : true))
      .filter((pick) => (dto.includeFuture ? true : new Date(pick.commenceTime).getTime() <= Date.now()))
      .slice(0, limit);
    const results = await this.readResults();
    const candidates = openPicks.map((pick) => this.matchPick(pick, results, generatedAt));

    const run: ResultMatchRun = {
      matchRunId: this.createId('result_match_run', generatedAt),
      generatedAt,
      resultIntakeVersion: RESULT_INTAKE_VERSION,
      totalOpenPicks: openPicks.length,
      matched: candidates.filter((candidate) => candidate.result !== null).length,
      highConfidence: candidates.filter((candidate) => candidate.suggestedSettlement.confidence === 'high').length,
      mediumConfidence: candidates.filter((candidate) => candidate.suggestedSettlement.confidence === 'medium').length,
      manualReview: candidates.filter((candidate) => candidate.status === 'manual_review').length,
      noResult: candidates.filter((candidate) => candidate.status === 'no_result').length,
      candidates,
    };

    if (dto.persist ?? true) {
      run.saved = {
        matchRunsPath: this.relativePath(MATCH_RUNS_JSONL),
        latestMatchRunPath: this.relativePath(LATEST_MATCH_RUN_JSON),
      };
      await appendFile(MATCH_RUNS_JSONL, `${JSON.stringify(run)}\n`, 'utf-8');
      await writeFile(LATEST_MATCH_RUN_JSON, `${JSON.stringify(run, null, 2)}\n`, 'utf-8');
    }

    return run;
  }

  async applyMatches(dto: ApplyResultMatchesDto): Promise<ResultIntakeApplyResult> {
    await this.ensureStorage();
    const appliedAt = new Date().toISOString();
    const applyRunId = this.createId('result_apply_run', appliedAt);
    const settlements = await this.resolveSettlements(dto);
    const results: ResultIntakeApplyItem[] = [];
    const seen = new Set<string>();

    for (const settlement of settlements) {
      if (seen.has(settlement.paperPickId)) {
        results.push({ paperPickId: settlement.paperPickId, status: 'skipped', result: settlement.result, error: 'Duplicate paperPickId in apply batch.' });
        continue;
      }
      seen.add(settlement.paperPickId);

      try {
        const settledPick = await this.paperService.settlePick({
          paperPickId: settlement.paperPickId,
          result: settlement.result,
          closingOdds: settlement.closingOdds,
          closingLineValue: settlement.closingLineValue,
          notes: [dto.notesPrefix ?? 'Result Intake', settlement.notes].filter(Boolean).join(' | '),
        });
        results.push({ paperPickId: settlement.paperPickId, status: 'settled', result: settlement.result, settledPick });
      } catch (error) {
        results.push({
          paperPickId: settlement.paperPickId,
          status: 'failed',
          result: settlement.result,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const settled = results.filter((result) => result.status === 'settled').length;
    const postSettlement: ResultIntakeApplyResult['postSettlement'] = {};

    if (settled > 0 && (dto.rebuildFeatureStore ?? true)) {
      const rebuild = await this.featureStoreService.rebuild({
        includePaperPicks: true,
        includeOddsLines: true,
        maxVectors: dto.maxFeatureVectors ?? 5000,
      });
      postSettlement.featureRebuildId = rebuild.rebuildId;
      postSettlement.featureVectorsBuilt = rebuild.vectorsBuilt;
    }

    if (settled > 0 && (dto.auditDataQuality ?? true)) {
      const audit = await this.dataQualityService.audit({ persist: dto.persistDataQualityAudit ?? true });
      postSettlement.dataQualityAuditId = audit.auditId;
      postSettlement.dataQualityReadiness = audit.readiness;
      postSettlement.blockerCount = audit.blockers.length;
      postSettlement.warningCount = audit.warnings.length;
    }

    const applyResult: ResultIntakeApplyResult = {
      applyRunId,
      appliedAt,
      resultIntakeVersion: RESULT_INTAKE_VERSION,
      status: settlements.length === 0 ? 'no_matches_applied' : results.some((result) => result.status === 'failed') ? 'completed_with_errors' : 'completed',
      requested: settlements.length,
      settled,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      results,
      postSettlement,
      saved: {
        applyRunsPath: this.relativePath(APPLY_RUNS_JSONL),
        latestApplyRunPath: this.relativePath(LATEST_APPLY_RUN_JSON),
      },
    };

    await appendFile(APPLY_RUNS_JSONL, `${JSON.stringify(applyResult)}\n`, 'utf-8');
    await writeFile(LATEST_APPLY_RUN_JSON, `${JSON.stringify(applyResult, null, 2)}\n`, 'utf-8');

    return applyResult;
  }

  async results(limit = 50): Promise<{ value: OfficialResultRecord[]; count: number }> {
    const results = await this.readResults();
    const value = results.slice(-Math.max(1, Math.min(limit, 500))).reverse();
    return { value, count: value.length };
  }

  async latest(): Promise<{ latestImport: ResultIntakeImportResult | null; latestMatchRun: ResultMatchRun | null; latestApplyRun: ResultIntakeApplyResult | null }> {
    await this.ensureStorage();
    return {
      latestImport: await this.readJson(LATEST_IMPORT_JSON),
      latestMatchRun: await this.readJson(LATEST_MATCH_RUN_JSON),
      latestApplyRun: await this.readJson(LATEST_APPLY_RUN_JSON),
    };
  }

  async summary(): Promise<ResultIntakeSummary> {
    await this.ensureStorage();
    const officialResults = await this.readResults();
    const imports = await this.readJsonl<ResultIntakeImportResult>(IMPORTS_JSONL);
    const matchRuns = await this.readJsonl<ResultMatchRun>(MATCH_RUNS_JSONL);
    const applyRuns = await this.readJsonl<ResultIntakeApplyResult>(APPLY_RUNS_JSONL);
    const latestImport = imports.at(-1) ?? null;
    const latestMatchRun = matchRuns.at(-1) ?? null;
    const latestApplyRun = applyRuns.at(-1) ?? null;

    return {
      resultIntakeVersion: RESULT_INTAKE_VERSION,
      totalOfficialResults: officialResults.length,
      totalImports: imports.length,
      totalMatchRuns: matchRuns.length,
      totalApplyRuns: applyRuns.length,
      latestImportId: latestImport?.importId ?? null,
      latestMatchRunId: latestMatchRun?.matchRunId ?? null,
      latestApplyRunId: latestApplyRun?.applyRunId ?? null,
      latestApplyStatus: latestApplyRun?.status ?? null,
      totalSettledByIntake: applyRuns.reduce((sum, run) => sum + run.settled, 0),
      highConfidenceCandidates: latestMatchRun?.highConfidence ?? 0,
      manualReviewCandidates: latestMatchRun?.manualReview ?? 0,
    };
  }

  private async resolveSettlements(dto: ApplyResultMatchesDto): Promise<ResultIntakeSettlementDto[]> {
    if (dto.settlements?.length) return dto.settlements;
    if (!dto.applyAllHighConfidence) {
      throw new BadRequestException('Provide settlements or set applyAllHighConfidence=true.');
    }

    const matchRun = await this.matchOpenPicks({ includeFuture: false, persist: true, limit: 500 });
    const minConfidence = dto.minConfidence ?? 'high';
    const allowed = minConfidence === 'medium' ? new Set(['high', 'medium']) : new Set(['high']);

    return matchRun.candidates
      .filter((candidate) => candidate.suggestedSettlement.result)
      .filter((candidate) => allowed.has(candidate.suggestedSettlement.confidence))
      .map((candidate) => ({
        paperPickId: candidate.paperPickId,
        result: candidate.suggestedSettlement.result as PaperSettlementResult,
        closingOdds: candidate.suggestedSettlement.closingOdds,
        notes: `Auto-applied from official result ${candidate.result?.resultId ?? 'unknown'}. ${candidate.suggestedSettlement.reason}`,
      }));
  }

  private normalizeManualResult(item: ManualOfficialResultDto, sourceName: string, importedAt: string): OfficialResultRecord {
    const eventName = item.eventName.trim();
    const parsed = this.parseEventName(eventName);
    const status = item.status ?? (typeof item.homeScore === 'number' && typeof item.awayScore === 'number' ? 'final' : 'unknown');

    return {
      resultId: this.createId('official_result', `${importedAt}_${eventName}_${item.eventId ?? ''}`),
      importedAt,
      resultIntakeVersion: RESULT_INTAKE_VERSION,
      sourceName,
      sourceReference: item.sourceReference,
      eventId: item.eventId,
      eventName,
      sportKey: item.sportKey,
      commenceTime: item.commenceTime,
      completedAt: item.completedAt,
      status,
      homeTeam: item.homeTeam?.trim() || parsed.homeTeam,
      awayTeam: item.awayTeam?.trim() || parsed.awayTeam,
      homeScore: item.homeScore,
      awayScore: item.awayScore,
      notes: item.notes,
      raw: item.raw,
    };
  }

  private matchPick(pick: PaperPick, results: OfficialResultRecord[], generatedAt: string): ResultMatchCandidate {
    const exact = results
      .filter((result) => result.eventId && result.eventId === pick.eventId)
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
    const byName = exact ?? results
      .filter((result) => this.normalized(result.eventName) === this.normalized(pick.eventName))
      .filter((result) => (result.sportKey && pick.sportKey ? result.sportKey === pick.sportKey : true))
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];

    const result = exact ?? byName ?? null;
    const suggestedSettlement = result ? this.suggestSettlement(pick, result, Boolean(exact)) : this.noResultSuggestion(pick);
    const status = !result
      ? 'no_result'
      : suggestedSettlement.confidence === 'high'
        ? 'matched_high_confidence'
        : suggestedSettlement.confidence === 'medium'
          ? 'matched_by_name'
          : 'manual_review';

    return {
      matchId: this.createId(`result_match_${pick.paperPickId}`, generatedAt),
      paperPickId: pick.paperPickId,
      eventId: pick.eventId,
      eventName: pick.eventName,
      commenceTime: pick.commenceTime,
      sportKey: pick.sportKey,
      marketKey: pick.marketKey,
      marketType: pick.marketType,
      selection: pick.selection,
      point: pick.point,
      bestOddsDecimal: pick.bestOddsDecimal,
      status,
      result,
      suggestedSettlement,
      paperPick: pick,
    };
  }

  private suggestSettlement(pick: PaperPick, result: OfficialResultRecord, exactEventId: boolean): SuggestedSettlement {
    if (['cancelled', 'postponed', 'abandoned'].includes(result.status)) {
      return { result: 'void', confidence: exactEventId ? 'high' : 'medium', reason: `Event status is ${result.status}; void suggested.` };
    }

    if (result.status !== 'final') {
      return { result: null, confidence: 'low', reason: `Official result status is ${result.status}; manual review required.` };
    }

    if (typeof result.homeScore !== 'number' || typeof result.awayScore !== 'number') {
      return { result: null, confidence: 'low', reason: 'Final score is missing; manual review required.' };
    }

    const confidence = exactEventId ? 'high' : 'medium';
    const market = this.normalized(`${pick.marketType} ${pick.marketKey}`);
    if (market.includes('moneyline') || market.includes('h2h')) {
      return this.moneylineSettlement(pick, result, confidence);
    }
    if (market.includes('total')) {
      return this.totalSettlement(pick, result, confidence);
    }
    if (market.includes('spread')) {
      return this.spreadSettlement(pick, result, confidence);
    }

    return { result: null, confidence: 'low', reason: `Market ${pick.marketType}/${pick.marketKey} is not supported for automatic settlement yet.` };
  }

  private moneylineSettlement(pick: PaperPick, result: OfficialResultRecord, confidence: 'high' | 'medium'): SuggestedSettlement {
    const selection = this.normalized(pick.selection);
    const home = this.normalized(result.homeTeam);
    const away = this.normalized(result.awayTeam);
    const isDraw = result.homeScore === result.awayScore;
    const winner = result.homeScore! > result.awayScore! ? home : result.awayScore! > result.homeScore! ? away : 'draw';
    const selectedDraw = ['draw', 'tie', 'empate'].includes(selection);

    if (selectedDraw) {
      return { result: isDraw ? 'win' : 'loss', confidence, reason: `Moneyline draw selection settled from final score ${result.homeScore}-${result.awayScore}.` };
    }
    if (!home || !away) {
      return { result: null, confidence: 'low', reason: 'Team names are missing; cannot auto-settle moneyline.' };
    }
    if (selection !== home && selection !== away) {
      return { result: null, confidence: 'low', reason: `Selection ${pick.selection} does not match official teams.` };
    }

    return {
      result: winner === selection ? 'win' : 'loss',
      confidence,
      reason: `Moneyline settled from final score ${result.homeScore}-${result.awayScore}.`,
    };
  }

  private totalSettlement(pick: PaperPick, result: OfficialResultRecord, confidence: 'high' | 'medium'): SuggestedSettlement {
    if (typeof pick.point !== 'number') return { result: null, confidence: 'low', reason: 'Total market has no point value.' };
    const selection = this.normalized(pick.selection);
    const scoreTotal = result.homeScore! + result.awayScore!;
    const isOver = selection.includes('over') || selection.includes('mas') || selection.includes('más');
    const isUnder = selection.includes('under') || selection.includes('menos');
    if (!isOver && !isUnder) return { result: null, confidence: 'low', reason: 'Total selection does not say over/under.' };
    if (scoreTotal === pick.point) return { result: 'push', confidence, reason: `Total pushed at ${scoreTotal}.` };
    const overWon = scoreTotal > pick.point;
    return { result: isOver === overWon ? 'win' : 'loss', confidence, reason: `Total settled from ${scoreTotal} goals/runs/points vs line ${pick.point}.` };
  }

  private spreadSettlement(pick: PaperPick, result: OfficialResultRecord, confidence: 'high' | 'medium'): SuggestedSettlement {
    if (typeof pick.point !== 'number') return { result: null, confidence: 'low', reason: 'Spread market has no point value.' };
    const selection = this.normalized(pick.selection);
    const home = this.normalized(result.homeTeam);
    const away = this.normalized(result.awayTeam);
    let selectedScore: number | null = null;
    let opponentScore: number | null = null;
    if (selection === home) {
      selectedScore = result.homeScore!;
      opponentScore = result.awayScore!;
    } else if (selection === away) {
      selectedScore = result.awayScore!;
      opponentScore = result.homeScore!;
    }
    if (selectedScore === null || opponentScore === null) {
      return { result: null, confidence: 'low', reason: `Selection ${pick.selection} does not match spread teams.` };
    }
    const adjusted = selectedScore + pick.point;
    if (adjusted === opponentScore) return { result: 'push', confidence, reason: `Spread pushed after applying line ${pick.point}.` };
    return { result: adjusted > opponentScore ? 'win' : 'loss', confidence, reason: `Spread settled from adjusted score ${adjusted} vs ${opponentScore}.` };
  }

  private noResultSuggestion(pick: PaperPick): SuggestedSettlement {
    const isPast = new Date(pick.commenceTime).getTime() <= Date.now();
    return {
      result: null,
      confidence: 'none',
      reason: isPast ? 'No official result found yet; import result or review manually.' : 'Event is upcoming; wait for official result.',
    };
  }

  private parseEventName(eventName: string): { homeTeam?: string; awayTeam?: string } {
    const parts = eventName.split(/\s+vs\.?\s+|\s+v\.?\s+|\s+@\s+/i).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) return { homeTeam: parts[0], awayTeam: parts[1] };
    return {};
  }

  private resultDedupKey(result: OfficialResultRecord): string {
    return [result.sourceName, result.eventId ?? this.normalized(result.eventName), result.completedAt ?? result.status, result.homeScore ?? 'x', result.awayScore ?? 'x'].join('|');
  }

  private async readResults(): Promise<OfficialResultRecord[]> {
    await this.ensureStorage();
    return this.readJsonl<OfficialResultRecord>(RESULTS_JSONL);
  }

  private async readJson<T>(path: string): Promise<T | null> {
    if (!existsSync(path)) return null;
    const raw = await readFile(path, 'utf-8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  }

  private async readJsonl<T>(path: string): Promise<T[]> {
    if (!existsSync(path)) return [];
    const raw = await readFile(path, 'utf-8');
    return raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as T);
  }

  private async ensureStorage(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    for (const file of [RESULTS_JSONL, IMPORTS_JSONL, MATCH_RUNS_JSONL, APPLY_RUNS_JSONL]) {
      if (!existsSync(file)) await writeFile(file, '', 'utf-8');
    }
  }

  private createId(prefix: string, isoDate: string): string {
    const stamp = isoDate.replace(/[^a-zA-Z0-9]/g, '').slice(0, 22).toLowerCase();
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${stamp}_${random}`;
  }

  private relativePath(path: string): string {
    return path.replace(process.cwd(), '.').replace(/\\/g, '/');
  }

  private normalized(value?: string | null): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
