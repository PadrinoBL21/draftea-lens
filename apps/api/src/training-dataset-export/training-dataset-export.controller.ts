import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ExportTrainingDatasetDto } from './dto/export-training-dataset.dto';
import { TrainingDatasetExportService } from './training-dataset-export.service';

@Controller('training-dataset')
export class TrainingDatasetExportController {
  constructor(private readonly trainingDataset: TrainingDatasetExportService) {}

  @Post('export')
  exportDataset(@Body() dto: ExportTrainingDatasetDto) {
    return this.trainingDataset.exportDataset(dto);
  }

  @Get('exports')
  exports(@Query('limit') limit?: string) {
    return this.trainingDataset.listExports(Number(limit ?? 25));
  }

  @Get('latest')
  latest() {
    return this.trainingDataset.latest();
  }

  @Get('dataset')
  dataset(@Query('limit') limit?: string) {
    return this.trainingDataset.dataset(Number(limit ?? 500));
  }

  @Get('summary')
  summary() {
    return this.trainingDataset.summary();
  }
}
