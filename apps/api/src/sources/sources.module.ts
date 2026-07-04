import { Module } from '@nestjs/common';
import { TheOddsApiController } from './the-odds-api.controller';
import { TheOddsApiService } from './the-odds-api.service';

@Module({
  controllers: [TheOddsApiController],
  providers: [TheOddsApiService],
})
export class SourcesModule {}
