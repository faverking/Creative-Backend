import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ROLE_USER } from '../common/constants/roles';
import { UserStatus } from '../common/enums/user-status.enum';
import { AuthService } from './auth.service';

const userId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';

function createConfigService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'jwt.accessSecret': 'access-secret-for-tests',
    'jwt.accessExpiresIn': '15m',
    'jwt.refreshSecret': 'refresh-secret-for-tests',
    'jwt.refreshExpiresIn': '7d',
    ...overrides,
  };

  return {
    get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  };
}

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    email: 'mono@example.com',
    name: 'Mono',
    passwordHash: '',
    passwordVersion: 1,
    status: UserStatus.ACTIVE,
    roles: [ROLE_USER],
    avatarUrl: '',
    bio: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createJwtService() {
  return {
    signAsync: jest.fn(async (payload: { sid?: string }) => (payload.sid ? 'refresh-new' : 'access-new')),
    verify: jest.fn(),
  };
}

function createService(params: {
  authRepository?: Record<string, unknown>;
  usersService?: Record<string, unknown>;
  jwtService?: Record<string, unknown>;
  configService?: Record<string, unknown>;
  auditService?: Record<string, unknown>;
}) {
  return new AuthService(
    (params.authRepository ?? {}) as never,
    (params.usersService ?? {}) as never,
    (params.jwtService ?? {}) as never,
    (params.configService ?? createConfigService()) as never,
    (params.auditService ?? { recordCritical: jest.fn() }) as never,
    {} as never,
  );
}

