import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const BACKTEST_SOURCES = ['all', 'paper_pick', 'odds_line'] as const;
export const BACKTEST_STAKING_MODES = ['flat', 'paper', 'ev_scaled'] as const;
export const BACKTEST_TRENDS = ['all', 'shortening', 'drifting', 'flat', 'unknown'] as const;

export type BacktestSource = (typeof BACKTEST_SOURCES)[number];
export type BacktestStakingMode = (typeof BACKTEST_STAKING_MODES)[number];
export type BacktestTrend = (typeof BACKTEST_TRENDS)[number];

export class RunBacktestDto {
  @IsOptional()
  @IsIn(BACKTEST_SOURCES)
  source?: BacktestSource;

  @IsOptional()
  @IsString()
  sportKey?: string;

  @IsOptional()
  @IsString()
  marketType?: string;

  @IsOptional()
  @IsIn(BACKTEST_TRENDS)
  trend?: BacktestTrend;

  @IsOptional()
  @IsBoolean()
  outcomeKnownOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1)
  @Max(10)
  minExpectedValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  minScannerScore?: number;

  @IsOptional()
  @IsIn(BACKTEST_STAKING_MODES)
  stakingMode?: BacktestStakingMode;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(100000)
  flatStake?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100000)
  maxRows?: number;
}
