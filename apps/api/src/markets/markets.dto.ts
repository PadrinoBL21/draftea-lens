import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ImportMarketsDto {
  @IsString()
  @MinLength(3)
  rawText!: string;

  @IsOptional()
  @IsString()
  sport?: string;

  @IsOptional()
  @IsString()
  league?: string;

  @IsOptional()
  @IsIn(['draftea_visible', 'manual_import', 'external_api', 'unknown'])
  source?: 'draftea_visible' | 'manual_import' | 'external_api' | 'unknown';
}
