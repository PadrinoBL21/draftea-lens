import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class PreviewSettlementAssistantDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(168)
  settleAfterHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(720)
  staleAfterHours?: number;

  @IsOptional()
  @IsBoolean()
  includeFuture?: boolean;

  @IsOptional()
  @IsString()
  sportKey?: string;

  @IsOptional()
  @IsString()
  marketType?: string;
}
