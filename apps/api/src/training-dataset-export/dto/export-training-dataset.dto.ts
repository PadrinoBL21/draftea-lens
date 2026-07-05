import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ExportTrainingDatasetDto {
  @IsOptional()
  @IsIn(['jsonl', 'csv', 'both'])
  format?: 'jsonl' | 'csv' | 'both';

  @IsOptional()
  @IsBoolean()
  eligibleOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  includeMetadata?: boolean;

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
  @Max(1000000)
  maxRows?: number;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
