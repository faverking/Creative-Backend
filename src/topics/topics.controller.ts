import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { OptionalCurrentUser } from '../common/decorators/optional-current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { TargetType } from '../common/enums/target-type.enum';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RelatedQueryDto } from '../search/dto/search.dto';
import { SearchService } from '../search/search.service';
import { WorkspaceVisitRecorderService } from '../workspace/workspace-visit-recorder.service';
import { TopicsApplicationService } from './application/topics.application';
import { CreateTopicDto, QueryMyTopicsDto, QueryTopicsDto, UpdateTopicDto } from './dto/topic.dto';

@Controller('topics')
export class TopicsController {
  constructor(
    private readonly topicsApplicationService: TopicsApplicationService,
    private readonly searchService: SearchService,
    private readonly workspaceVisitRecorderService: WorkspaceVisitRecorderService,
  ) {}

  @Post()
  @Idempotent(120)
  createTopic(@CurrentUser() user: JwtUser, @Body() dto: CreateTopicDto, @Req() req: Request) {
    return this.topicsApplicationService.createTopic(dto, user.userId, req.traceId);
  }

  @Get('me')
  listMyTopics(@CurrentUser() user: JwtUser, @Query() query: QueryMyTopicsDto) {
    return this.topicsApplicationService.listMyTopics(user.userId, query);
  }

  @Get('me/:id')
  getMyTopicDetail(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: JwtUser) {
    return this.topicsApplicationService.getMyTopicDetail(id, user.userId);
  }

  @Patch(':id')
  @Idempotent(120)
  updateTopic(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateTopicDto,
    @Req() req: Request,
  ) {
    return this.topicsApplicationService.updateTopic(id, user.userId, dto, req.traceId);
  }

  @Delete(':id')
  @Idempotent(120)
  deleteTopic(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Query('cascadeMedia') cascadeMedia: string | undefined,
    @Req() req: Request,
  ) {
    return this.topicsApplicationService.deleteTopic(id, user.userId, cascadeMedia === 'true', req.traceId);
  }

  @Public()
  @Get()
  listTopics(@Query() query: QueryTopicsDto, @OptionalCurrentUser() user?: JwtUser) {
    return this.topicsApplicationService.listTopics(query, user?.userId);
  }

  @Public()
  @Get(':id/related')
  related(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: RelatedQueryDto,
  ) {
    return this.searchService.related(TargetType.TOPIC, id, query);
  }

  @Public()
  @Get(':id')
  async getTopicDetail(@Param('id', ParseObjectIdPipe) id: string, @OptionalCurrentUser() user?: JwtUser) {
    const detail = await this.topicsApplicationService.getTopicDetail(id, user?.userId);
    this.workspaceVisitRecorderService.recordPublicDetailVisit(user?.userId, TargetType.TOPIC, id);

    return detail;
  }
}
