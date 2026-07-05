import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TrainMlBaselineV2Dto } from './dto/train-ml-baseline-v2.dto';
import { MlBaselineV2Service } from './ml-baseline-v2.service';

@Controller('ml-baseline-v2')
export class MlBaselineV2Controller {
  constructor(private readonly service: MlBaselineV2Service) {}

  @Post('train')
  train(@Body() dto: TrainMlBaselineV2Dto) {
    return this.service.train(dto);
  }

  @Get('latest')
  latest() {
    return this.service.latest();
  }

  @Get('predictions')
  predictions(@Query('limit') limit?: string) {
    return this.service.predictions(limit ? Number(limit) : 50);
  }

  @Get('summary')
  summary() {
    return this.service.summary();
  }
}
