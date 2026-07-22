import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { MODEL_REGISTRY_TYPES, type ModelRegistryType } from '../model-registry.types';

export class RegisterModelDto {
  @IsOptional()
  @IsString()
  modelId?: string;

  @IsString()
  modelVersion!: string;

  @IsOptional()
  @IsString()
  family?: string;

  @IsIn(MODEL_REGISTRY_TYPES)
  modelType!: ModelRegistryType;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  trainingRows?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  validationRows?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  backtestRows?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  positiveLabels?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeLabels?: number;

  @IsOptional()
  @IsNumber()
  @Min(-100)
  roiPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(-100)
  clvPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDrawdownPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  accuracyPct?: number;
}
