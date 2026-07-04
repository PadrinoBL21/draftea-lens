import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class SmartScanDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  bankroll!: number;

  @IsOptional()
  @IsString()
  regions?: string = 'us';

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
  @Max(100)
  maxResults?: number = 30;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  minBookmakers?: number = 2;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  sportLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  hoursAhead?: number;
}
