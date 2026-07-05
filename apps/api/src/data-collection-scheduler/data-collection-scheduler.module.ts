import { Module } from '@nestjs/common';
import { ContinuousCollectorService } from '../continuous-collector/continuous-collector.service';
import { DataQualityService } from '../data-quality/data-quality.service';
import { FeatureStoreService } from '../feature-store/feature-store.service';
import { OddsHistoryService } from '../odds-history/odds-history.service';
import { PaperService } from '../paper/paper.service';
import { ScannerModule } from '../scanner/scanner.module';
import { DataCollectionSchedulerController } from './data-collection-scheduler.controller';
import { DataCollectionSchedulerService } from './data-collection-scheduler.service';

@Module({
  imports: [ScannerModule],
  controllers: [DataCollectionSchedulerController],
  providers: [
    DataCollectionSchedulerService,
    ContinuousCollectorService,
    PaperService,
    OddsHistoryService,
    FeatureStoreService,
    DataQualityService,
  ],
})
export class DataCollectionSchedulerModule {}
