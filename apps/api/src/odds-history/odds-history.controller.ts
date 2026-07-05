import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateOddsSnapshotDto } from './dto/create-odds-snapshot.dto';
import { OddsHistoryService } from './odds-history.service';

@Controller('odds-history')
export class OddsHistoryController {
  constructor(private readonly oddsHistoryService: OddsHistoryService) {}

  @Post('snapshot')
  snapshot(@Body() dto: CreateOddsSnapshotDto) {
    return this.oddsHistoryService.createSnapshot(dto);
  }

  @Get('snapshots')
  snapshots(@Query('limit') limit?: string) {
    return this.oddsHistoryService.listLatestSnapshots(Number(limit) || 10);
  }

  @Get('lines')
  lines(@Query('limit') limit?: string, @Query('eventId') eventId?: string, @Query('lineId') lineId?: string) {
    return this.oddsHistoryService.listLines({
      limit: Number(limit) || 50,
      eventId,
      lineId,
    });
  }

  @Get('movements')
  movements(@Query('limit') limit?: string) {
    return this.oddsHistoryService.listMovements(Number(limit) || 25);
  }

  @Get('summary')
  summary() {
    return this.oddsHistoryService.summary();
  }
}
