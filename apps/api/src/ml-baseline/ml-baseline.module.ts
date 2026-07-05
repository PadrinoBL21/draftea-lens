import { Module } from '@nestjs/common';
import { MlBaselineController } from './ml-baseline.controller';
import { MlBaselineService } from './ml-baseline.service';

@Module({
  controllers: [MlBaselineController],
  providers: [MlBaselineService],
})
export class MlBaselineModule {}
