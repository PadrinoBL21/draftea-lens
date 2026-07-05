import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RebuildFeatureStoreDto } from './dto/rebuild-feature-store.dto';
import { FeatureStoreService } from './feature-store.service';

@Controller('feature-store')
export class FeatureStoreController {
  constructor(private readonly featureStoreService: FeatureStoreService) {}

  @Post('rebuild')
  rebuild(@Body() dto: RebuildFeatureStoreDto) {
    return this.featureStoreService.rebuild(dto);
  }

  @Get('features')
  features(@Query('limit') limit?: string, @Query('source') source?: string) {
    return this.featureStoreService.listFeatures({
      limit: Number(limit) || 50,
      source,
    });
  }

  @Get('dataset')
  dataset(@Query('limit') limit?: string, @Query('outcomeKnownOnly') outcomeKnownOnly?: string) {
    return this.featureStoreService.dataset({
      limit: Number(limit) || 200,
      outcomeKnownOnly: outcomeKnownOnly === 'true',
    });
  }

  @Get('summary')
  summary() {
    return this.featureStoreService.summary();
  }
}
