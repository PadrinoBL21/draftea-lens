import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EvaluateChallengerDto } from './dto/evaluate-challenger.dto';
import { PromoteChallengerDto } from './dto/promote-challenger.dto';
import { ModelGovernanceService } from './model-governance.service';

@Controller('model-governance')
export class ModelGovernanceController {
  constructor(private readonly governanceService: ModelGovernanceService) {}

  @Post('evaluate')
  evaluate(@Body() dto: EvaluateChallengerDto) {
    return this.governanceService.evaluate(dto);
  }

  @Post('promote')
  promote(@Body() dto: PromoteChallengerDto) {
    return this.governanceService.promote(dto);
  }

  @Get('champion')
  champion() {
    return this.governanceService.champion();
  }

  @Get('evaluations')
  evaluations(@Query('limit') limit?: string) {
    return this.governanceService.evaluations(Number(limit) || 20);
  }

  @Get('summary')
  summary() {
    return this.governanceService.summary();
  }
}
