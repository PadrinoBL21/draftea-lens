import { Module } from '@nestjs/common';
import { MoneylineModule } from './moneyline/moneyline.module';
import { MarketsModule } from './markets/markets.module';
import { SourcesModule } from './sources/sources.module';
import { HealthController } from './health.controller';

@Module({
  imports: [MoneylineModule, MarketsModule, SourcesModule],
  controllers: [HealthController],
})
export class AppModule {}
