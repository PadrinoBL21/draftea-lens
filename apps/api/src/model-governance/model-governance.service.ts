import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EvaluateChallengerDto } from './dto/evaluate-challenger.dto';
import { PromoteChallengerDto } from './dto/promote-challenger.dto';
import {
  BacktestFile,
  GovernanceBacktestSnapshot,
  GovernanceChampion,
  GovernanceChallengerSnapshot,
  GovernanceEvaluation,
  GovernanceEvaluationStatus,
  GovernancePromotionResult,
  GovernanceSummary,
  GovernanceThresholds,
  MlModelFile,
} from './model-governance.types';

const GOVERNANCE_VERSION = 'model-governance-v0.1';
const DATA_DIR = join(process.cwd(), 'data', 'model-governance');
const EVALUATIONS_JSONL = join(DATA_DIR, 'evaluations.jsonl');
const LATEST_EVALUATION_JSON = join(DATA_DIR, 'latest-evaluation.json');
const CHAMPION_JSON = join(DATA_DIR, 'champion.json');

const ML_BASELINE_DIR = join(process.cwd(), 'data', 'ml-baseline');
const ML_MODELS_JSONL = join(ML_BASELINE_DIR, 'models.jsonl');
const ML_LATEST_MODEL_JSON = join(ML_BASELINE_DIR, 'latest-model.json');
const BACKTESTING_LATEST_JSON = join(process.cwd(), 'data', 'backtesting', 'latest-run.json');

@Injectable()
export class ModelGovernanceService {
  async evaluate(dto: EvaluateChallengerDto): Promise<GovernanceEvaluation> {
    await this.ensureStorage();

    const evaluatedAt = new Date().toISOString();
    const thresholds = this.thresholds(dto);
    const champion = await this.champion();
    const challengerModel = await this.findChallenger(dto.challengerModelId);
    const latestBacktest = await this.latestBacktestSnapshot();
    const challenger = challengerModel ? this.toChallengerSnapshot(challengerModel) : null;
    const failedChecks = this.failedChecks(challenger, latestBacktest, thresholds);
    const status = this.status(challenger, latestBacktest, thresholds, failedChecks);
    const promotable = status === 'promotable';

    const evaluation: GovernanceEvaluation = {
      evaluationId: this.createId('governance_eval', evaluatedAt),
      evaluatedAt,
      governanceVersion: GOVERNANCE_VERSION,
      champion,
      challenger,
      latestBacktest,
      thresholds,
      status,
      promotable,
      failedChecks,
      recommendation: promotable ? 'promote_challenger' : 'keep_champion',
      notes: this.notes(status, failedChecks),
    };

    await this.appendJsonl(EVALUATIONS_JSONL, evaluation);
    await writeFile(LATEST_EVALUATION_JSON, `${JSON.stringify(evaluation, null, 2)}\n`, 'utf-8');
    return evaluation;
  }

  async promote(dto: PromoteChallengerDto): Promise<GovernancePromotionResult> {
    await this.ensureStorage();
    const latestEvaluation = await this.latestEvaluation();

    if (!latestEvaluation) {
      throw new BadRequestException('No governance evaluation exists. Run /model-governance/evaluate first.');
    }
    if (!latestEvaluation.promotable || !latestEvaluation.challenger) {
      throw new BadRequestException('Latest challenger is not promotable. Champion remains active.');
    }
    if (dto.challengerModelId && dto.challengerModelId !== latestEvaluation.challenger.modelId) {
      throw new BadRequestException('Provided challengerModelId does not match the latest promotable evaluation.');
    }

    const promotedAt = new Date().toISOString();
    const champion: GovernanceChampion = {
      modelId: latestEvaluation.challenger.modelId,
      modelVersion: latestEvaluation.challenger.modelVersion,
      modelType: latestEvaluation.challenger.modelType,
      status: 'active',
      promotedAt,
      promotionSourceEvaluationId: latestEvaluation.evaluationId,
      notes: [
        'Promoted only after governance checks passed.',
        dto.notes ?? 'No operator notes provided.',
        'Promotion does not authorize real-money staking. Recommendations remain paper-first until explicitly reviewed.',
      ],
    };

    await writeFile(CHAMPION_JSON, `${JSON.stringify(champion, null, 2)}\n`, 'utf-8');
    return { promoted: true, champion, evaluation: latestEvaluation };
  }

