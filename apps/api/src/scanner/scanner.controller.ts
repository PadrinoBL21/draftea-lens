import { Body, Controller, Post } from '@nestjs/common';
import { AutoScanDto } from './dto/auto-scan.dto';
import { ScannerService } from './scanner.service';

@Controller('scanner')
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Post('auto-scan')
  autoScan(@Body() dto: AutoScanDto) {
    return this.scannerService.autoScan(dto);
  }
}
