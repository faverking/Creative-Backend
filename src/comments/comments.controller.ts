import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TargetType } from '../common/enums/target-type.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { CommentsApplicationService } from './application/comments.application';
import { CreateCommentDto, QueryCommentsDto, QueryRepliesDto, ReplyCommentDto } from './dto/comment.dto';

@Controller()
export class CommentsController {
  constructor(private readonly commentsApplicationService: CommentsApplicationService) {}

  @Post('articles/:targetId/comments')
  @Idempotent(60)
  createArticleComment(
    @Param('targetId', ParseObjectIdPipe) targetId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    return this.createTargetComment(TargetType.ARTICLE, targetId, user, dto, req);
  }

  @Public()
  @Get('articles/:targetId/comments')
  listArticleComments(
    @Param('targetId', ParseObjectIdPipe) targetId: string,
    @Query() query: QueryCommentsDto,
  ) {
    return this.commentsApplicationService.listComments(TargetType.ARTICLE, targetId, query);
  }

  @Post('books/:targetId/comments')
  @Idempotent(60)
  createBookComment(
    @Param('targetId', ParseObjectIdPipe) targetId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    return this.createTargetComment(TargetType.BOOK, targetId, user, dto, req);
  }

  @Public()
  @Get('books/:targetId/comments')
  listBookComments(
    @Param('targetId', ParseObjectIdPipe) targetId: string,
    @Query() query: QueryCommentsDto,
  ) {
    return this.commentsApplicationService.listComments(TargetType.BOOK, targetId, query);
  }

  @Post('topics/:targetId/comments')
  @Idempotent(60)
  createTopicComment(
    @Param('targetId', ParseObjectIdPipe) targetId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    return this.createTargetComment(TargetType.TOPIC, targetId, user, dto, req);
  }

  @Public()
  @Get('topics/:targetId/comments')
  listTopicComments(
    @Param('targetId', ParseObjectIdPipe) targetId: string,
    @Query() query: QueryCommentsDto,
  ) {
    return this.commentsApplicationService.listComments(TargetType.TOPIC, targetId, query);
  }

  @Post('images/:targetId/comments')
  @Idempotent(60)
  createImageComment(
    @Param('targetId', ParseObjectIdPipe) targetId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    return this.createTargetComment(TargetType.IMAGE, targetId, user, dto, req);
  }

  @Public()
  @Get('images/:targetId/comments')
  listImageComments(
    @Param('targetId', ParseObjectIdPipe) targetId: string,
    @Query() query: QueryCommentsDto,
  ) {
    return this.commentsApplicationService.listComments(TargetType.IMAGE, targetId, query);
  }

  @Post('comments/:id/replies')
  @Idempotent(60)
  replyComment(
    @Param('id', ParseObjectIdPipe) commentId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReplyCommentDto,
    @Req() req: Request,
  ) {
    return this.commentsApplicationService.replyComment(
      commentId,
      user.userId,
      dto,
      req.traceId,
      getClientIp(req),
      getUserAgent(req),
    );
  }

  @Public()
  @Get('comments/:id/replies')
  listReplies(@Param('id', ParseObjectIdPipe) commentId: string, @Query() query: QueryRepliesDto) {
    return this.commentsApplicationService.listReplies(commentId, query);
  }

  private createTargetComment(
    targetType: TargetType,
    targetId: string,
    user: JwtUser,
    dto: CreateCommentDto,
    req: Request,
  ) {
    return this.commentsApplicationService.createComment(
      targetType,
      targetId,
      user.userId,
      dto,
      req.traceId,
      getClientIp(req),
      getUserAgent(req),
    );
  }
}
