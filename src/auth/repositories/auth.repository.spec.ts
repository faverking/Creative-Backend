import { AuthRepository } from './auth.repository';

describe('AuthRepository', () => {
  it('updates refresh sessions only when the active stored hash still matches', async () => {
    const exec = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const userSessionModel = {
      updateOne: jest.fn().mockReturnValue({ exec }),
    };
    const repository = new AuthRepository(userSessionModel as never);

    await expect(
      repository.updateActiveSessionIfRefreshTokenHashMatches('session-1', 'hash-old', {
        refresh_token_hash: 'hash-new',
      }),
    ).resolves.toBe(true);

    expect(userSessionModel.updateOne).toHaveBeenCalledWith(
      {
        _id: 'session-1',
        refresh_token_hash: 'hash-old',
        revoked_at: { $exists: false },
        expire_at: { $gt: expect.any(Date) },
      },
      {
        refresh_token_hash: 'hash-new',
      },
    );
  });

  it('reports a failed rotation when the active session no longer matches', async () => {
    const userSessionModel = {
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 0 }),
      }),
    };
    const repository = new AuthRepository(userSessionModel as never);

    await expect(
      repository.updateActiveSessionIfRefreshTokenHashMatches('session-1', 'hash-old', {
        refresh_token_hash: 'hash-new',
      }),
    ).resolves.toBe(false);
  });
});
