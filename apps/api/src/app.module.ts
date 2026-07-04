import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MoneylineModule } from './moneyline/moneyline.module';
import { MarketsModule } from './markets/markets.module';
import { SourcesModule } from './sources/sources.module';
import { ScannerModule } from './scanner/scanner.module';

@Module({
  imports: [MoneylineModule, MarketsModule, SourcesModule, ScannerModule],
  controllers: [HealthController],
})
export class AppModule {}
