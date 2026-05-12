import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('me')
  listMyNotifications(@CurrentUser() user: JwtUser, @Query() query: QueryNotificationsDto) {
    return this.notificationService.listMyNotifications(user.userId, query);
  }

  @Patch(':id/read')
  markNotificationRead(@CurrentUser() user: JwtUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.notificationService.markNotificationRead(user.userId, id);
  }

  @Post('read-all')
  markAllNotificationsRead(@CurrentUser() user: JwtUser) {
    return this.notificationService.markAllNotificationsRead(user.userId);
  }
}
