import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MoneylineModule } from './moneyline/moneyline.module';
import { MarketsModule } from './markets/markets.module';
import { SourcesModule } from './sources/sources.module';
import { ScannerModule } from './scanner/scanner.module';
import { PaperModule } from './paper/paper.module';
import { OddsHistoryModule } from './odds-history/odds-history.module';
import { FeatureStoreModule } from './feature-store/feature-store.module';

@Module({
  imports: [
    MoneylineModule,
    MarketsModule,
    SourcesModule,
    ScannerModule,
    PaperModule,
    OddsHistoryModule,
    FeatureStoreModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
