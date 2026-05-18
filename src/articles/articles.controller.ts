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
import { ArticlesService } from './articles.service';
import { CreateArticleDto, UpdateArticleDto } from './dto/create-article.dto';
import { QueryArticlesDto, QueryMyArticlesDto } from './dto/query-articles.dto';

@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly searchService: SearchService,
    private readonly workspaceVisitRecorderService: WorkspaceVisitRecorderService,
  ) {}

  @Post()
  @Idempotent(120)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(user.userId, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: JwtUser, @Query() query: QueryMyArticlesDto) {
    return this.articlesService.listMine(user.userId, query);
  }

  @Get('me/:id')
  detailMine(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: JwtUser) {
    return this.articlesService.detailMine(id, user.userId);
  }

  @Patch(':id')
  @Idempotent(120)
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @Idempotent(120)
  deleteArticle(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Query('physicalDelete') physicalDelete: string | undefined,
    @Query('cascadeMedia') cascadeMedia: string | undefined,
    @Req() req: Request,
  ) {
    return this.articlesService.deleteArticle(id, user.userId, {
      physicalDelete: physicalDelete === 'true',
      cascadeMedia: cascadeMedia === 'true',
      traceId: req.traceId,
    });
  }

  @Public()
  @Get()
  list(@Query() query: QueryArticlesDto) {
    return this.articlesService.list(query);
  }

  @Public()
  @Get(':id/related')
  related(@Param('id', ParseObjectIdPipe) id: string, @Query() query: RelatedQueryDto) {
    return this.searchService.related(TargetType.ARTICLE, id, query);
  }

  @Public()
  @Get(':id')
  async detail(@Param('id', ParseObjectIdPipe) id: string, @OptionalCurrentUser() user?: JwtUser) {
    const detail = await this.articlesService.detail(id, user?.userId);
    this.workspaceVisitRecorderService.recordPublicDetailVisit(
      user?.userId,
      TargetType.ARTICLE,
      id,
    );

    return detail;
  }
}
