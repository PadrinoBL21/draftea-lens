import { Module } from '@nestjs/common';
import { MoneylineController } from './moneyline.controller';
import { MoneylineService } from './moneyline.service';

@Module({
  controllers: [MoneylineController],
  providers: [MoneylineService],
})
export class MoneylineModule {}
