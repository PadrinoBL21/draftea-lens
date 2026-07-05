import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { OfficialResultStatus } from '../result-intake.types';

export const OFFICIAL_RESULT_STATUSES: OfficialResultStatus[] = ['final', 'cancelled', 'postponed', 'abandoned', 'unknown'];

export class ManualOfficialResultDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsString()
  eventName!: string;

  @IsOptional()
  @IsString()
  sportKey?: string;

  @IsOptional()
  @IsString()
  commenceTime?: string;

  @IsOptional()
  @IsString()
  completedAt?: string;

  @IsOptional()
  @IsIn(OFFICIAL_RESULT_STATUSES)
  status?: OfficialResultStatus;

  @IsOptional()
  @IsString()
  homeTeam?: string;

  @IsOptional()
  @IsString()
  awayTeam?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999)
  homeScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999)
  awayScore?: number;

  @IsOptional()
  @IsString()
  sourceReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}

export class ImportManualResultsDto {
  @IsOptional()
  @IsString()
  sourceName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ManualOfficialResultDto)
  results!: ManualOfficialResultDto[];

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
