import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { sanitizeAvatarUrl } from '../../common/utils/avatar-url.util';
import { TargetType } from '../../common/enums/target-type.enum';
import { AuditService } from '../../infra/audit/audit.service';
import { MongoTransactionService } from '../../infra/database/mongo-transaction.service';
import { ContentOperationLockService } from '../../infra/redis/content-operation-lock.service';
import { InteractionsService } from '../../interactions/interactions.service';
import { NotificationService } from '../../notification/notification.service';
import { UsersService } from '../../users/users.service';
import { CreateCommentDto, QueryCommentsDto, QueryRepliesDto, ReplyCommentDto } from '../dto/comment.dto';
import { CommentsRepository } from '../repositories/comments.repository';
import type { CommentDocument } from '../schemas/comment.schema';

@Injectable()
export class CommentsApplicationService {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly interactionsService: InteractionsService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly mongoTransactionService: MongoTransactionService,
    private readonly contentOperationLockService: ContentOperationLockService,
    private readonly notificationService: NotificationService,
  ) {}

  async createComment(
    targetType: TargetType,
    targetId: string,
    userId: string,
    dto: CreateCommentDto,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(targetType, targetId, async () => {
      const [user] = await Promise.all([
        this.usersService.findById(userId),
        this.interactionsService.assertTargetExists(targetType, targetId),
      ]);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const actor = {
        userId: user._id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };

      const created = await this.mongoTransactionService.runInTransaction(async (session) => {
        const createdComment = await this.commentsRepository.createMainComment(
          {
            target_type: targetType,
            target_id: new Types.ObjectId(targetId),
            author: {
              userId: user._id,
              name: user.name,
              avatarUrl: sanitizeAvatarUrl(user.avatarUrl),
            },
            user_id: user._id,
            content: dto.content,
            likeCount: 0,
            reply_count: 0,
            replies: [],
          },
          session,
        );

        await this.interactionsService.incrementReplyCount(targetType, targetId, 1, session);
        return createdComment;
      });

      this.notificationService.dispatchCommentNotification({
        targetType,
        targetId,
        actor,
        excerpt: dto.content,
        commentId: created.id,
      });

      this.auditService.recordEventually({
        operatorId: userId,
        action: 'comment.create',
        resourceType: 'comment',
        resourceId: created.id,
        after: {
          targetType,
          targetId,
        },
        ip,
        ua,
        traceId,
      });

      return this.toCommentItem(created);
    });
  }

  async listComments(targetType: TargetType, targetId: string, query: QueryCommentsDto): Promise<unknown> {
    await this.interactionsService.assertTargetExists(targetType, targetId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const replyLimit = query.replyLimit ?? 10;

    const { items, total } = await this.commentsRepository.listByTarget(targetType, targetId, page, limit, replyLimit);

    return {
      targetType,
      targetId,
      items: items.map((item) => this.toCommentItem(item)),
      page,
      limit,
      total,
    };
  }

  async replyComment(
    commentId: string,
    userId: string,
    dto: ReplyCommentDto,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<unknown> {
    const rootComment = await this.commentsRepository.findById(commentId);
    if (!rootComment) {
      throw new NotFoundException('Comment not found');
    }

    return this.contentOperationLockService.runWithContentLock(
      rootComment.target_type,
      rootComment.target_id.toString(),
      async () => {
        const [latestRootComment, user] = await Promise.all([
          this.commentsRepository.findById(commentId),
          this.usersService.findById(userId),
        ]);

        if (!latestRootComment) {
          throw new NotFoundException('Comment not found');
        }

        await this.interactionsService.assertTargetExists(
          latestRootComment.target_type,
          latestRootComment.target_id.toString(),
        );

        if (!user) {
          throw new NotFoundException('User not found');
        }

        let mentionedUser:
          | {
              userId: Types.ObjectId;
              name: string;
            }
          | undefined;

        if (dto.mentionUserId) {
          const mentioned = await this.usersService.findById(dto.mentionUserId);
          if (!mentioned) {
            throw new NotFoundException('Mentioned user not found');
          }

          mentionedUser = {
            userId: mentioned._id,
            name: mentioned.name,
          };
        }

        const reply = {
          replyId: new Types.ObjectId().toString(),
          author: {
            userId: user._id,
            name: user.name,
            avatarUrl: sanitizeAvatarUrl(user.avatarUrl),
          },
          content: dto.content,
          createdAt: new Date(),
          mentionedUser,
        };

        const actor = {
          userId: user._id,
          name: user.name,
          avatarUrl: user.avatarUrl,
        };

        const result = await this.mongoTransactionService.runInTransaction(async (session) => {
          const latestComment = await this.commentsRepository.findById(commentId, session);
          if (!latestComment) {
            throw new NotFoundException('Comment not found');
          }

          const updated = await this.commentsRepository.appendReply(commentId, reply, session);
          if (!updated) {
            throw new NotFoundException('Comment not found');
          }

          const targetId = latestComment.target_id.toString();
          await this.interactionsService.incrementReplyCount(latestComment.target_type, targetId, 1, session);
          return {
            targetType: latestComment.target_type,
            targetId,
            replyCount: updated.reply_count ?? 0,
            latestReply: updated.replies[0],
            rootCommentAuthorUserId: latestComment.user_id.toString(),
            mentionedUserId: mentionedUser?.userId.toString(),
            context: latestComment.content,
          };
        });

        this.notificationService.dispatchReplyNotifications({
          rootCommentAuthorUserId: result.rootCommentAuthorUserId,
          mentionedUserId: result.mentionedUserId,
          actor,
          targetType: result.targetType,
          targetId: result.targetId,
          excerpt: reply.content,
          context: result.context,
          commentId,
          replyId: reply.replyId,
        });

        this.auditService.recordEventually({
          operatorId: userId,
          action: 'comment.reply',
          resourceType: 'comment',
          resourceId: commentId,
          after: {
            targetType: result.targetType,
            targetId: result.targetId,
          },
          ip,
          ua,
          traceId,
        });

        return {
          commentId,
          ...result,
          latestReply: this.toReplyItem(result.latestReply),
        };
      },
    );
  }

  async listReplies(commentId: string, query: QueryRepliesDto): Promise<unknown> {
    const rootComment = await this.commentsRepository.findById(commentId);
    if (!rootComment) {
      throw new NotFoundException('Comment not found');
    }

    const targetId = rootComment.target_id.toString();
    await this.interactionsService.assertTargetExists(rootComment.target_type, targetId);

    const limit = query.limit ?? 50;
    const replies = await this.commentsRepository.findReplies(commentId, limit);

    return {
      commentId,
      targetType: rootComment.target_type,
      targetId,
      total: rootComment.reply_count ?? replies.length,
      replies: replies.map((reply) => this.toReplyItem(reply)),
    };
  }

  private toCommentItem(comment: CommentDocument) {
    return {
      id: comment.id,
      targetType: comment.target_type,
      targetId: comment.target_id.toString(),
      author: this.toAuthorItem(comment.author),
      content: comment.content,
      likeCount: comment.likeCount,
      replyCount: comment.reply_count ?? 0,
      createdAt: comment.createdAt,
      replies: comment.replies.map((reply) => this.toReplyItem(reply)),
    };
  }

  private toReplyItem(reply: CommentDocument['replies'][number]) {
    return {
      replyId: reply.replyId,
      content: reply.content,
      createdAt: reply.createdAt,
      mentionedUser: reply.mentionedUser
        ? {
            userId: reply.mentionedUser.userId.toString(),
            name: reply.mentionedUser.name,
          }
        : undefined,
      author: this.toAuthorItem(reply.author),
    };
  }

  private toAuthorItem(author: CommentDocument['author']) {
    return {
      userId: author.userId.toString(),
      name: author.name,
      avatarUrl: sanitizeAvatarUrl(author.avatarUrl),
    };
  }
}
