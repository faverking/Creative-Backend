import { Controller, Delete, Get, Param, ParseEnumPipe, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TargetType } from '../common/enums/target-type.enum';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { AdminContentService } from './admin-content.service';
import {
  DeleteAdminContentDto,
  QueryAdminContentDetailDto,
  QueryAdminContentsDto,
  QueryAdminContentSummaryDto,
} from './dto/admin-content.dto';

@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  @Get('summary')
  @Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
  summary(@CurrentUser() user: JwtUser, @Query() query: QueryAdminContentSummaryDto) {
    return this.adminContentService.summary(user, query);
  }

  @Get()
  @Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
  list(@CurrentUser() user: JwtUser, @Query() query: QueryAdminContentsDto) {
    return this.adminContentService.list(user, query);
  }

  @Delete(':type/:id')
  @Roles(ROLE_SUPER_ADMIN)
  @Idempotent(60)
  delete(
    @Param('type', new ParseEnumPipe(TargetType)) type: TargetType,
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Query() query: DeleteAdminContentDto,
    @Req() req: Request,
  ) {
    return this.adminContentService.deletePermanently(type, id, user, query, req.traceId, getClientIp(req), getUserAgent(req));
  }

  @Patch(':type/:id/private')
  @Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
  @Idempotent(60)
  setPrivate(
    @Param('type', new ParseEnumPipe(TargetType)) type: TargetType,
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.adminContentService.setPrivate(type, id, user, req.traceId, getClientIp(req), getUserAgent(req));
  }

  @Get(':type/:id')
  @Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
  detail(
    @Param('type', new ParseEnumPipe(TargetType)) type: TargetType,
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Query() query: QueryAdminContentDetailDto,
  ) {
    return this.adminContentService.detail(type, id, user, query);
  }
}
