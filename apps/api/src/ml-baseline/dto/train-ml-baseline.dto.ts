import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const ML_BASELINE_SOURCES = ['all', 'paper_pick', 'odds_line'] as const;
export type MlBaselineSource = (typeof ML_BASELINE_SOURCES)[number];

export class TrainMlBaselineDto {
  @IsOptional()
  @IsIn(ML_BASELINE_SOURCES)
  source?: MlBaselineSource;

  @IsOptional()
  @IsString()
  sportKey?: string;

  @IsOptional()
  @IsString()
  marketType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100000)
  minTrainingRows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100000)
  maxRows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(5000)
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
