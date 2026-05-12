import { TargetType } from '../common/enums/target-type.enum';
import type { AdminContentCommandService } from './admin-content-command.service';
import type { AdminContentQueryService } from './admin-content-query.service';
import { AdminContentService } from './admin-content.service';

describe('AdminContentService', () => {
  it('delegates query operations to AdminContentQueryService', async () => {
    const queryService = {
      summary: jest.fn().mockResolvedValue({ kind: 'summary' }),
      list: jest.fn().mockResolvedValue({ kind: 'list' }),
      detail: jest.fn().mockResolvedValue({ kind: 'detail' }),
    };
    const commandService = {
      setPrivate: jest.fn(),
      deletePermanently: jest.fn(),
    };
    const service = new AdminContentService(
      queryService as unknown as AdminContentQueryService,
      commandService as unknown as AdminContentCommandService,
    );

    await expect(service.summary({ userId: 'u1', roles: ['admin'] } as never, {} as never)).resolves.toEqual({
      kind: 'summary',
    });
    await expect(service.list({ userId: 'u1', roles: ['admin'] } as never, {} as never)).resolves.toEqual({
      kind: 'list',
    });
    await expect(
      service.detail(TargetType.ARTICLE, '507f1f77bcf86cd799439011', { userId: 'u1', roles: ['admin'] } as never, {} as never),
    ).resolves.toEqual({
      kind: 'detail',
    });

    expect(queryService.summary).toHaveBeenCalledTimes(1);
    expect(queryService.list).toHaveBeenCalledTimes(1);
    expect(queryService.detail).toHaveBeenCalledTimes(1);
  });

  it('delegates command operations to AdminContentCommandService', async () => {
    const queryService = {
      summary: jest.fn(),
      list: jest.fn(),
      detail: jest.fn(),
    };
    const commandService = {
      setPrivate: jest.fn().mockResolvedValue({ success: true, changed: true }),
      deletePermanently: jest.fn().mockResolvedValue({ success: true }),
    };
    const service = new AdminContentService(
      queryService as unknown as AdminContentQueryService,
      commandService as unknown as AdminContentCommandService,
    );

    await expect(
      service.setPrivate(TargetType.TOPIC, '507f1f77bcf86cd799439012', { userId: 'u1', roles: ['admin'] } as never),
    ).resolves.toEqual({
      success: true,
      changed: true,
    });
    await expect(
      service.deletePermanently(
        TargetType.IMAGE,
        '507f1f77bcf86cd799439013',
        { userId: 'u1', roles: ['super_admin'] } as never,
        {} as never,
      ),
    ).resolves.toEqual({
      success: true,
    });

    expect(commandService.setPrivate).toHaveBeenCalledTimes(1);
    expect(commandService.deletePermanently).toHaveBeenCalledTimes(1);
  });
});
