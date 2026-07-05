import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RunBacktestDto } from './dto/run-backtest.dto';
import { BacktestingService } from './backtesting.service';

@Controller('backtesting')
export class BacktestingController {
  constructor(private readonly backtestingService: BacktestingService) {}

  @Post('run')
  run(@Body() dto: RunBacktestDto) {
    return this.backtestingService.run(dto);
  }

  @Get('runs')
  runs(@Query('limit') limit?: string) {
    return this.backtestingService.listRuns(Number(limit) || 20);
  }

  @Get('latest')
  latest() {
    return this.backtestingService.latest();
  }

  @Get('summary')
  summary() {
    return this.backtestingService.summary();
  }
}
