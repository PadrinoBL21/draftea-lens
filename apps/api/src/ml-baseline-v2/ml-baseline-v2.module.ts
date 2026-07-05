import { Module } from '@nestjs/common';
import { MlBaselineV2Controller } from './ml-baseline-v2.controller';
import { MlBaselineV2Service } from './ml-baseline-v2.service';

@Module({
  controllers: [MlBaselineV2Controller],
  providers: [MlBaselineV2Service],
})
export class MlBaselineV2Module {}
