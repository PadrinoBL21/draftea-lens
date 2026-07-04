import { Injectable } from '@nestjs/common';
import { analyzeMoneyline, MoneylineAnalyzeResult } from '@draftea-lens/core';
import { AnalyzeMoneylineDto } from './moneyline.dto';

@Injectable()
export class MoneylineService {
  analyze(input: AnalyzeMoneylineDto): MoneylineAnalyzeResult {
    return analyzeMoneyline(input);
  }
}
