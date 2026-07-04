import { Controller, Get, Query } from '@nestjs/common';
import { TheOddsApiEventOddsQueryDto, TheOddsApiOddsQueryDto, TheOddsApiSportsQueryDto } from './the-odds-api.dto';
import { TheOddsApiService } from './the-odds-api.service';

@Controller('sources/the-odds-api')
export class TheOddsApiController {
  constructor(private readonly theOddsApiService: TheOddsApiService) {}

  @Get('sports')
  getSports(@Query() query: TheOddsApiSportsQueryDto) {
    return this.theOddsApiService.getSports(query);
  }

  @Get('odds')
  getOdds(@Query() query: TheOddsApiOddsQueryDto) {
    return this.theOddsApiService.getOdds(query);
  }

  @Get('event-odds')
  getEventOdds(@Query() query: TheOddsApiEventOddsQueryDto) {
    return this.theOddsApiService.getEventOdds(query);
  }
}
