import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ScanAndSaveDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  bankroll!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxPaperPicks?: number;
}
