import { NotFoundException } from '@nestjs/common';
import { TargetType } from '../common/enums/target-type.enum';
import { InteractionsService } from './interactions.service';

describe('InteractionsService', () => {
  function createUpdateQuery(result: { matchedCount: number }) {
    return {
      session: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(result),
      }),
      exec: jest.fn().mockResolvedValue(result),
    };
  }

  it('throws when strict favor count sync cannot find the target', async () => {
    const articleModel = {
      exists: jest.fn(),
      updateOne: jest.fn().mockReturnValue(createUpdateQuery({ matchedCount: 0 })),
    };
    const service = new InteractionsService(
      articleModel as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.setFavorCountStrict(TargetType.ARTICLE, '507f1f77bcf86cd799439011', 1),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows cleanup favor count sync to no-op when the target is gone', async () => {
    const articleModel = {
      exists: jest.fn(),
      updateOne: jest.fn().mockReturnValue(createUpdateQuery({ matchedCount: 0 })),
    };
    const service = new InteractionsService(
      articleModel as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.setFavorCountIfPresent(TargetType.ARTICLE, '507f1f77bcf86cd799439011', 0),
    ).resolves.toBeUndefined();
  });
});
