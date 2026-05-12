import { Types } from 'mongoose';
import { Visibility } from '../common/enums/visibility.enum';
import { TargetType } from '../common/enums/target-type.enum';
import { AdminContentCommandService } from './admin-content-command.service';

describe('AdminContentCommandService', () => {
  it('cleans workspace relations and resets favor count when setting content private', async () => {
    const articleId = '507f1f77bcf86cd799439011';
    const article = {
      id: articleId,
      _id: new Types.ObjectId(articleId),
      title: 'Article',
      user_id: new Types.ObjectId('507f1f77bcf86cd799439012'),
      visibility: Visibility.PUBLIC,
      deleted_at: undefined,
    };
    const articleModel = {
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(article) }),
      updateOne: jest.fn().mockReturnValue({ session: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }) }),
    };
    const workspaceRelationCleanupService = {
      cleanupHiddenTarget: jest.fn().mockResolvedValue({
        canceledFeaturedCount: 2,
        deletedFavorites: 3,
        deletedHistoryEntries: 4,
        deletedNotifications: 5,
      }),
    };
    const adminContentQueryService = {
      detailItemByType: jest.fn().mockResolvedValue({ id: articleId, visibility: Visibility.PRIVATE }),
    };
    const service = new AdminContentCommandService(
      articleModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { recordCritical: jest.fn() } as never,
      {
        runInTransaction: jest.fn().mockImplementation(async (handler: (session: unknown) => Promise<unknown>) => handler({})),
      } as never,
      {
        runWithContentLock: jest.fn().mockImplementation(async (_type: TargetType, _id: string, handler: () => Promise<unknown>) => handler()),
      } as never,
      workspaceRelationCleanupService as never,
      adminContentQueryService as never,
    );

    await expect(
      service.setPrivate(
        TargetType.ARTICLE,
        articleId,
        { userId: '507f1f77bcf86cd799439099', roles: ['admin'] } as never,
      ),
    ).resolves.toEqual({
      success: true,
      changed: true,
      canceledFeaturedCount: 2,
      deletedFavorites: 3,
      deletedHistoryEntries: 4,
      deletedNotifications: 5,
      item: { id: articleId, visibility: Visibility.PRIVATE },
      });

    expect(workspaceRelationCleanupService.cleanupHiddenTarget).toHaveBeenCalledWith(
      TargetType.ARTICLE,
      articleId,
      '507f1f77bcf86cd799439099',
      {},
    );
  });
});
