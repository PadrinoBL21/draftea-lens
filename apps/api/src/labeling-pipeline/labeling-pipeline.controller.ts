import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RebuildLabelsDto } from './dto/rebuild-labels.dto';
import { LabelingPipelineService } from './labeling-pipeline.service';

@Controller('labeling')
export class LabelingPipelineController {
  constructor(private readonly labeling: LabelingPipelineService) {}

  @Post('rebuild')
  rebuild(@Body() dto: RebuildLabelsDto) {
    return this.labeling.rebuild(dto);
  }

  @Get('labels')
  labels(@Query('limit') limit?: string, @Query('eligibleOnly') eligibleOnly?: string) {
    return this.labeling.listLabels({
      limit: Number(limit ?? 50),
      eligibleOnly: eligibleOnly === 'true',
    });
  }

  @Get('dataset')
  dataset(@Query('limit') limit?: string) {
    return this.labeling.dataset({ limit: Number(limit ?? 500) });
  }

  @Get('summary')
  summary() {
    return this.labeling.summary();
  }
}
