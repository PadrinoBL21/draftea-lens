import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApplyResultMatchesDto } from './dto/apply-result-matches.dto';
import { ImportManualResultsDto } from './dto/import-manual-results.dto';
import { MatchOpenPicksDto } from './dto/match-open-picks.dto';
import { ResultIntakeService } from './result-intake.service';

@Controller('result-intake')
export class ResultIntakeController {
  constructor(private readonly resultIntakeService: ResultIntakeService) {}

  @Post('import-manual')
  importManual(@Body() dto: ImportManualResultsDto) {
    return this.resultIntakeService.importManual(dto);
  }

  @Post('match-open-picks')
  matchOpenPicks(@Body() dto: MatchOpenPicksDto) {
    return this.resultIntakeService.matchOpenPicks(dto);
  }

  @Post('apply-matches')
  applyMatches(@Body() dto: ApplyResultMatchesDto) {
    return this.resultIntakeService.applyMatches(dto);
  }

  @Get('results')
  results(@Query('limit') limit?: string) {
    return this.resultIntakeService.results(limit === undefined ? undefined : Number(limit));
  }

  @Get('latest')
  latest() {
    return this.resultIntakeService.latest();
  }

  @Get('summary')
  summary() {
    return this.resultIntakeService.summary();
  }
}
