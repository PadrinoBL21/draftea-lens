import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuditDataQualityDto } from './dto/audit-data-quality.dto';
import { DataQualityService } from './data-quality.service';

@Controller('data-quality')
export class DataQualityController {
  constructor(private readonly dataQualityService: DataQualityService) {}

  @Post('audit')
  audit(@Body() dto: AuditDataQualityDto) {
    return this.dataQualityService.audit(dto);
  }

  @Get('report')
  report() {
    return this.dataQualityService.report();
  }

  @Get('readiness')
  readiness() {
    return this.dataQualityService.readiness();
  }

  @Get('summary')
  summary() {
    return this.dataQualityService.summary();
  }
}
