import { IsIn, IsOptional, IsString } from 'class-validator';

export class TheOddsApiSportsQueryDto {
  @IsOptional()
  @IsString()
  all?: string;
}

export class TheOddsApiOddsQueryDto {
  @IsString()
  sport!: string;

  @IsOptional()
  @IsString()
  regions?: string;

  @IsOptional()
  @IsString()
  markets?: string;

  @IsOptional()
  @IsString()
  bookmakers?: string;

  @IsOptional()
  @IsIn(['decimal', 'american'])
  oddsFormat?: 'decimal' | 'american';

  @IsOptional()
  @IsString()
  commenceTimeFrom?: string;

  @IsOptional()
  @IsString()
  commenceTimeTo?: string;

  @IsOptional()
  @IsString()
  eventIds?: string;
}

export class TheOddsApiEventOddsQueryDto {
  @IsString()
  sport!: string;

  @IsString()
  eventId!: string;

  @IsOptional()
  @IsString()
  regions?: string;

  @IsOptional()
  @IsString()
  markets?: string;

  @IsOptional()
  @IsString()
  bookmakers?: string;

  @IsOptional()
  @IsIn(['decimal', 'american'])
  oddsFormat?: 'decimal' | 'american';
}
