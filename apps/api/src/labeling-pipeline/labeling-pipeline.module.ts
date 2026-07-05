import { Module } from '@nestjs/common';
import { LabelingPipelineController } from './labeling-pipeline.controller';
import { LabelingPipelineService } from './labeling-pipeline.service';

@Module({
  controllers: [LabelingPipelineController],
  providers: [LabelingPipelineService],
  exports: [LabelingPipelineService],
})
export class LabelingPipelineModule {}
