import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { OAuthProvider } from '../../users/schemas/user.schema';

interface OAuthStatePayload {
  provider: OAuthProvider;
  deviceId: string;
  type: 'oauth_state';
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface OAuthUserProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async getAuthorizeUrl(provider: string, deviceId: string): Promise<string> {
    this.assertGoogleProvider(provider);
    const google = this.getGoogleConfig();
    const state = await this.jwtService.signAsync(
      {
        provider,
        deviceId,
        type: 'oauth_state',
      },
      {
        secret: this.getStateSecret(),
        expiresIn: '10m' as JwtSignOptions['expiresIn'],
      },
    );

    const params = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  verifyState(provider: string, state: string): { deviceId: string } {
    this.assertGoogleProvider(provider);

    try {
      const payload = this.jwtService.verify<OAuthStatePayload>(state, {
        secret: this.getStateSecret(),
      });

      if (payload.type !== 'oauth_state' || payload.provider !== provider) {
        throw new BadRequestException('OAuth state mismatch');
      }

      return {
        deviceId: payload.deviceId,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Invalid OAuth state');
    }
  }

  async exchangeCodeForUser(provider: string, code: string): Promise<OAuthUserProfile> {
    this.assertGoogleProvider(provider);
    const google = this.getGoogleConfig();

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: google.redirectUri,
        grant_type: 'authorization_code',
      }),
    }).catch(() => {
      throw new BadRequestException('OAuth token exchange failed');
    });

    const tokenData = await this.safeJson<GoogleTokenResponse>(tokenResponse);
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new BadRequestException(tokenData.error_description ?? tokenData.error ?? 'OAuth token exchange failed');
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    }).catch(() => {
      throw new BadRequestException('OAuth user info request failed');
    });

    const profile = await this.safeJson<GoogleUserInfoResponse>(profileResponse);
    if (!profileResponse.ok || !profile.sub || !profile.email) {
      throw new BadRequestException('OAuth user info invalid');
    }

    if (!profile.email_verified) {
      throw new UnauthorizedException('Google account email not verified');
    }

    return {
      provider: 'google',
      providerUserId: profile.sub,
      email: profile.email.toLowerCase(),
      emailVerified: true,
      name: profile.name?.trim() || profile.email.split('@')[0],
      avatarUrl: profile.picture,
    };
  }

  private getGoogleConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
    const enabled = this.configService.get<boolean>('oauth.enabled', true);
    if (!enabled) {
      throw new BadRequestException('OAuth disabled by config');
    }

    const clientId = this.configService.get<string>('oauth.google.clientId', '');
    const clientSecret = this.configService.get<string>('oauth.google.clientSecret', '');
    const redirectUri = this.configService.get<string>('oauth.google.redirectUri', '');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google OAuth configuration missing');
    }

    return {
      clientId,
      clientSecret,
      redirectUri,
    };
  }

  private getStateSecret(): string {
    const secret = this.configService.get<string>('jwt.accessSecret', '');
    if (!secret) {
      throw new BadRequestException('JWT access secret missing');
    }

    return `${secret}:oauth-state`;
  }

  private assertGoogleProvider(provider: string): asserts provider is OAuthProvider {
    if (provider !== 'google') {
      throw new BadRequestException('Only google provider is supported');
    }
  }

  private async safeJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      return {} as T;
    }
  }
}