import { Controller, Delete, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { QueryMyHistoryDto } from './dto/history.dto';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('me')
  listMyHistory(@CurrentUser() user: JwtUser, @Query() query: QueryMyHistoryDto) {
    return this.historyService.listMyHistory(user.userId, query);
  }

  @Delete('me')
  clearMyHistory(@CurrentUser() user: JwtUser) {
    return this.historyService.clearMyHistory(user.userId);
  }
}
