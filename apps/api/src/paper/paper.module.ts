import { Module } from '@nestjs/common';
import { ScannerModule } from '../scanner/scanner.module';
import { PaperController } from './paper.controller';
import { PaperService } from './paper.service';

@Module({
  imports: [ScannerModule],
  controllers: [PaperController],
  providers: [PaperService],
})
export class PaperModule {}
