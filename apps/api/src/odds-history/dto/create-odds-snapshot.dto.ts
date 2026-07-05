import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateOddsSnapshotDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  bankroll!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxLines?: number;
}
