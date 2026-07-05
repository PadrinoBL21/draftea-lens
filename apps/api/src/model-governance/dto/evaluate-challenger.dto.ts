import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class EvaluateChallengerDto {
  @IsOptional()
  @IsString()
  challengerModelId?: string;

  @IsOptional()
  @IsBoolean()
  requireLatestBacktest?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(100000)
  minTrainingRows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  minValidationRows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  minBacktestRows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(1000)
  minRoiPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minAccuracyPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDrawdown?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  maxBrierScore?: number;
}
