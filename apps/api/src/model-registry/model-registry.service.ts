import { Injectable } from '@nestjs/common';

import { EvaluateModelDto } from './dto/evaluate-model.dto';
import { PromoteModelDto } from './dto/promote-model.dto';
import { RegisterModelDto } from './dto/register-model.dto';
import { ModelRegistryStore } from './model-registry.store';
import type {
  ModelEvaluation,
  ModelEvaluationStatus,
  ModelRegistryGates,
  ModelRegistryMetrics,
  ModelRegistryStatus,
  ModelRegistrySummary,
  RegisteredModel,
} from './model-registry.types';

@Injectable()
export class ModelRegistryService {
  private readonly store = new ModelRegistryStore(process.env.DATA_DIR);
  private readonly registryVersion = 'model-registry-v2-v0.1';

  private async readSeededModels(): Promise<RegisteredModel[]> {
    const models = await this.store.readModels();

    if (models.some((model) => model.status === 'champion')) {
      return models;
    }

    const now = new Date().toISOString();

    const champion: RegisteredModel = {
      modelId: 'champion_consensus_ev_v0_1',
      modelVersion: 'consensus-ev-v0.1',
      family: 'consensus_ev',
      modelType: 'rules_engine',
      status: 'champion',
      source: 'seeded_current_champion',
      registeredAt: now,
      promotedAt: now,
      serverId: process.env.SERVER_ID ?? 'local-dev',
      notes: 'Seeded current champion from production governance baseline.',
      tags: ['champion', 'rules_engine', 'consensus_ev'],
      metrics: this.metricsFromDto({} as RegisterModelDto),
      gates: this.defaultGates(),
    };

    const seededModels = [champion, ...models];
    await this.store.writeModels(seededModels);

    return seededModels;
  }

  async register(dto: RegisterModelDto): Promise<RegisteredModel> {
    const models = await this.readSeededModels();
    const now = new Date().toISOString();
    const modelId = dto.modelId ?? this.createModelId(dto.modelVersion);

    const existing = models.find((model) => model.modelId === modelId);
    if (existing) {
      return existing;
    }

    const model: RegisteredModel = {
      modelId,
      modelVersion: dto.modelVersion,
      family: dto.family ?? this.inferFamily(dto.modelVersion),
      modelType: dto.modelType,
      status: 'candidate',
      source: dto.source ?? 'manual_registry_registration',
      registeredAt: now,
      serverId: process.env.SERVER_ID ?? 'local-dev',
      notes: dto.notes,
      tags: dto.tags ?? [],
      metrics: this.metricsFromDto(dto),
      gates: this.defaultGates(),
    };

    models.push(model);
    await this.store.writeModels(models);
    return model;
  }

  async listModels(status?: ModelRegistryStatus): Promise<{ count: number; models: RegisteredModel[] }> {
    const models = await this.readSeededModels();
    const filtered = status ? models.filter((model) => model.status === status) : models;
    return { count: filtered.length, models: filtered };
  }

  async latest(): Promise<{
    champion: RegisteredModel | null;
    latestCandidate: RegisteredModel | null;
    latestEvaluation: ModelEvaluation | null;
  }> {
    const models = await this.readSeededModels();
    const evaluations = await this.store.readEvaluations();
    return {
      champion: this.currentChampion(models),
      latestCandidate: [...models].reverse().find((model) => model.status === 'candidate') ?? null,
      latestEvaluation: [...evaluations].reverse()[0] ?? null,
    };
  }

  async evaluate(dto: EvaluateModelDto): Promise<ModelEvaluation> {
    const models = await this.readSeededModels();
    const evaluations = await this.store.readEvaluations();
    const model = this.resolveModel(models, dto.modelId, dto.modelVersion);
    const champion = this.currentChampion(models);
    const metrics = this.metricsFromDto(dto, model.metrics);
    const gates = this.gatesFromDto(dto, model.gates);
    const reasons = this.evaluateReasons(metrics, gates);

    let status: ModelEvaluationStatus = reasons.length > 0 ? 'blocked_insufficient_data' : 'promotable';
    if (model.status === 'champion') {
      status = 'active_champion';
      reasons.push('Model is already the active champion.');
    }
    if (dto.requireManualReview === true && status === 'promotable') {
      status = 'blocked_manual_review';
      reasons.push('Manual review is required before promotion.');
    }

    const promotable = status === 'promotable';
    const evaluation: ModelEvaluation = {
      evaluationId: this.createEvaluationId(model.modelVersion),
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      evaluatedAt: new Date().toISOString(),
      evaluatedBy: dto.evaluatedBy ?? process.env.SERVER_ID ?? 'local-dev',
      status,
      promotable,
      recommendation: this.recommendationForStatus(status),
      championModelId: champion?.modelId ?? null,
      metrics,
      gates,
      reasons: reasons.length > 0 ? reasons : ['All configured promotion gates passed.'],
      notes: dto.notes,
    };

    const updatedModels = models.map((registeredModel) => {
      if (registeredModel.modelId !== model.modelId) {
        return registeredModel;
      }
      return {
        ...registeredModel,
        status: status === 'blocked_insufficient_data' || status === 'blocked_manual_review' ? 'blocked' : registeredModel.status,
        blockedAt: status.startsWith('blocked') ? evaluation.evaluatedAt : registeredModel.blockedAt,
        metrics,
        gates,
      } satisfies RegisteredModel;
    });

    evaluations.push(evaluation);
    await this.store.writeModels(updatedModels);
    await this.store.writeEvaluations(evaluations);
    return evaluation;
  }

