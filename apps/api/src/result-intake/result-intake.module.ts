import { Module } from '@nestjs/common';
import { DataQualityService } from '../data-quality/data-quality.service';
import { FeatureStoreService } from '../feature-store/feature-store.service';
import { PaperService } from '../paper/paper.service';
import { ScannerModule } from '../scanner/scanner.module';
import { ResultIntakeController } from './result-intake.controller';
import { ResultIntakeService } from './result-intake.service';

@Module({
  imports: [ScannerModule],
  controllers: [ResultIntakeController],
  providers: [ResultIntakeService, PaperService, FeatureStoreService, DataQualityService],
})
export class ResultIntakeModule {}
