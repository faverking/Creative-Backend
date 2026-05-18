import 'reflect-metadata';
import { Types } from 'mongoose';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { Visibility } from '../../common/enums/visibility.enum';
import { TopicsApplicationService } from './topics.application';

describe('TopicsApplicationService', () => {
  const auditService = {
    recordEventually: jest.fn(),
  };
  const mediaApplicationService = {
    getMediaSummaryMap: jest.fn().mockResolvedValue(new Map()),
    assertMediaIdsExist: jest.fn(),
    deleteOwnedImagesIfUnreferenced: jest.fn(),
  };
  const mongoTransactionService = {
    runInTransaction: jest.fn(),
  };
  const contentOperationLockService = {
    runWithContentLock: jest.fn(),
  };
  const usersService = {
    getSafeProfileMap: jest.fn().mockResolvedValue(new Map()),
  };
  const favoritesService = {
    isFavorited: jest.fn().mockResolvedValue(false),
  };
  const workspaceRelationCleanupService = {
    cleanupDeletedTarget: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides downloadUrl in public topic list for anonymous viewers', async () => {
    const topicsRepository = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: '507f1f77bcf86cd799439091',
            topic_id: 1,
            type_id: 2,
            title: 'Topic',
            images: [],
            desc: 'Topic summary',
            download_url: 'https://downloads.example.com/topic.zip',
            user_id: new Types.ObjectId('507f1f77bcf86cd799439021'),
            feature_flags: [1, 3, 5],
            review_status: ReviewStatus.APPROVED,
            visibility: Visibility.PUBLIC,
            view_count: 10,
            reply_count: 3,
            favor_count: 5,
            post_time: new Date('2026-04-20T10:00:00.000Z'),
            update_time: new Date('2026-04-20T10:00:00.000Z'),
          },
        ],
        total: 1,
      }),
    };
    const service = new TopicsApplicationService(
      topicsRepository as never,
      auditService as never,
      mediaApplicationService as never,
      mongoTransactionService as never,
      contentOperationLockService as never,
      usersService as never,
      favoritesService as never,
      workspaceRelationCleanupService as never,
    );

    const result = (await service.listTopics({}, undefined)) as {
      items: Array<Record<string, unknown>>;
    };

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('downloadUrl');
    expect(result.items[0]).toHaveProperty('featureFlags', [1, 3, 5]);
    expect(result.items[0]).toHaveProperty('featureFlagLabels', ['汉化', 'PC', '新作']);
  });

  it('returns downloadUrl in public topic detail only for logged-in viewers', async () => {
    const topicDocument = {
      id: '507f1f77bcf86cd799439092',
      topic_id: 1,
      type_id: 2,
      title: 'Topic detail',
      images: [],
      content: 'Topic content',
      desc: 'Topic summary',
      download_url: 'https://downloads.example.com/topic-detail.zip',
      user_id: new Types.ObjectId('507f1f77bcf86cd799439022'),
      feature_flags: [2, 4, 7],
      review_status: ReviewStatus.APPROVED,
      visibility: Visibility.PUBLIC,
      view_count: 8,
      reply_count: 2,
      favor_count: 4,
      post_time: new Date('2026-04-20T10:00:00.000Z'),
      update_time: new Date('2026-04-20T10:00:00.000Z'),
    };
    const topicsRepository = {
      findOneAndIncrementViewCount: jest.fn().mockResolvedValue(topicDocument),
    };
    const service = new TopicsApplicationService(
      topicsRepository as never,
      auditService as never,
      mediaApplicationService as never,
      mongoTransactionService as never,
      contentOperationLockService as never,
      usersService as never,
      favoritesService as never,
      workspaceRelationCleanupService as never,
    );

    favoritesService.isFavorited.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const anonymousResult = (await service.getTopicDetail('507f1f77bcf86cd799439092')) as Record<
      string,
      unknown
    >;
    const loggedInResult = (await service.getTopicDetail(
      '507f1f77bcf86cd799439092',
      'viewer-id',
    )) as Record<string, unknown>;

    expect(anonymousResult).not.toHaveProperty('downloadUrl');
    expect(anonymousResult).toHaveProperty('featureFlags', [2, 4, 7]);
    expect(anonymousResult).toHaveProperty('featureFlagLabels', ['官中', '安卓', '同人']);
    expect(loggedInResult).toHaveProperty(
      'downloadUrl',
      'https://downloads.example.com/topic-detail.zip',
    );
    expect(loggedInResult).toHaveProperty('favored', true);
  });

  it('filters public topic list by feature flags using all-match semantics', async () => {
    const topicsRepository = {
      list: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
      }),
    };
    const service = new TopicsApplicationService(
      topicsRepository as never,
      auditService as never,
      mediaApplicationService as never,
      mongoTransactionService as never,
      contentOperationLockService as never,
      usersService as never,
      favoritesService as never,
      workspaceRelationCleanupService as never,
    );

    await service.listTopics({ featureFlags: [1, 3, 5] });

    expect(topicsRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_flags: { $all: [1, 3, 5] },
      }),
      1,
      10,
      { post_time: -1 },
    );
  });
});