  async promote(dto: PromoteModelDto): Promise<{
    promoted: boolean;
    champion: RegisteredModel | null;
    previousChampion: RegisteredModel | null;
    reasons: string[];
  }> {
    const models = await this.readSeededModels();
    const evaluations = await this.store.readEvaluations();
    const model = this.resolveModel(models, dto.modelId);
    const latestEvaluation = this.latestEvaluationForModel(evaluations, model.modelId, dto.evaluationId);

    if (!dto.force && (!latestEvaluation || latestEvaluation.promotable !== true)) {
      return {
        promoted: false,
        champion: this.currentChampion(models),
        previousChampion: this.currentChampion(models),
        reasons: latestEvaluation?.reasons ?? ['No promotable evaluation exists for this model.'],
      };
    }

    const now = new Date().toISOString();
    const previousChampion = this.currentChampion(models);
    const updatedModels = models.map((registeredModel) => {
      if (registeredModel.modelId === model.modelId) {
        return {
          ...registeredModel,
          status: 'champion' as const,
          promotedAt: now,
          notes: dto.notes ?? registeredModel.notes,
        };
      }
      if (registeredModel.status === 'champion') {
        return {
          ...registeredModel,
          status: 'archived' as const,
          archivedAt: now,
        };
      }
      return registeredModel;
    });

    await this.store.writeModels(updatedModels);
    return {
      promoted: true,
      champion: updatedModels.find((registeredModel) => registeredModel.modelId === model.modelId) ?? null,
      previousChampion,
      reasons: dto.force ? ['Forced promotion requested.'] : ['Model promoted from promotable evaluation.'],
    };
  }

  async summary(): Promise<ModelRegistrySummary> {
    const models = await this.readSeededModels();
    const evaluations = await this.store.readEvaluations();
    const latestEvaluation = [...evaluations].reverse()[0];
    const champion = this.currentChampion(models);
    return {
      registryVersion: this.registryVersion,
      generatedAt: new Date().toISOString(),
      totalModels: models.length,
      championModelId: champion?.modelId ?? null,
      candidateModels: models.filter((model) => model.status === 'candidate').length,
      blockedModels: models.filter((model) => model.status === 'blocked').length,
      archivedModels: models.filter((model) => model.status === 'archived').length,
      totalEvaluations: evaluations.length,
      latestEvaluationStatus: latestEvaluation?.status ?? null,
      latestEvaluationRecommendation: latestEvaluation?.recommendation ?? null,
    };
  }

  private resolveModel(models: RegisteredModel[], modelId?: string, modelVersion?: string): RegisteredModel {
    const model = models.find((registeredModel) => {
      return (
        (modelId !== undefined && registeredModel.modelId === modelId) ||
        (modelVersion !== undefined && registeredModel.modelVersion === modelVersion)
      );
    });

    if (model) {
      return model;
    }

    const latestCandidate = [...models].reverse().find((registeredModel) => registeredModel.status === 'candidate');
    if (latestCandidate) {
      return latestCandidate;
    }

    const champion = this.currentChampion(models);
    if (champion) {
      return champion;
    }

    throw new Error('No model exists in the registry.');
  }

  private currentChampion(models: RegisteredModel[]): RegisteredModel | null {
    return [...models].reverse().find((model) => model.status === 'champion') ?? null;
  }

  private latestEvaluationForModel(
    evaluations: ModelEvaluation[],
    modelId: string,
    evaluationId?: string,
  ): ModelEvaluation | null {
    if (evaluationId) {
      return evaluations.find((evaluation) => evaluation.evaluationId === evaluationId) ?? null;
    }
    return [...evaluations].reverse().find((evaluation) => evaluation.modelId === modelId) ?? null;
  }

