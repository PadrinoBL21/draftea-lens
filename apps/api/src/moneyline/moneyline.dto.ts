import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class MoneylineOutcomeDto {
  @IsString()
  label!: string;

  @IsNumber()
  @Min(1.01)
  oddsDecimal!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  modelProbability!: number;
}

export class StakePolicyDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  fractionalKelly?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  maxStakePct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minPositiveEdge?: number;

  @IsOptional()
  @IsNumber()
  minEv?: number;
}

export class AnalyzeMoneylineDto {
  @IsString()
  eventName!: string;

  @IsNumber()
  @Min(1)
  bankroll!: number;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => MoneylineOutcomeDto)
  outcomes!: MoneylineOutcomeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => StakePolicyDto)
  stakePolicy?: StakePolicyDto;
}
