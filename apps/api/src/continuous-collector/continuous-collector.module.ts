import { Module } from '@nestjs/common';
import { DataQualityService } from '../data-quality/data-quality.service';
import { FeatureStoreService } from '../feature-store/feature-store.service';
import { OddsHistoryService } from '../odds-history/odds-history.service';
import { PaperService } from '../paper/paper.service';
import { ScannerModule } from '../scanner/scanner.module';
import { ContinuousCollectorController } from './continuous-collector.controller';
import { ContinuousCollectorService } from './continuous-collector.service';

@Module({
  imports: [ScannerModule],
  controllers: [ContinuousCollectorController],
  providers: [ContinuousCollectorService, PaperService, OddsHistoryService, FeatureStoreService, DataQualityService],
})
export class ContinuousCollectorModule {}
