import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TrainMlBaselineDto } from './dto/train-ml-baseline.dto';
import { MlBaselineService } from './ml-baseline.service';

@Controller('ml-baseline')
export class MlBaselineController {
  constructor(private readonly mlBaselineService: MlBaselineService) {}

  @Post('train')
  train(@Body() dto: TrainMlBaselineDto) {
    return this.mlBaselineService.train(dto);
  }

  @Get('latest')
  latest() {
    return this.mlBaselineService.latest();
  }

  @Get('predictions')
  predictions(@Query('limit') limit?: string) {
    return this.mlBaselineService.predictions(Number(limit) || 50);
  }

  @Get('summary')
  summary() {
    return this.mlBaselineService.summary();
  }
}
