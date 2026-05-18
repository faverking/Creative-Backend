import { TargetType } from '../common/enums/target-type.enum';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  it('resolves whether the current viewer has favorited a target', async () => {
    const favoritesRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'fav-1' }),
    };
    const service = new FavoritesService(
      favoritesRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.isFavorited(
        '507f1f77bcf86cd799439012',
        TargetType.ARTICLE,
        '507f1f77bcf86cd799439011',
      ),
    ).resolves.toBe(true);

    expect(favoritesRepository.findOne).toHaveBeenCalledWith({
      user_id: expect.anything(),
      target_type: TargetType.ARTICLE,
      target_id: '507f1f77bcf86cd799439011',
    });
  });

  it('treats anonymous viewers as not favorited without querying relations', async () => {
    const favoritesRepository = {
      findOne: jest.fn(),
    };
    const service = new FavoritesService(
      favoritesRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.isFavorited(undefined, TargetType.ARTICLE, '507f1f77bcf86cd799439011'),
    ).resolves.toBe(false);
    expect(favoritesRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns display-ready favorite items from workspace content summaries', async () => {
    const favoritesRepository = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'fav-1',
            target_type: TargetType.ARTICLE,
            target_id: '507f1f77bcf86cd799439011',
            create_time: new Date('2026-04-17T08:00:00.000Z'),
          },
        ],
        total: 1,
      }),
    };
    const workspaceContentService = {
      getContentSummaryMap: jest.fn().mockResolvedValue(
        new Map([
          [
            `${TargetType.ARTICLE}:507f1f77bcf86cd799439011`,
            {
              title: 'Article title',
              summary: 'Article summary',
              coverMedia: {
                id: 'media-1',
                previewPath: '/preview/1',
                downloadPath: '/download/1',
                attachmentPath: '/attachment/1',
              },
              meta: {
                viewCount: 12,
              },
              author: {
                id: 'user-1',
                name: 'Mono',
                avatarUrl: '/avatars/mono.png',
              },
              tags: ['Tech'],
            },
          ],
        ]),
      ),
    };
    const service = new FavoritesService(
      favoritesRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      workspaceContentService as never,
    );

    await expect(service.listMyFavorites('507f1f77bcf86cd799439012', {})).resolves.toEqual({
      items: [
        {
          id: 'fav-1',
          targetType: TargetType.ARTICLE,
          targetId: '507f1f77bcf86cd799439011',
          savedAt: new Date('2026-04-17T08:00:00.000Z'),
          title: 'Article title',
          summary: 'Article summary',
          coverMedia: {
            id: 'media-1',
            previewPath: '/preview/1',
            downloadPath: '/download/1',
            attachmentPath: '/attachment/1',
          },
          meta: {
            viewCount: 12,
          },
          author: {
            id: 'user-1',
            name: 'Mono',
            avatarUrl: '/avatars/mono.png',
          },
          tags: ['Tech'],
        },
      ],
      page: 1,
      limit: 10,
      total: 1,
    });
  });

  it('self-heals invisible favorite relations before returning the page', async () => {
    const favoritesRepository = {
      list: jest
        .fn()
        .mockResolvedValueOnce({
          items: [
            {
              id: 'fav-hidden',
              target_type: TargetType.ARTICLE,
              target_id: '507f1f77bcf86cd799439021',
              create_time: new Date('2026-04-17T08:00:00.000Z'),
            },
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          items: [],
          total: 0,
        }),
      deleteManyByIds: jest.fn().mockResolvedValue(1),
    };
    const workspaceContentService = {
      getContentSummaryMap: jest
        .fn()
        .mockResolvedValueOnce(new Map())
        .mockResolvedValueOnce(new Map()),
    };
    const service = new FavoritesService(
      favoritesRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      workspaceContentService as never,
    );

    await expect(service.listMyFavorites('507f1f77bcf86cd799439012', {})).resolves.toEqual({
      items: [],
      page: 1,
      limit: 10,
      total: 0,
    });

    expect(favoritesRepository.deleteManyByIds).toHaveBeenCalledWith(['fav-hidden']);
  });
});