  private evaluateReasons(metrics: ModelRegistryMetrics, gates: ModelRegistryGates): string[] {
    const reasons: string[] = [];
    if (metrics.trainingRows < gates.minTrainingRows) {
      reasons.push(`Training rows ${metrics.trainingRows} below required ${gates.minTrainingRows}.`);
    }
    if (metrics.validationRows < gates.minValidationRows) {
      reasons.push(`Validation rows ${metrics.validationRows} below required ${gates.minValidationRows}.`);
    }
    if (metrics.backtestRows < gates.minBacktestRows) {
      reasons.push(`Backtest rows ${metrics.backtestRows} below required ${gates.minBacktestRows}.`);
    }
    if (metrics.positiveLabels < gates.minPositiveLabels) {
      reasons.push(`Positive labels ${metrics.positiveLabels} below required ${gates.minPositiveLabels}.`);
    }
    if (metrics.negativeLabels < gates.minNegativeLabels) {
      reasons.push(`Negative labels ${metrics.negativeLabels} below required ${gates.minNegativeLabels}.`);
    }
    if (metrics.roiPct !== null && metrics.roiPct < gates.minRoiPct) {
      reasons.push(`ROI ${metrics.roiPct}% below required ${gates.minRoiPct}%.`);
    }
    if (metrics.clvPct !== null && metrics.clvPct < gates.minClvPct) {
      reasons.push(`CLV ${metrics.clvPct}% below required ${gates.minClvPct}%.`);
    }
    if (metrics.maxDrawdownPct !== null && metrics.maxDrawdownPct > gates.maxDrawdownPct) {
      reasons.push(`Max drawdown ${metrics.maxDrawdownPct}% above allowed ${gates.maxDrawdownPct}%.`);
    }
    return reasons;
  }

  private recommendationForStatus(status: ModelEvaluationStatus): ModelEvaluation['recommendation'] {
    if (status === 'promotable') {
      return 'promote';
    }
    if (status === 'blocked_insufficient_data') {
      return 'collect_more_data';
    }
    if (status === 'blocked_manual_review') {
      return 'manual_review';
    }
    return 'keep_champion';
  }

  private metricsFromDto(
    dto: RegisterModelDto | EvaluateModelDto,
    fallback?: ModelRegistryMetrics,
  ): ModelRegistryMetrics {
    return {
      trainingRows: dto.trainingRows ?? fallback?.trainingRows ?? 0,
      validationRows: dto.validationRows ?? fallback?.validationRows ?? 0,
      backtestRows: dto.backtestRows ?? fallback?.backtestRows ?? 0,
      positiveLabels: dto.positiveLabels ?? fallback?.positiveLabels ?? 0,
      negativeLabels: dto.negativeLabels ?? fallback?.negativeLabels ?? 0,
      roiPct: dto.roiPct ?? fallback?.roiPct ?? null,
      clvPct: dto.clvPct ?? fallback?.clvPct ?? null,
      maxDrawdownPct: dto.maxDrawdownPct ?? fallback?.maxDrawdownPct ?? null,
      accuracyPct: dto.accuracyPct ?? fallback?.accuracyPct ?? null,
    };
  }

  private gatesFromDto(dto: EvaluateModelDto, fallback?: ModelRegistryGates): ModelRegistryGates {
    const defaults = this.defaultGates();
    return {
      minTrainingRows: dto.minTrainingRows ?? fallback?.minTrainingRows ?? defaults.minTrainingRows,
      minValidationRows: dto.minValidationRows ?? fallback?.minValidationRows ?? defaults.minValidationRows,
      minBacktestRows: dto.minBacktestRows ?? fallback?.minBacktestRows ?? defaults.minBacktestRows,
      minPositiveLabels: dto.minPositiveLabels ?? fallback?.minPositiveLabels ?? defaults.minPositiveLabels,
      minNegativeLabels: dto.minNegativeLabels ?? fallback?.minNegativeLabels ?? defaults.minNegativeLabels,
      minRoiPct: fallback?.minRoiPct ?? defaults.minRoiPct,
      minClvPct: fallback?.minClvPct ?? defaults.minClvPct,
      maxDrawdownPct: fallback?.maxDrawdownPct ?? defaults.maxDrawdownPct,
    };
  }

  private defaultGates(): ModelRegistryGates {
    return {
      minTrainingRows: 100,
      minValidationRows: 20,
      minBacktestRows: 100,
      minPositiveLabels: 25,
      minNegativeLabels: 25,
      minRoiPct: 0,
      minClvPct: 0,
      maxDrawdownPct: 25,
    };
  }

  private createModelId(modelVersion: string): string {
    return `${modelVersion.replace(/[^a-zA-Z0-9_.-]/g, '-').toLowerCase()}_${Date.now().toString(36)}`;
  }

  private createEvaluationId(modelVersion: string): string {
    return `model_eval_${new Date().toISOString().replace(/[-:.]/g, '').toLowerCase()}_${modelVersion
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()}`;
  }

  private inferFamily(modelVersion: string): string {
    if (modelVersion.includes('ml-baseline-v2')) {
      return 'ml-baseline-v2';
    }
    if (modelVersion.includes('ml-baseline')) {
      return 'ml-baseline';
    }
    if (modelVersion.includes('consensus-ev')) {
      return 'consensus-ev';
    }
    return 'other';
  }
}
