import { Module } from '@nestjs/common';
import { TrainingDatasetExportController } from './training-dataset-export.controller';
import { TrainingDatasetExportService } from './training-dataset-export.service';

@Module({
  controllers: [TrainingDatasetExportController],
  providers: [TrainingDatasetExportService],
  exports: [TrainingDatasetExportService],
})
export class TrainingDatasetExportModule {}
