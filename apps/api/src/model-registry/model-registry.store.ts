import fs from 'node:fs/promises';
import path from 'node:path';

import type { ModelEvaluation, RegisteredModel } from './model-registry.types';

export class ModelRegistryStore {
  private readonly dataDir: string;
  private readonly modelsPath: string;
  private readonly evaluationsPath: string;

  constructor(dataRoot = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')) {
    this.dataDir = path.join(dataRoot, 'model-registry');
    this.modelsPath = path.join(this.dataDir, 'models.json');
    this.evaluationsPath = path.join(this.dataDir, 'evaluations.json');
  }

  async readModels(): Promise<RegisteredModel[]> {
    return this.readJsonArray<RegisteredModel>(this.modelsPath);
  }

  async writeModels(models: RegisteredModel[]): Promise<void> {
    await this.writeJsonArray(this.modelsPath, models);
  }

  async readEvaluations(): Promise<ModelEvaluation[]> {
    return this.readJsonArray<ModelEvaluation>(this.evaluationsPath);
  }

  async writeEvaluations(evaluations: ModelEvaluation[]): Promise<void> {
    await this.writeJsonArray(this.evaluationsPath, evaluations);
  }

  private async readJsonArray<T>(filePath: string): Promise<T[]> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  private async writeJsonArray<T>(filePath: string, rows: T[]): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  }
}
