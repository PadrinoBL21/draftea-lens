import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class MatchOpenPicksDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsString()
  sportKey?: string;

  @IsOptional()
  @IsBoolean()
  includeFuture?: boolean;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
