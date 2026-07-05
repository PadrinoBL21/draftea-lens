import { Module } from '@nestjs/common';
import { DataQualityService } from '../data-quality/data-quality.service';
import { FeatureStoreService } from '../feature-store/feature-store.service';
import { PaperService } from '../paper/paper.service';
import { ScannerModule } from '../scanner/scanner.module';
import { SettlementAssistantController } from './settlement-assistant.controller';
import { SettlementAssistantService } from './settlement-assistant.service';

@Module({
  imports: [ScannerModule],
  controllers: [SettlementAssistantController],
  providers: [SettlementAssistantService, PaperService, FeatureStoreService, DataQualityService],
})
export class SettlementAssistantModule {}
