import 'reflect-metadata';
import { Types } from 'mongoose';
import { TargetType } from '../../common/enums/target-type.enum';
import { CommentsApplicationService } from './comments.application';

describe('CommentsApplicationService', () => {
  const auditService = {
    recordEventually: jest.fn(),
  };
  const mongoTransactionService = {
    runInTransaction: jest.fn(),
  };
  const contentOperationLockService = {
    runWithContentLock: jest.fn(),
  };
  const notificationService = {
    dispatchCommentNotification: jest.fn(),
    dispatchReplyNotifications: jest.fn(),
  };
  const usersService = {
    findById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists comment threads with explicit string ids for authors and mentions', async () => {
    const commentsRepository = {
      listByTarget: jest.fn().mockResolvedValue({
        items: [
          {
            id: '507f1f77bcf86cd799439091',
            target_type: TargetType.ARTICLE,
            target_id: new Types.ObjectId('507f1f77bcf86cd799439011'),
            author: {
              userId: new Types.ObjectId('507f1f77bcf86cd799439021'),
              name: 'Mono',
              avatarUrl: '/avatars/mono.png',
            },
            content: 'Root comment',
            likeCount: 0,
            reply_count: 1,
            createdAt: new Date('2026-04-18T08:00:00.000Z'),
            replies: [
              {
                replyId: 'reply-1',
                content: 'Reply content',
                createdAt: new Date('2026-04-18T08:05:00.000Z'),
                author: {
                  userId: new Types.ObjectId('507f1f77bcf86cd799439022'),
                  name: 'Reply User',
                  avatarUrl: '/avatars/reply.png',
                },
                mentionedUser: {
                  userId: new Types.ObjectId('507f1f77bcf86cd799439023'),
                  name: 'Mentioned User',
                },
              },
            ],
          },
        ],
        total: 1,
      }),
    };
    const interactionsService = {
      assertTargetExists: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CommentsApplicationService(
      commentsRepository as never,
      interactionsService as never,
      usersService as never,
      auditService as never,
      mongoTransactionService as never,
      contentOperationLockService as never,
      notificationService as never,
    );

    await expect(
      service.listComments(TargetType.ARTICLE, '507f1f77bcf86cd799439011', {
        page: 1,
        limit: 10,
        replyLimit: 5,
      }),
    ).resolves.toEqual({
      targetType: TargetType.ARTICLE,
      targetId: '507f1f77bcf86cd799439011',
      items: [
        {
          id: '507f1f77bcf86cd799439091',
          targetType: TargetType.ARTICLE,
          targetId: '507f1f77bcf86cd799439011',
          author: {
            userId: '507f1f77bcf86cd799439021',
            name: 'Mono',
            avatarUrl: '/avatars/mono.png',
          },
          content: 'Root comment',
          likeCount: 0,
          replyCount: 1,
          createdAt: new Date('2026-04-18T08:00:00.000Z'),
          replies: [
            {
              replyId: 'reply-1',
              content: 'Reply content',
              createdAt: new Date('2026-04-18T08:05:00.000Z'),
              mentionedUser: {
                userId: '507f1f77bcf86cd799439023',
                name: 'Mentioned User',
              },
              author: {
                userId: '507f1f77bcf86cd799439022',
                name: 'Reply User',
                avatarUrl: '/avatars/reply.png',
              },
            },
          ],
        },
      ],
      page: 1,
      limit: 10,
      total: 1,
    });
  });

  it('lists replies with explicit string ids and stable reply totals', async () => {
    const commentsRepository = {
      findById: jest.fn().mockResolvedValue({
        target_type: TargetType.TOPIC,
        target_id: new Types.ObjectId('507f1f77bcf86cd799439031'),
        reply_count: 8,
      }),
      findReplies: jest.fn().mockResolvedValue([
        {
          replyId: 'reply-2',
          content: 'Second reply',
          createdAt: new Date('2026-04-18T09:00:00.000Z'),
          author: {
            userId: new Types.ObjectId('507f1f77bcf86cd799439024'),
            name: 'Second User',
            avatarUrl: '/avatars/second.png',
          },
          mentionedUser: {
            userId: new Types.ObjectId('507f1f77bcf86cd799439025'),
            name: 'Mention Target',
          },
        },
      ]),
    };
    const interactionsService = {
      assertTargetExists: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CommentsApplicationService(
      commentsRepository as never,
      interactionsService as never,
      usersService as never,
      auditService as never,
      mongoTransactionService as never,
      contentOperationLockService as never,
      notificationService as never,
    );

    await expect(service.listReplies('507f1f77bcf86cd799439092', { limit: 20 })).resolves.toEqual({
      commentId: '507f1f77bcf86cd799439092',
      targetType: TargetType.TOPIC,
      targetId: '507f1f77bcf86cd799439031',
      total: 8,
      replies: [
        {
          replyId: 'reply-2',
          content: 'Second reply',
          createdAt: new Date('2026-04-18T09:00:00.000Z'),
          mentionedUser: {
            userId: '507f1f77bcf86cd799439025',
            name: 'Mention Target',
          },
          author: {
            userId: '507f1f77bcf86cd799439024',
            name: 'Second User',
            avatarUrl: '/avatars/second.png',
          },
        },
      ],
    });
  });
});
