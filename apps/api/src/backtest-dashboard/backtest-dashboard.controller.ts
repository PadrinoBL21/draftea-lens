import { Controller, Get, Query } from '@nestjs/common';
import { BacktestDashboardService } from './backtest-dashboard.service';

@Controller('dashboard')
export class BacktestDashboardController {
  constructor(private readonly dashboard: BacktestDashboardService) {}

  @Get('overview')
  overview() {
    return this.dashboard.overview();
  }

  @Get('backtesting')
  backtesting(@Query('limit') limit?: string) {
    return this.dashboard.backtesting(Number(limit ?? 10));
  }

  @Get('collection')
  collection(@Query('limit') limit?: string) {
    return this.dashboard.collection(Number(limit ?? 10));
  }

  @Get('models')
  models(@Query('limit') limit?: string) {
    return this.dashboard.models(Number(limit ?? 10));
  }

  @Get('risks')
  risks() {
    return this.dashboard.risks();
  }
}
