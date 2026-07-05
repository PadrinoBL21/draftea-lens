import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MoneylineModule } from './moneyline/moneyline.module';
import { MarketsModule } from './markets/markets.module';
import { SourcesModule } from './sources/sources.module';
import { ScannerModule } from './scanner/scanner.module';
import { PaperModule } from './paper/paper.module';
import { OddsHistoryModule } from './odds-history/odds-history.module';
import { FeatureStoreModule } from './feature-store/feature-store.module';
import { BacktestingModule } from './backtesting/backtesting.module';
import { MlBaselineModule } from './ml-baseline/ml-baseline.module';
import { ModelGovernanceModule } from './model-governance/model-governance.module';
import { DataQualityModule } from './data-quality/data-quality.module';
import { ContinuousCollectorModule } from './continuous-collector/continuous-collector.module';
import { SettlementAssistantModule } from './settlement-assistant/settlement-assistant.module';
import { DataCollectionSchedulerModule } from './data-collection-scheduler/data-collection-scheduler.module';
import { BacktestDashboardModule } from './backtest-dashboard/backtest-dashboard.module';
import { ResultIntakeModule } from './result-intake/result-intake.module';
import { LabelingPipelineModule } from './labeling-pipeline/labeling-pipeline.module';
import { TrainingDatasetExportModule } from './training-dataset-export/training-dataset-export.module';
import { MlBaselineV2Module } from './ml-baseline-v2/ml-baseline-v2.module';

@Module({
  imports: [
    MoneylineModule,
    MarketsModule,
    SourcesModule,
    ScannerModule,
    PaperModule,
    OddsHistoryModule,
    FeatureStoreModule,
    BacktestingModule,
    MlBaselineModule,
    ModelGovernanceModule,
    DataQualityModule,
    ContinuousCollectorModule,
    SettlementAssistantModule,
    DataCollectionSchedulerModule,
    BacktestDashboardModule,
    ResultIntakeModule,
    LabelingPipelineModule,
    TrainingDatasetExportModule,
    MlBaselineV2Module,
  ],
  controllers: [HealthController],
})
export class AppModule {}
