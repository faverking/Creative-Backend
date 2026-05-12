import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types, type ClientSession } from 'mongoose';
import { TargetType } from '../common/enums/target-type.enum';
import { sanitizeAvatarUrl } from '../common/utils/avatar-url.util';
import { WorkspaceContentService } from '../workspace/workspace-content.service';
import { NotificationKind, QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationRepository } from './repositories/notification.repository';

interface NotificationActorPayload {
  userId: Types.ObjectId;
  name: string;
  avatarUrl?: string;
}

interface DispatchCommentNotificationParams {
  targetType: TargetType;
  targetId: string;
  actor: NotificationActorPayload;
  excerpt: string;
  commentId: string;
}

interface DispatchReplyNotificationsParams {
  rootCommentAuthorUserId: string;
  mentionedUserId?: string;
  actor: NotificationActorPayload;
  targetType: TargetType;
  targetId: string;
  excerpt: string;
  context?: string;
  commentId: string;
  replyId: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly workspaceContentService: WorkspaceContentService,
  ) {}

  async listMyNotifications(userId: string, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter: Record<string, unknown> = {
      user_id: new Types.ObjectId(userId),
    };

    if (query.kind) {
      filter.kind = query.kind;
    }

    if (typeof query.unread === 'boolean') {
      filter.unread = query.unread;
    }

    return this.loadVisibleNotificationsPage(userId, filter, page, limit);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const updated = await this.notificationRepository.markRead(notificationId, userId);
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }

    return {
      id: updated.id,
      unread: updated.unread,
      readAt: updated.read_at,
    };
  }

  async markAllNotificationsRead(userId: string) {
    const updatedCount = await this.notificationRepository.markAllRead(userId);

    return {
      success: true as const,
      updatedCount,
    };
  }

  dispatchCommentNotification(params: DispatchCommentNotificationParams): void {
    setImmediate(() => {
      void this.createCommentNotification(
        params.targetType,
        params.targetId,
        params.actor,
        params.excerpt,
        params.commentId,
      ).catch((error: unknown) => {
        this.logDispatchFailure('comment', params.targetType, params.targetId, params.actor.userId.toString(), error);
      });
    });
  }

  dispatchReplyNotifications(params: DispatchReplyNotificationsParams): void {
    setImmediate(() => {
      void this.createReplyNotificationsForReply(params).catch((error: unknown) => {
        this.logDispatchFailure('reply', params.targetType, params.targetId, params.actor.userId.toString(), error);
      });
    });
  }

  async createCommentNotification(
    targetType: TargetType,
    targetId: string,
    actor: NotificationActorPayload,
    excerpt: string,
    commentId: string,
    session?: ClientSession,
  ): Promise<void> {
    const targetOwner = await this.workspaceContentService.getTargetOwner(targetType, targetId, session);
    if (!targetOwner || targetOwner.userId === actor.userId.toString()) {
      return;
    }

    await this.notificationRepository.create(
      {
        user_id: new Types.ObjectId(targetOwner.userId),
        kind: NotificationKind.COMMENT,
        actor: this.toActorSnapshot(actor),
        target_type: targetType,
        target_id: targetId,
        comment_id: new Types.ObjectId(commentId),
        excerpt,
        unread: true,
      },
      session,
    );
  }

  async createReplyNotification(params: {
    recipientUserId: string;
    actor: NotificationActorPayload;
    targetType: TargetType;
    targetId: string;
    excerpt: string;
    context?: string;
    commentId: string;
    replyId: string;
    session?: ClientSession;
  }): Promise<void> {
    if (params.recipientUserId === params.actor.userId.toString()) {
      return;
    }

    await this.notificationRepository.create(
      {
        user_id: new Types.ObjectId(params.recipientUserId),
        kind: NotificationKind.REPLY,
        actor: this.toActorSnapshot(params.actor),
        target_type: params.targetType,
        target_id: params.targetId,
        comment_id: new Types.ObjectId(params.commentId),
        reply_id: params.replyId,
        excerpt: params.excerpt,
        context: params.context,
        unread: true,
      },
      params.session,
    );
  }

  private async createReplyNotificationsForReply(params: DispatchReplyNotificationsParams): Promise<void> {
    const recipientUserIds = new Set<string>([params.rootCommentAuthorUserId]);
    if (params.mentionedUserId) {
      recipientUserIds.add(params.mentionedUserId);
    }

    for (const recipientUserId of recipientUserIds) {
      await this.createReplyNotification({
        recipientUserId,
        actor: params.actor,
        targetType: params.targetType,
        targetId: params.targetId,
        excerpt: params.excerpt,
        context: params.context,
        commentId: params.commentId,
        replyId: params.replyId,
      });
    }
  }

  private toActorSnapshot(actor: NotificationActorPayload) {
    return {
      userId: actor.userId,
      name: actor.name,
      avatarUrl: sanitizeAvatarUrl(actor.avatarUrl),
    };
  }

  private logDispatchFailure(
    kind: 'comment' | 'reply',
    targetType: TargetType,
    targetId: string,
    actorUserId: string,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : 'Unknown notification dispatch error';
    this.logger.warn(
      `Failed to dispatch ${kind} notification: targetType=${targetType}, targetId=${targetId}, actorUserId=${actorUserId}, reason=${message}`,
    );
  }

  private async loadVisibleNotificationsPage(
    userId: string,
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{
    items: Array<{
      id: string;
      unread: boolean;
      kind: string;
      createdAt: Date;
      actor: {
        id: string;
        name: string;
        avatarUrl: string;
      };
      excerpt: string;
      context?: string;
      commentId?: string;
      replyId?: string;
      target: {
        type: string;
        id: string;
        title: string;
        meta: Record<string, unknown>;
      };
      primaryAction: {
        type: string;
        targetType: string;
        targetId: string;
      };
      secondaryAction?:
        | {
            type: string;
            notificationId: string;
          }
        | undefined;
    }>;
    page: number;
    limit: number;
    total: number;
    unreadTotal: number;
  }> {
    const [{ items, total }, unreadTotal] = await Promise.all([
      this.notificationRepository.list(filter, page, limit),
      this.notificationRepository.countUnreadByUser(userId),
    ]);
    const contentMap = await this.workspaceContentService.getContentSummaryMap(
      items.map((item) => ({
        targetType: item.target_type,
        targetId: item.target_id,
      })),
    );
    const hiddenItemIds = items
      .filter((item) => !contentMap.has(`${item.target_type}:${item.target_id}`))
      .map((item) => item.id);

    if (hiddenItemIds.length > 0) {
      await this.notificationRepository.deleteManyByIds(hiddenItemIds);
      return this.loadVisibleNotificationsPage(userId, filter, page, limit);
    }

    return {
      items: items.map((item) => {
        const content = contentMap.get(`${item.target_type}:${item.target_id}`)!;

        return {
          id: item.id,
          unread: item.unread,
          kind: item.kind,
          createdAt: item.created_at,
          actor: {
            id: item.actor.userId.toString(),
            name: item.actor.name,
            avatarUrl: sanitizeAvatarUrl(item.actor.avatarUrl),
          },
          excerpt: item.excerpt,
          context: item.context,
          commentId: item.comment_id?.toString(),
          replyId: item.reply_id,
          target: {
            type: item.target_type,
            id: item.target_id,
            title: content.title,
            meta: content.meta,
          },
          primaryAction: {
            type: 'view-target',
            targetType: item.target_type,
            targetId: item.target_id,
          },
          secondaryAction: item.unread
            ? {
                type: 'mark-read',
                notificationId: item.id,
              }
            : undefined,
        };
      }),
      page,
      limit,
      total,
      unreadTotal,
    };
  }
}
