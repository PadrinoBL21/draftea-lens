import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RunDataCollectionSchedulerOnceDto } from './dto/run-data-collection-scheduler-once.dto';
import { StartDataCollectionSchedulerDto } from './dto/start-data-collection-scheduler.dto';
import { DataCollectionSchedulerService } from './data-collection-scheduler.service';

@Controller('scheduler')
export class DataCollectionSchedulerController {
  constructor(private readonly schedulerService: DataCollectionSchedulerService) {}

  @Post('start')
  start(@Body() dto: StartDataCollectionSchedulerDto) {
    return this.schedulerService.start(dto);
  }

  @Post('stop')
  stop() {
    return this.schedulerService.stop('Stopped through /scheduler/stop.');
  }

  @Post('run-now')
  runNow(@Body() dto: RunDataCollectionSchedulerOnceDto) {
    return this.schedulerService.runNow(dto);
  }

  @Get('status')
  status() {
    return this.schedulerService.status();
  }

  @Get('runs')
  runs(@Query('limit') limit?: string) {
    return this.schedulerService.runs(limit === undefined ? undefined : Number(limit));
  }

  @Get('latest')
  latest() {
    return this.schedulerService.latest();
  }

  @Get('summary')
  summary() {
    return this.schedulerService.summary();
  }
}
