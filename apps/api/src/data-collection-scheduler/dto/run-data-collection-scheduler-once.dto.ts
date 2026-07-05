import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RunDataCollectionSchedulerOnceDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  bankroll?: number;

  @IsOptional()
  @IsString()
  runLabel?: string;

  @IsOptional()
  @IsBoolean()
  enablePaperPicks?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxPaperPicks?: number;

  @IsOptional()
  @IsBoolean()
  enableOddsSnapshot?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxLines?: number;

  @IsOptional()
  @IsBoolean()
  rebuildFeatureStore?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50000)
  maxFeatureVectors?: number;

  @IsOptional()
  @IsBoolean()
  auditDataQuality?: boolean;

  @IsOptional()
  @IsBoolean()
  persistDataQualityAudit?: boolean;
}
