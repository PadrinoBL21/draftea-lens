import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AutoScanDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  bankroll!: number;

  @IsString()
  sport!: string;

  @IsOptional()
  @IsString()
  regions?: string = 'us';

  @IsOptional()
  @IsString()
  markets?: string = 'h2h,spreads,totals';

  @IsOptional()
  @IsString()
  bookmakers?: string;

  @IsOptional()
  @IsIn(['decimal', 'american'])
  oddsFormat?: 'decimal' | 'american' = 'decimal';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxResults?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  minBookmakers?: number = 2;
}
