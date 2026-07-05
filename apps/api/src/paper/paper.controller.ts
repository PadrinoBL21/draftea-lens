import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ScanAndSaveDto } from './dto/scan-and-save.dto';
import { PaperService } from './paper.service';

@Controller('paper')
export class PaperController {
  constructor(private readonly paperService: PaperService) {}

  @Post('scan-and-save')
  scanAndSave(@Body() dto: ScanAndSaveDto) {
    return this.paperService.scanAndSave(dto);
  }

  @Get('scans')
  scans(@Query('limit') limit?: string) {
    return this.paperService.listLatestScans(Number(limit) || 10);
  }

  @Get('picks')
  picks(@Query('limit') limit?: string) {
    return this.paperService.listLatestPicks(Number(limit) || 25);
  }
}
