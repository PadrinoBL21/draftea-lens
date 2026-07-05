import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const PAPER_SETTLEMENT_RESULTS = ['win', 'loss', 'push', 'void', 'half_win', 'half_loss'] as const;

export type PaperSettlementResult = (typeof PAPER_SETTLEMENT_RESULTS)[number];

export class SettlePaperPickDto {
  @IsString()
  paperPickId!: string;

  @IsIn(PAPER_SETTLEMENT_RESULTS)
  result!: PaperSettlementResult;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1.01)
  @Max(1000)
  closingOdds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  closingLineValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
