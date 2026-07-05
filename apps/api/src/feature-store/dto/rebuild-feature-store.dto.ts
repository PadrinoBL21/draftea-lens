import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RebuildFeatureStoreDto {
  @IsOptional()
  @IsBoolean()
  includePaperPicks?: boolean;

  @IsOptional()
  @IsBoolean()
  includeOddsLines?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50000)
  maxVectors?: number;
}