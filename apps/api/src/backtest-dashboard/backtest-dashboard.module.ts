import { Module } from '@nestjs/common';
import { BacktestDashboardController } from './backtest-dashboard.controller';
import { BacktestDashboardService } from './backtest-dashboard.service';

@Module({
  controllers: [BacktestDashboardController],
  providers: [BacktestDashboardService],
  exports: [BacktestDashboardService],
})
export class BacktestDashboardModule {}
