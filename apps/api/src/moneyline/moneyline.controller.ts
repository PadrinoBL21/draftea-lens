import { Body, Controller, Post } from '@nestjs/common';
import { AnalyzeMoneylineDto } from './moneyline.dto';
import { MoneylineService } from './moneyline.service';

@Controller('moneyline')
export class MoneylineController {
  constructor(private readonly moneylineService: MoneylineService) {}

  @Post('analyze')
  analyze(@Body() body: AnalyzeMoneylineDto) {
    return this.moneylineService.analyze(body);
  }
}