  async champion(): Promise<GovernanceChampion> {
    await this.ensureStorage();
    if (!existsSync(CHAMPION_JSON)) {
      const champion = this.defaultChampion();
      await writeFile(CHAMPION_JSON, `${JSON.stringify(champion, null, 2)}\n`, 'utf-8');
      return champion;
    }
    const raw = await readFile(CHAMPION_JSON, 'utf-8');
    return raw.trim() ? (JSON.parse(raw) as GovernanceChampion) : this.defaultChampion();
  }

  async evaluations(limit = 20): Promise<GovernanceEvaluation[]> {
    await this.ensureStorage();
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const evaluations = await this.readJsonl<GovernanceEvaluation>(EVALUATIONS_JSONL);
    return evaluations.slice(-safeLimit).reverse();
  }

  async summary(): Promise<GovernanceSummary> {
    await this.ensureStorage();
    const champion = await this.champion();
    const evaluations = await this.readJsonl<GovernanceEvaluation>(EVALUATIONS_JSONL);
    const latest = evaluations[evaluations.length - 1];

    return {
      governanceVersion: GOVERNANCE_VERSION,
      champion,
      totalEvaluations: evaluations.length,
      promotableEvaluations: evaluations.filter((evaluation) => evaluation.promotable).length,
      blockedEvaluations: evaluations.filter((evaluation) => !evaluation.promotable).length,
      latestEvaluationId: latest?.evaluationId ?? null,
      latestEvaluationStatus: latest?.status ?? null,
    };
  }

  private thresholds(dto: EvaluateChallengerDto): GovernanceThresholds {
    return {
      requireLatestBacktest: dto.requireLatestBacktest ?? true,
      minTrainingRows: Math.max(2, Math.min(dto.minTrainingRows ?? 100, 100000)),
      minValidationRows: Math.max(0, Math.min(dto.minValidationRows ?? 20, 100000)),
      minBacktestRows: Math.max(0, Math.min(dto.minBacktestRows ?? 100, 100000)),
      minRoiPct: Math.max(-100, Math.min(dto.minRoiPct ?? 0, 1000)),
      minAccuracyPct: dto.minAccuracyPct === undefined ? null : Math.max(0, Math.min(dto.minAccuracyPct, 100)),
      maxDrawdown: dto.maxDrawdown === undefined ? null : Math.max(0, Math.min(dto.maxDrawdown, 100)),
      maxBrierScore: dto.maxBrierScore === undefined ? null : Math.max(0, Math.min(dto.maxBrierScore, 1)),
    };
  }

  private failedChecks(
    challenger: GovernanceChallengerSnapshot | null,
    latestBacktest: GovernanceBacktestSnapshot | null,
    thresholds: GovernanceThresholds,
  ): string[] {
    const failed: string[] = [];

    if (!challenger) {
      failed.push('No challenger model found.');
      return failed;
    }

    if (challenger.status !== 'trained') failed.push(`Challenger status is ${challenger.status}, not trained.`);
    if (challenger.trainingRows < thresholds.minTrainingRows) {
      failed.push(`Training rows ${challenger.trainingRows} below required ${thresholds.minTrainingRows}.`);
    }
    if (challenger.validationRows < thresholds.minValidationRows) {
      failed.push(`Validation rows ${challenger.validationRows} below required ${thresholds.minValidationRows}.`);
    }
    if (thresholds.minAccuracyPct !== null && (challenger.metrics.accuracyPct ?? -Infinity) < thresholds.minAccuracyPct) {
      failed.push(`Accuracy ${challenger.metrics.accuracyPct ?? 'null'} below required ${thresholds.minAccuracyPct}.`);
    }
    if (thresholds.maxBrierScore !== null && (challenger.metrics.brierScore ?? Infinity) > thresholds.maxBrierScore) {
      failed.push(`Brier score ${challenger.metrics.brierScore ?? 'null'} above allowed ${thresholds.maxBrierScore}.`);
    }

    if (thresholds.requireLatestBacktest && !latestBacktest) {
      failed.push('Latest backtest is required but missing.');
      return failed;
    }

    if (latestBacktest) {
      if (latestBacktest.eligibleRows < thresholds.minBacktestRows) {
        failed.push(`Backtest eligible rows ${latestBacktest.eligibleRows} below required ${thresholds.minBacktestRows}.`);
      }
      if (latestBacktest.roiPct < thresholds.minRoiPct) {
        failed.push(`Backtest ROI ${latestBacktest.roiPct}% below required ${thresholds.minRoiPct}%.`);
      }
      if (thresholds.maxDrawdown !== null && latestBacktest.maxDrawdown > thresholds.maxDrawdown) {
        failed.push(`Backtest max drawdown ${latestBacktest.maxDrawdown} above allowed ${thresholds.maxDrawdown}.`);
      }
    }

    return failed;
  }

