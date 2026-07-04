import { Module } from '@nestjs/common';
import { MoneylineModule } from './moneyline/moneyline.module';
import { MarketsModule } from './markets/markets.module';
import { HealthController } from './health.controller';

@Module({
  imports: [MoneylineModule, MarketsModule],
  controllers: [HealthController],
})
export class AppModule {}
