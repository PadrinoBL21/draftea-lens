import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { EvaluateModelDto } from './dto/evaluate-model.dto';
import { PromoteModelDto } from './dto/promote-model.dto';
import { RegisterModelDto } from './dto/register-model.dto';
import { ModelRegistryService } from './model-registry.service';
import type { ModelRegistryStatus } from './model-registry.types';

@Controller('model-registry')
export class ModelRegistryController {
  constructor(private readonly modelRegistryService: ModelRegistryService) {}

  @Get('models')
  listModels(@Query('status') status?: ModelRegistryStatus) {
    return this.modelRegistryService.listModels(status);
  }

  @Get('latest')
  latest() {
    return this.modelRegistryService.latest();
  }

  @Get('summary')
  summary() {
    return this.modelRegistryService.summary();
  }

  @Post('register')
  register(@Body() dto: RegisterModelDto) {
    return this.modelRegistryService.register(dto);
  }

  @Post('evaluate')
  evaluate(@Body() dto: EvaluateModelDto) {
    return this.modelRegistryService.evaluate(dto);
  }

  @Post('promote')
  promote(@Body() dto: PromoteModelDto) {
    return this.modelRegistryService.promote(dto);
  }
}