  private status(
    challenger: GovernanceChallengerSnapshot | null,
    latestBacktest: GovernanceBacktestSnapshot | null,
    thresholds: GovernanceThresholds,
    failedChecks: string[],
  ): GovernanceEvaluationStatus {
    if (!challenger) return 'blocked_no_challenger';
    if (challenger.status !== 'trained') return 'blocked_insufficient_data';
    if (thresholds.requireLatestBacktest && !latestBacktest) return 'blocked_no_backtest';
    if (failedChecks.length > 0) return 'blocked_metrics';
    return 'promotable';
  }

  private notes(status: GovernanceEvaluationStatus, failedChecks: string[]): string[] {
    if (status === 'promotable') {
      return [
        'Challenger passed the configured governance thresholds.',
        'Promotion is available, but real-money staking remains separately gated.',
      ];
    }
    return [
      'Champion remains active.',
      'Challenger cannot be promoted until failed checks are resolved.',
      ...failedChecks,
    ];
  }

  private async findChallenger(modelId?: string): Promise<MlModelFile | null> {
    if (modelId) {
      const models = await this.readJsonl<MlModelFile>(ML_MODELS_JSONL);
      return models.find((model) => model.modelId === modelId) ?? null;
    }
    if (!existsSync(ML_LATEST_MODEL_JSON)) return null;
    const raw = await readFile(ML_LATEST_MODEL_JSON, 'utf-8');
    return raw.trim() ? (JSON.parse(raw) as MlModelFile) : null;
  }

  private toChallengerSnapshot(model: MlModelFile): GovernanceChallengerSnapshot {
    return {
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      modelType: 'ml_baseline',
      trainedAt: model.trainedAt,
      status: model.status,
      trainingRows: model.trainingRows,
      validationRows: model.validationRows,
      positiveLabels: model.positiveLabels,
      negativeLabels: model.negativeLabels,
      metrics: model.metrics,
    };
  }

  private async latestBacktestSnapshot(): Promise<GovernanceBacktestSnapshot | null> {
    if (!existsSync(BACKTESTING_LATEST_JSON)) return null;
    const raw = await readFile(BACKTESTING_LATEST_JSON, 'utf-8');
    if (!raw.trim()) return null;
    const backtest = JSON.parse(raw) as BacktestFile;
    return {
      runId: backtest.runId,
      generatedAt: backtest.generatedAt,
      eligibleRows: backtest.eligibleRows,
      profitLoss: backtest.profitLoss,
      roiPct: backtest.roiPct,
      hitRatePct: backtest.hitRatePct,
      averageClosingLineValue: backtest.averageClosingLineValue,
      maxDrawdown: backtest.maxDrawdown,
    };
  }

  private async latestEvaluation(): Promise<GovernanceEvaluation | null> {
    if (!existsSync(LATEST_EVALUATION_JSON)) return null;
    const raw = await readFile(LATEST_EVALUATION_JSON, 'utf-8');
    return raw.trim() ? (JSON.parse(raw) as GovernanceEvaluation) : null;
  }

  private defaultChampion(): GovernanceChampion {
    return {
      modelId: 'consensus-ev-v0.1',
      modelVersion: 'consensus-ev-v0.1',
      modelType: 'rules_engine',
      status: 'active',
      promotedAt: null,
      promotionSourceEvaluationId: null,
      notes: [
        'Default champion is the deterministic Consensus EV rules engine.',
        'ML models start as challengers and cannot replace champion without governance checks.',
      ],
    };
  }

  private async ensureStorage() {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
  }

  private async appendJsonl<T>(path: string, item: T) {
    const existing = await this.readJsonl<T>(path);
    existing.push(item);
    await writeFile(path, existing.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf-8');
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

  private createId(prefix: string, timestamp: string): string {
    const cleanTimestamp = timestamp.replace(/[-:.]/g, '').toLowerCase();
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${cleanTimestamp}_${random}`;
  }
}
