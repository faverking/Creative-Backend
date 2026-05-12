import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../common/constants/roles';
import { JwtUser } from '../common/interfaces/jwt-user.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { QueryUserBusinessDailyStatsDto } from './dto/query-user-business-daily-stats.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserBusinessStatsService } from './user-business-stats.service';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userBusinessStatsService: UserBusinessStatsService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.usersService.getSafeProfileById(user.userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Get('me/business-stats')
  getMyBusinessStats(@CurrentUser() user: JwtUser) {
    return this.userBusinessStatsService.getUserBusinessStats(user.userId);
  }

  @Get('me/business-stats/daily')
  getMyDailyBusinessStats(
    @CurrentUser() user: JwtUser,
    @Query() query: QueryUserBusinessDailyStatsDto,
  ) {
    return this.userBusinessStatsService.getUserDailyBusinessStats(user.userId, query);
  }

  @Public()
  @Get('business-stats/daily')
  getPublicDailyBusinessStats(@Query() query: QueryUserBusinessDailyStatsDto) {
    return this.userBusinessStatsService.getPublicDailyBusinessStats(query);
  }

  @Public()
  @Get(':id/profile')
  getPublicProfile(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.getPublicProfileById(id);
  }

  @Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
  @Patch(':id/status')
  updateUserStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetUserStatusDto,
  ) {
    return this.usersService.setStatus(id, dto.status);
  }
}
