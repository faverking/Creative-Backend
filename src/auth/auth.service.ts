import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { ROLE_USER } from '../common/constants/roles';
import { UserStatus } from '../common/enums/user-status.enum';
import { durationToMilliseconds } from '../common/utils/duration.util';
import { AuditService } from '../infra/audit/audit.service';
import { UsersService } from '../users/users.service';
import type { OAuthAccount, OAuthProvider, UserDocument } from '../users/schemas/user.schema';
import { AuthorizeDto } from './dto/authorize.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { OAuthService, type OAuthUserProfile } from './oauth/oauth.service';
import { AuthRepository } from './repositories/auth.repository';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface RefreshPayload {
  sub: string;
  sid: string;
  pv: number;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly oauthService: OAuthService,
  ) {}

  async register(
    dto: RegisterDto,
    ip: string,
    ua: string,
    deviceId: string,
    traceId?: string,
  ): Promise<{ user: unknown; tokens: TokenPair }> {
    const exists = await this.usersService.existsByEmailOrName(dto.email, dto.name);
    if (exists) {
      throw new BadRequestException('Email or username already registered');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      name: dto.name,
      passwordHash,
      passwordVersion: 1,
      status: UserStatus.ACTIVE,
      roles: [ROLE_USER],
      oauthAccounts: [],    });

    const tokens = await this.createSessionAndIssueTokens(user.id, user.passwordVersion, ip, ua, deviceId);
    await this.auditService.recordCritical({
      operatorId: user.id,
      operatorRole: ROLE_USER,
      action: 'auth.register',
      resourceType: 'user',
      resourceId: user.id,
      ip,
      ua,
      traceId,
    });

    return {
      user: this.usersService.toSafeProfile(user),
      tokens,
    };
  }

  async login(
    dto: LoginDto,
    ip: string,
    ua: string,
    deviceId: string,
    traceId?: string,
  ): Promise<{ user: unknown; tokens: TokenPair }> {
    const user = await this.usersService.findByAccount(dto.account);
    if (!user) {
      throw new UnauthorizedException('Invalid account or password');
    }

    this.ensureUserAvailable(user);

    const passwordMatched = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid account or password');
    }

    await this.usersService.updateLastLogin(user.id, ip);
    const tokens = await this.createSessionAndIssueTokens(user.id, user.passwordVersion, ip, ua, deviceId);

    await this.auditService.recordCritical({
      operatorId: user.id,
      operatorRole: user.roles[0],
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      ip,
      ua,
      traceId,
    });

    return {
      user: this.usersService.toSafeProfile(user),
      tokens,
    };
  }

  async refresh(
    dto: RefreshTokenDto,
    ip: string,
    ua: string,
    traceId?: string,
  ): Promise<TokenPair> {
    const payload = this.verifyRefreshToken(dto.refreshToken);

    const session = await this.authRepository.findSessionById(payload.sid);
    if (!session || session.revoked_at || session.expire_at.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token session invalid');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User unavailable');
    }

    this.ensureUserAvailable(user);

    if (user.passwordVersion !== payload.pv) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const hashMatched = await argon2.verify(session.refresh_token_hash, dto.refreshToken);
    if (!hashMatched) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    const tokens = await this.issueTokenPair(user.id, user.passwordVersion, session.id);
    const refreshHash = await argon2.hash(tokens.refreshToken, { type: argon2.argon2id });
    const refreshExpireMs = durationToMilliseconds(
      this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
    );

    const rotated = await this.authRepository.updateActiveSessionIfRefreshTokenHashMatches(
      session.id,
      session.refresh_token_hash,
      {
        refresh_token_hash: refreshHash,
        expire_at: new Date(Date.now() + refreshExpireMs),
        ip,
        ua,
      },
    );
    if (!rotated) {
      throw new UnauthorizedException('Refresh token session invalid');
    }

    await this.auditService.recordCritical({
      operatorId: user.id,
      operatorRole: user.roles[0],
      action: 'auth.refresh',
      resourceType: 'user_session',
      resourceId: session.id,
      ip,
      ua,
      traceId,
    });

    return tokens;
  }

  async logout(dto: RefreshTokenDto, ip: string, ua: string, traceId?: string): Promise<{ success: true }> {
    const payload = this.verifyRefreshToken(dto.refreshToken);

    await this.authRepository.updateSession(payload.sid, {
      revoked_at: new Date(),
    });

    await this.auditService.recordCritical({
      operatorId: payload.sub,
      action: 'auth.logout',
      resourceType: 'user_session',
      resourceId: payload.sid,
      ip,
      ua,
      traceId,
    });

    return { success: true };
  }

  async listUserSessions(userId: string): Promise<
    {
      sessionId: string;
      deviceId: string;
      ip?: string;
      ua?: string;
      createdAt: Date;
      expireAt: Date;
      revokedAt?: Date;
    }[]
  > {
    const sessions = await this.authRepository.listUserSessions(userId);

    return sessions.map((session) => ({
      sessionId: session.id,
      deviceId: session.device_id,
      ip: session.ip,
      ua: session.ua,
      createdAt: session.created_at,
      expireAt: session.expire_at,
      revokedAt: session.revoked_at,
    }));
  }

  async getCurrentUserAuth(userId: string): Promise<unknown> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.ensureUserAvailable(user);

    return {
      user: this.usersService.toSafeProfile(user),
      roles: user.roles,
      status: user.status,
    };
  }

  async authorize(userId: string, dto: AuthorizeDto): Promise<unknown> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.ensureUserAvailable(user);

    const anyRoles = dto.anyRoles ?? [];
    const allRoles = dto.allRoles ?? [];

    const hasAny = anyRoles.length === 0 || anyRoles.some((role) => user.roles.includes(role));
    const hasAll = allRoles.length === 0 || allRoles.every((role) => user.roles.includes(role));

    return {
      authorized: hasAny && hasAll,
      roles: user.roles,
      check: {
        anyRoles,
        allRoles,
      },
    };
  }

  async getOAuthAuthorizeUrl(provider: string, deviceId: string): Promise<{ provider: string; authorizeUrl: string }> {
    return {
      provider,
      authorizeUrl: await this.oauthService.getAuthorizeUrl(provider, deviceId),
    };
  }

  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string,
    ip: string,
    ua: string,
    traceId?: string,
  ): Promise<unknown> {
    if (!code) {
      throw new BadRequestException('Missing OAuth code');
    }

    if (!state) {
      throw new BadRequestException('Missing OAuth state');
    }

    const { deviceId } = this.oauthService.verifyState(provider, state);
    const profile = await this.oauthService.exchangeCodeForUser(provider, code);
    const { user, isNewUser } = await this.resolveOAuthUser(profile);

    this.ensureUserAvailable(user);

    await this.usersService.updateLastLogin(user.id, ip);
    const tokens = await this.createSessionAndIssueTokens(user.id, user.passwordVersion, ip, ua, deviceId);

    await this.auditService.recordCritical({
      operatorId: user.id,
      operatorRole: user.roles[0],
      action: isNewUser ? 'auth.oauth.register' : 'auth.oauth.login',
      resourceType: 'user',
      resourceId: user.id,
      ip,
      ua,
      traceId,
      after: {
        provider: profile.provider,
      },
    });

    return {
      provider: profile.provider,
      isNewUser,
      user: this.usersService.toSafeProfile(user),
      tokens,
    };
  }

  private async resolveOAuthUser(
    profile: OAuthUserProfile,
  ): Promise<{ user: UserDocument; isNewUser: boolean }> {
    const existingByProvider = await this.usersService.findByOAuthAccount(profile.provider, profile.providerUserId);
    if (existingByProvider) {
      return {
        user: existingByProvider,
        isNewUser: false,
      };
    }

    const oauthAccount = this.buildOAuthAccount(profile.provider, profile.providerUserId, profile.email);
    const existingByEmail = await this.usersService.findByEmail(profile.email);
    if (existingByEmail) {
      const linked = await this.usersService.linkOAuthAccount(existingByEmail.id, oauthAccount);
      return {
        user: linked,
        isNewUser: false,
      };
    }

    const availableName = await this.usersService.reserveAvailableName(profile.name || profile.email.split('@')[0]);
    const randomPassword = randomUUID();
    const passwordHash = await argon2.hash(randomPassword, { type: argon2.argon2id });
    const created = await this.usersService.create({
      email: profile.email,
      name: availableName,
      passwordHash,
      passwordVersion: 1,
      status: UserStatus.ACTIVE,
      roles: [ROLE_USER],
      oauthAccounts: [oauthAccount],
      avatarUrl: profile.avatarUrl,    });

    return {
      user: created,
      isNewUser: true,
    };
  }

  private buildOAuthAccount(
    provider: OAuthProvider,
    providerUserId: string,
    email: string,
  ): OAuthAccount {
    return {
      provider,
      providerUserId,
      email,
      linkedAt: new Date(),
    };
  }

  private ensureUserAvailable(user: UserDocument): void {
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is blocked or deleted');
    }
  }

  private async createSessionAndIssueTokens(
    userId: string,
    passwordVersion: number,
    ip: string,
    ua: string,
    deviceId: string,
  ): Promise<TokenPair> {
    const session = await this.authRepository.createSession({
      user_id: new Types.ObjectId(userId),
      device_id: deviceId,
      refresh_token_hash: 'pending',
      ip,
      ua,
      expire_at: new Date(),
    });

    const tokens = await this.issueTokenPair(userId, passwordVersion, session.id);
    const refreshHash = await argon2.hash(tokens.refreshToken, { type: argon2.argon2id });
    const refreshExpireMs = durationToMilliseconds(
      this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
    );

    await this.authRepository.updateSession(session.id, {
      refresh_token_hash: refreshHash,
      expire_at: new Date(Date.now() + refreshExpireMs),
    });

    return tokens;
  }

  private async issueTokenPair(
    userId: string,
    passwordVersion: number,
    sessionId: string,
  ): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        roles: [],
        pv: passwordVersion,
      },
      {
        secret: this.configService.get<string>('jwt.accessSecret', ''),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m') as JwtSignOptions['expiresIn'],
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        pv: passwordVersion,
        sid: sessionId,
        jti: randomUUID(),
      },
      {
        secret: this.configService.get<string>('jwt.refreshSecret', ''),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d') as JwtSignOptions['expiresIn'],
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m'),
    };
  }

  private verifyRefreshToken(token: string): RefreshPayload {
    try {
      return this.jwtService.verify<RefreshPayload>(token, {
        secret: this.configService.get<string>('jwt.refreshSecret', ''),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}

