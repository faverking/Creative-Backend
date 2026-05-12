import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotency.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { DraftsApplicationService } from './application/drafts.application';
import { CreateDraftDto, QueryMyDraftsDto, UpdateDraftDto } from './dto/draft.dto';

@Controller('drafts')
export class DraftsController {
  constructor(private readonly draftsApplicationService: DraftsApplicationService) {}

  @Post()
  @Idempotent(120)
  createDraft(@CurrentUser() user: JwtUser, @Body() dto: CreateDraftDto, @Req() req: Request) {
    return this.draftsApplicationService.createDraft(user.userId, dto, req.traceId);
  }

  @Get('me')
  listMyDrafts(@CurrentUser() user: JwtUser, @Query() query: QueryMyDraftsDto) {
    return this.draftsApplicationService.listMyDrafts(user.userId, query);
  }

  @Get(':id')
  getDraftDetail(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: JwtUser) {
    return this.draftsApplicationService.getDraftDetail(id, user.userId);
  }

  @Patch(':id')
  @Idempotent(60)
  updateDraft(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateDraftDto,
    @Req() req: Request,
  ) {
    return this.draftsApplicationService.updateDraft(id, user.userId, dto, req.traceId);
  }

  @Delete(':id')
  @Idempotent(60)
  deleteDraft(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.draftsApplicationService.deleteDraft(id, user.userId, req.traceId);
  }
}