describe('AuthService', () => {
  it('uses configured JWT expirations when issuing a login token pair', async () => {
    const passwordHash = await argon2.hash('password', { type: argon2.argon2id });
    const user = createUser({ passwordHash });
    const jwtService = createJwtService();
    const authRepository = {
      createSession: jest.fn().mockResolvedValue({ id: sessionId }),
      updateSession: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      findByAccount: jest.fn().mockResolvedValue(user),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
      toSafeProfile: jest.fn().mockReturnValue({ id: userId, name: 'Mono' }),
    };
    const service = createService({
      authRepository,
      usersService,
      jwtService,
      configService: createConfigService(),
    });

    await expect(
      service.login(
        { account: 'mono@example.com', password: 'password' },
        '127.0.0.1',
        'jest',
        'device-1',
      ),
    ).resolves.toEqual({
      user: { id: userId, name: 'Mono' },
      tokens: {
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
        expiresIn: '15m',
      },
    });

    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      {
        sub: userId,
        roles: [],
        pv: 1,
      },
      {
        secret: 'access-secret-for-tests',
        expiresIn: '15m',
      },
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sub: userId,
        pv: 1,
        sid: sessionId,
      }),
      {
        secret: 'refresh-secret-for-tests',
        expiresIn: '7d',
      },
    );
    expect(authRepository.updateSession).toHaveBeenCalledWith(
      sessionId,
      expect.objectContaining({
        refresh_token_hash: expect.any(String),
        expire_at: expect.any(Date),
      }),
    );
  });

  it('rotates refresh tokens and persists the new hash atomically', async () => {
    const oldRefreshToken = 'refresh-old';
    const oldHash = await argon2.hash(oldRefreshToken, { type: argon2.argon2id });
    const user = createUser();
    const jwtService = createJwtService();
    jwtService.verify.mockReturnValue({
      sub: userId,
      sid: sessionId,
      pv: 1,
      jti: 'jti-1',
    });
    const authRepository = {
      findSessionById: jest.fn().mockResolvedValue({
        id: sessionId,
        refresh_token_hash: oldHash,
        expire_at: new Date(Date.now() + 60_000),
      }),
      updateActiveSessionIfRefreshTokenHashMatches: jest.fn().mockResolvedValue(true),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue(user),
    };
    const auditService = {
      recordCritical: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService({
      authRepository,
      usersService,
      jwtService,
      auditService,
    });

    await expect(
      service.refresh({ refreshToken: oldRefreshToken }, '127.0.0.1', 'jest'),
    ).resolves.toEqual({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresIn: '15m',
    });

    const [, expectedHash, payload] = authRepository.updateActiveSessionIfRefreshTokenHashMatches.mock.calls[0];
    expect(expectedHash).toBe(oldHash);
    expect(await argon2.verify(payload.refresh_token_hash, 'refresh-new')).toBe(true);
    expect(payload).toEqual(
      expect.objectContaining({
        expire_at: expect.any(Date),
        ip: '127.0.0.1',
        ua: 'jest',
      }),
    );
    expect(auditService.recordCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.refresh',
        resourceType: 'user_session',
        resourceId: sessionId,
      }),
    );
  });

  it('rejects reused refresh tokens when the stored hash no longer matches', async () => {
    const jwtService = createJwtService();
    jwtService.verify.mockReturnValue({
      sub: userId,
      sid: sessionId,
      pv: 1,
      jti: 'jti-1',
    });
    const authRepository = {
      findSessionById: jest.fn().mockResolvedValue({
        id: sessionId,
        refresh_token_hash: await argon2.hash('different-refresh-token', { type: argon2.argon2id }),
        expire_at: new Date(Date.now() + 60_000),
      }),
      updateActiveSessionIfRefreshTokenHashMatches: jest.fn(),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue(createUser()),
    };
    const service = createService({
      authRepository,
      usersService,
      jwtService,
    });

    await expect(
      service.refresh({ refreshToken: 'refresh-old' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepository.updateActiveSessionIfRefreshTokenHashMatches).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens after password version changes', async () => {
    const oldHash = await argon2.hash('refresh-old', { type: argon2.argon2id });
    const jwtService = createJwtService();
    jwtService.verify.mockReturnValue({
      sub: userId,
      sid: sessionId,
      pv: 1,
      jti: 'jti-1',
    });
    const authRepository = {
      findSessionById: jest.fn().mockResolvedValue({
        id: sessionId,
        refresh_token_hash: oldHash,
        expire_at: new Date(Date.now() + 60_000),
      }),
      updateActiveSessionIfRefreshTokenHashMatches: jest.fn(),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue(createUser({ passwordVersion: 2 })),
    };
    const service = createService({
      authRepository,
      usersService,
      jwtService,
    });

    await expect(
      service.refresh({ refreshToken: 'refresh-old' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepository.updateActiveSessionIfRefreshTokenHashMatches).not.toHaveBeenCalled();
  });

  it('rejects refresh when the session was rotated concurrently', async () => {
    const oldRefreshToken = 'refresh-old';
    const oldHash = await argon2.hash(oldRefreshToken, { type: argon2.argon2id });
    const jwtService = createJwtService();
    jwtService.verify.mockReturnValue({
      sub: userId,
      sid: sessionId,
      pv: 1,
      jti: 'jti-1',
    });
    const authRepository = {
      findSessionById: jest.fn().mockResolvedValue({
        id: sessionId,
        refresh_token_hash: oldHash,
        expire_at: new Date(Date.now() + 60_000),
      }),
      updateActiveSessionIfRefreshTokenHashMatches: jest.fn().mockResolvedValue(false),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue(createUser()),
    };
    const auditService = {
      recordCritical: jest.fn(),
    };
    const service = createService({
      authRepository,
      usersService,
      jwtService,
      auditService,
    });

    await expect(
      service.refresh({ refreshToken: oldRefreshToken }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepository.updateActiveSessionIfRefreshTokenHashMatches).toHaveBeenCalledWith(
      sessionId,
      oldHash,
      expect.any(Object),
    );
    expect(auditService.recordCritical).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', { expire_at: new Date(Date.now() - 1_000) }],
    ['revoked', { expire_at: new Date(Date.now() + 60_000), revoked_at: new Date() }],
  ])('rejects %s refresh sessions before rotating', async (_caseName, sessionState) => {
    const jwtService = createJwtService();
    jwtService.verify.mockReturnValue({
      sub: userId,
      sid: sessionId,
      pv: 1,
      jti: 'jti-1',
    });
    const authRepository = {
      findSessionById: jest.fn().mockResolvedValue({
        id: sessionId,
        refresh_token_hash: await argon2.hash('refresh-old', { type: argon2.argon2id }),
        ...sessionState,
      }),
      updateActiveSessionIfRefreshTokenHashMatches: jest.fn(),
    };
    const service = createService({
      authRepository,
      usersService: { findById: jest.fn() },
      jwtService,
    });

    await expect(
      service.refresh({ refreshToken: 'refresh-old' }, '127.0.0.1', 'jest'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepository.updateActiveSessionIfRefreshTokenHashMatches).not.toHaveBeenCalled();
  });
});
