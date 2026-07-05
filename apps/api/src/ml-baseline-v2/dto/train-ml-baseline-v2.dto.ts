import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const ML_BASELINE_V2_SOURCES = ['training_dataset'] as const;
export type MlBaselineV2Source = (typeof ML_BASELINE_V2_SOURCES)[number];

export class TrainMlBaselineV2Dto {
  @IsOptional()
  @IsIn(ML_BASELINE_V2_SOURCES)
  source?: MlBaselineV2Source;

  @IsOptional()
  @IsString()
  sportKey?: string;

  @IsOptional()
  @IsString()
  marketType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-10)
  @Max(10)
  minExpectedValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  minTrainingRows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  maxRows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(10000)
  epochs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(1)
  learningRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(0.5)
  validationSplit?: number;
}
