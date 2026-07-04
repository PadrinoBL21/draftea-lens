import { Body, Controller, Post } from '@nestjs/common';
import { AutoScanDto } from './dto/auto-scan.dto';
import { SmartScanDto } from './dto/smart-scan.dto';
import { ScannerService } from './scanner.service';

@Controller('scanner')
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Post('auto-scan')
  autoScan(@Body() dto: AutoScanDto) {
    return this.scannerService.autoScan(dto);
  }

  @Post('smart-scan')
  smartScan(@Body() dto: SmartScanDto) {
    return this.scannerService.smartScan(dto);
  }
}
