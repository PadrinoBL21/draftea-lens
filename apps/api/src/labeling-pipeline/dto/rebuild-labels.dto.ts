import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class RebuildLabelsDto {
  @IsOptional()
  @IsIn(['paper_pick', 'all'])
  source?: 'paper_pick' | 'all';

  @IsOptional()
  @IsBoolean()
  includePushVoid?: boolean;

  @IsOptional()
  @IsBoolean()
  eligibleOnly?: boolean;

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
  @Max(100000)
  maxRows?: number;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
