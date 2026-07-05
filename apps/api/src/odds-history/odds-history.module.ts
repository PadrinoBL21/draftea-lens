import { Module } from '@nestjs/common';
import { ScannerModule } from '../scanner/scanner.module';
import { OddsHistoryController } from './odds-history.controller';
import { OddsHistoryService } from './odds-history.service';

@Module({
  imports: [ScannerModule],
  controllers: [OddsHistoryController],
  providers: [OddsHistoryService],
})
export class OddsHistoryModule {}
