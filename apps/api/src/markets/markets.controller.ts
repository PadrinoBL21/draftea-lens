import { Body, Controller, Post } from '@nestjs/common';
import { ImportMarketsDto } from './markets.dto';
import { MarketsService } from './markets.service';

@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Post('import-text')
  importText(@Body() dto: ImportMarketsDto) {
    return this.marketsService.importFromText(dto);
  }
}
