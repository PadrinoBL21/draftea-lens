import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ContinuousCollectorService } from './continuous-collector.service';
import { RunCollectorDto } from './dto/run-collector.dto';

@Controller('collector')
export class ContinuousCollectorController {
  constructor(private readonly collectorService: ContinuousCollectorService) {}

  @Post('run-once')
  runOnce(@Body() dto: RunCollectorDto) {
    return this.collectorService.runOnce(dto);
  }

  @Get('runs')
  runs(@Query('limit') limit?: string) {
    return this.collectorService.listRuns(limit === undefined ? undefined : Number(limit));
  }

  @Get('latest')
  latest() {
    return this.collectorService.latest();
  }

  @Get('summary')
  summary() {
    return this.collectorService.summary();
  }
}
