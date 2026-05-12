import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import {
  CancelFeaturedContentDto,
  QueryFeaturedContentsDto,
  UpsertFeaturedContentDto,
} from './dto/featured-content.dto';
import { FeaturedContentsService } from './featured-contents.service';

@Controller('admin/featured-contents')
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
export class FeaturedContentsController {
  constructor(private readonly featuredContentsService: FeaturedContentsService) {}

  @Get()
  list(@Query() query: QueryFeaturedContentsDto) {
    return this.featuredContentsService.list(query);
  }

  @Post()
  @Idempotent(60)
  upsert(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertFeaturedContentDto,
    @Req() req: Request,
  ) {
    return this.featuredContentsService.upsert(
      dto,
      user.userId,
      req.traceId,
      getClientIp(req),
      getUserAgent(req),
    );
  }

  @Post('cancel')
  @Idempotent(60)
  cancel(
    @CurrentUser() user: JwtUser,
    @Body() dto: CancelFeaturedContentDto,
    @Req() req: Request,
  ) {
    return this.featuredContentsService.cancel(
      dto,
      user.userId,
      req.traceId,
      getClientIp(req),
      getUserAgent(req),
    );
  }
}
