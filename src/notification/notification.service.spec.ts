import 'reflect-metadata';
import { Types } from 'mongoose';
import { TargetType } from '../common/enums/target-type.enum';
import { NotificationKind } from './dto/query-notifications.dto';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  it('lists notifications with resolved target metadata and actions', async () => {
    const notificationRepository = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: '507f1f77bcf86cd799439099',
            unread: true,
            kind: NotificationKind.REPLY,
            created_at: new Date('2026-04-17T12:00:00.000Z'),
            actor: {
              userId: new Types.ObjectId('507f1f77bcf86cd799439021'),
              name: 'Mono',
              avatarUrl: '/avatars/mono.png',
            },
            excerpt: 'Nice article',
            context: 'Root comment',
            target_type: TargetType.ARTICLE,
            target_id: '507f1f77bcf86cd799439011',
            comment_id: new Types.ObjectId('507f1f77bcf86cd799439055'),
            reply_id: 'reply-1',
          },
        ],
        total: 1,
      }),
      countUnreadByUser: jest.fn().mockResolvedValue(3),
    };
    const workspaceContentService = {
      getContentSummaryMap: jest.fn().mockResolvedValue(
        new Map([
          [
            `${TargetType.ARTICLE}:507f1f77bcf86cd799439011`,
            {
              title: 'Article title',
              meta: {
                viewCount: 99,
              },
            },
          ],
        ]),
      ),
    };
    const service = new NotificationService(notificationRepository as never, workspaceContentService as never);

    await expect(service.listMyNotifications('507f1f77bcf86cd799439012', {})).resolves.toEqual({
      items: [
        {
          id: '507f1f77bcf86cd799439099',
          unread: true,
          kind: NotificationKind.REPLY,
          createdAt: new Date('2026-04-17T12:00:00.000Z'),
          actor: {
            id: '507f1f77bcf86cd799439021',
            name: 'Mono',
            avatarUrl: '/avatars/mono.png',
          },
          excerpt: 'Nice article',
          context: 'Root comment',
          commentId: '507f1f77bcf86cd799439055',
          replyId: 'reply-1',
          target: {
            type: TargetType.ARTICLE,
            id: '507f1f77bcf86cd799439011',
            title: 'Article title',
            meta: {
              viewCount: 99,
            },
          },
          primaryAction: {
            type: 'view-target',
            targetType: TargetType.ARTICLE,
            targetId: '507f1f77bcf86cd799439011',
          },
          secondaryAction: {
            type: 'mark-read',
            notificationId: '507f1f77bcf86cd799439099',
          },
        },
      ],
      page: 1,
      limit: 10,
      total: 1,
      unreadTotal: 3,
    });
  });

  it('skips self-comment notifications for target owners', async () => {
    const notificationRepository = {
      create: jest.fn(),
    };
    const workspaceContentService = {
      getTargetOwner: jest.fn().mockResolvedValue({
        userId: '507f1f77bcf86cd799439021',
        targetId: '507f1f77bcf86cd799439011',
      }),
    };
    const service = new NotificationService(notificationRepository as never, workspaceContentService as never);

    await service.createCommentNotification(
      TargetType.ARTICLE,
      '507f1f77bcf86cd799439011',
      {
        userId: new Types.ObjectId('507f1f77bcf86cd799439021'),
        name: 'Mono',
        avatarUrl: '/avatars/mono.png',
      },
      'Nice article',
      '507f1f77bcf86cd799439099',
    );

    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it('self-heals notifications whose targets are no longer visible', async () => {
    const notificationRepository = {
      list: jest
        .fn()
        .mockResolvedValueOnce({
          items: [
            {
              id: '507f1f77bcf86cd799439099',
              unread: true,
              kind: NotificationKind.COMMENT,
              created_at: new Date('2026-04-17T12:00:00.000Z'),
              actor: {
                userId: new Types.ObjectId('507f1f77bcf86cd799439021'),
                name: 'Mono',
                avatarUrl: '/avatars/mono.png',
              },
              excerpt: 'Nice article',
              context: undefined,
              target_type: TargetType.ARTICLE,
              target_id: '507f1f77bcf86cd799439011',
            },
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          items: [],
          total: 0,
        }),
      countUnreadByUser: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      deleteManyByIds: jest.fn().mockResolvedValue(1),
    };
    const workspaceContentService = {
      getContentSummaryMap: jest
        .fn()
        .mockResolvedValueOnce(new Map())
        .mockResolvedValueOnce(new Map()),
    };
    const service = new NotificationService(notificationRepository as never, workspaceContentService as never);

    await expect(service.listMyNotifications('507f1f77bcf86cd799439012', {})).resolves.toEqual({
      items: [],
      page: 1,
      limit: 10,
      total: 0,
      unreadTotal: 0,
    });

    expect(notificationRepository.deleteManyByIds).toHaveBeenCalledWith(['507f1f77bcf86cd799439099']);
  });

  it('dispatches reply notifications once per distinct recipient', async () => {
    jest.useFakeTimers();

    const notificationRepository = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const workspaceContentService = {
      getTargetOwner: jest.fn(),
    };
    const service = new NotificationService(notificationRepository as never, workspaceContentService as never);

    service.dispatchReplyNotifications({
      rootCommentAuthorUserId: '507f1f77bcf86cd799439012',
      mentionedUserId: '507f1f77bcf86cd799439012',
      actor: {
        userId: new Types.ObjectId('507f1f77bcf86cd799439021'),
        name: 'Mono',
        avatarUrl: '/avatars/mono.png',
      },
      targetType: TargetType.TOPIC,
      targetId: '507f1f77bcf86cd799439011',
      excerpt: 'Thanks',
      context: 'Original comment',
      commentId: '507f1f77bcf86cd799439099',
      replyId: 'reply-1',
    });

    await jest.runAllTimersAsync();

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
