import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApplySettlementsDto } from './dto/apply-settlements.dto';
import { PreviewSettlementAssistantDto } from './dto/preview-settlement-assistant.dto';
import { SettlementAssistantService } from './settlement-assistant.service';

@Controller('settlement-assistant')
export class SettlementAssistantController {
  constructor(private readonly assistantService: SettlementAssistantService) {}

  @Post('preview')
  preview(@Body() dto: PreviewSettlementAssistantDto) {
    return this.assistantService.preview(dto);
  }

  @Post('apply')
  apply(@Body() dto: ApplySettlementsDto) {
    return this.assistantService.apply(dto);
  }

  @Get('due')
  due(@Query('limit') limit?: string, @Query('includeFuture') includeFuture?: string) {
    return this.assistantService.preview({
      limit: limit === undefined ? undefined : Number(limit),
      includeFuture: includeFuture === 'true',
    });
  }

  @Get('runs')
  runs(@Query('limit') limit?: string) {
    return this.assistantService.runs(limit === undefined ? undefined : Number(limit));
  }

  @Get('latest')
  latest() {
    return this.assistantService.latest();
  }

  @Get('summary')
  summary() {
    return this.assistantService.summary();
  }
}
