import { Module } from '@nestjs/common';
import { ModelGovernanceController } from './model-governance.controller';
import { ModelGovernanceService } from './model-governance.service';

@Module({
  controllers: [ModelGovernanceController],
  providers: [ModelGovernanceService],
})
export class ModelGovernanceModule {}
