import { Module } from '@nestjs/common';
import { MoneylineModule } from './moneyline/moneyline.module';
import { HealthController } from './health.controller';

@Module({
  imports: [MoneylineModule],
  controllers: [HealthController],
})
export class AppModule {}
