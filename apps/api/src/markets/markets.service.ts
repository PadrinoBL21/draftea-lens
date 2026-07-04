import { Injectable } from '@nestjs/common';
import { importMarketsFromText, MarketImportResult } from '@draftea-lens/core';
import { ImportMarketsDto } from './markets.dto';

@Injectable()
export class MarketsService {
  importFromText(dto: ImportMarketsDto): MarketImportResult {
    return importMarketsFromText({
      rawText: dto.rawText,
      sport: dto.sport,
      league: dto.league,
      source: dto.source ?? 'draftea_visible',
    });
  }
}
