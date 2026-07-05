import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { PAPER_SETTLEMENT_RESULTS } from '../../paper/dto/settle-paper-pick.dto';
import { PaperSettlementResult } from '../../paper/paper.types';

export class ManualSettlementItemDto {
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

export class ApplySettlementsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ManualSettlementItemDto)
  settlements!: ManualSettlementItemDto[];

  @IsOptional()
  @IsString()
  notesPrefix?: string;

  @IsOptional()
  @IsBoolean()
  rebuildFeatureStore?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50000)
  maxFeatureVectors?: number;

  @IsOptional()
  @IsBoolean()
  auditDataQuality?: boolean;

  @IsOptional()
  @IsBoolean()
  persistDataQualityAudit?: boolean;
}
