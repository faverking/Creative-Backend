import { TargetType } from '../common/enums/target-type.enum';
import { HistoryService } from './history.service';

describe('HistoryService', () => {
  it('records visits and prunes overflow entries for the user', async () => {
    const historyRepository = {
      upsertVisit: jest.fn().mockResolvedValue(undefined),
      pruneOverflowByUser: jest.fn().mockResolvedValue(0),
    };
    const workspaceContentService = {
      getContentSummaryMap: jest.fn(),
    };
    const service = new HistoryService(historyRepository as never, workspaceContentService as never);

    await service.recordVisit(
      '507f1f77bcf86cd799439012',
      TargetType.TOPIC,
      '507f1f77bcf86cd799439011',
      'topic-detail',
    );

    expect(historyRepository.upsertVisit).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      TargetType.TOPIC,
      '507f1f77bcf86cd799439011',
      'topic-detail',
    );
    expect(historyRepository.pruneOverflowByUser).toHaveBeenCalledWith('507f1f77bcf86cd799439012', 1000);
  });

  it('maps history relations into display-ready records', async () => {
    const historyRepository = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'history-1',
            target_type: TargetType.TOPIC,
            target_id: '507f1f77bcf86cd799439011',
            visited_at: new Date('2026-04-17T10:00:00.000Z'),
            source_label: 'topic-detail',
          },
        ],
        total: 1,
      }),
    };
    const workspaceContentService = {
      getContentSummaryMap: jest.fn().mockResolvedValue(
        new Map([
          [
            `${TargetType.TOPIC}:507f1f77bcf86cd799439011`,
            {
              title: 'Topic title',
              summary: 'Topic summary',
              coverMedia: undefined,
              meta: {
                featureFlags: [1, 3],
                featureFlagLabels: ['汉化', 'PC'],
              },
              author: {
                id: 'user-1',
                name: 'Mono',
                avatarUrl: '/avatars/mono.png',
              },
              tags: ['Column'],
            },
          ],
        ]),
      ),
    };
    const service = new HistoryService(historyRepository as never, workspaceContentService as never);

    await expect(service.listMyHistory('507f1f77bcf86cd799439012', {})).resolves.toEqual({
      items: [
        {
          id: 'history-1',
          targetType: TargetType.TOPIC,
          targetId: '507f1f77bcf86cd799439011',
          visitedAt: new Date('2026-04-17T10:00:00.000Z'),
          sourceLabel: 'topic-detail',
          title: 'Topic title',
          summary: 'Topic summary',
          coverMedia: undefined,
          meta: {
            featureFlags: [1, 3],
            featureFlagLabels: ['汉化', 'PC'],
          },
          author: {
            id: 'user-1',
            name: 'Mono',
            avatarUrl: '/avatars/mono.png',
          },
          tags: ['Column'],
        },
      ],
      page: 1,
      limit: 10,
      total: 1,
    });
  });

  it('self-heals invisible history records before returning the page', async () => {
    const historyRepository = {
      list: jest
        .fn()
        .mockResolvedValueOnce({
          items: [
            {
              id: 'history-hidden',
              target_type: TargetType.TOPIC,
              target_id: '507f1f77bcf86cd799439021',
              visited_at: new Date('2026-04-17T10:00:00.000Z'),
              source_label: 'topic-detail',
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
    const service = new HistoryService(historyRepository as never, workspaceContentService as never);

    await expect(service.listMyHistory('507f1f77bcf86cd799439012', {})).resolves.toEqual({
      items: [],
      page: 1,
      limit: 10,
      total: 0,
    });

    expect(historyRepository.deleteManyByIds).toHaveBeenCalledWith(['history-hidden']);
  });
});
