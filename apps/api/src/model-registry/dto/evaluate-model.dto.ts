import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class EvaluateModelDto {
  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  modelVersion?: string;

  @IsOptional()
  @IsString()
  evaluatedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  requireManualReview?: boolean;

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

  @IsOptional()
  @IsNumber()
  @Min(1)
  minTrainingRows?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minValidationRows?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minBacktestRows?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minPositiveLabels?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minNegativeLabels?: number;
}
