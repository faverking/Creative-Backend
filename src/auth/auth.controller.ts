import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { getClientIp, getDeviceId, getUserAgent } from '../common/utils/request.util';
import { AuthService } from './auth.service';
import { AuthorizeDto } from './dto/authorize.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<unknown> {
    return this.authService.register(
      dto,
      getClientIp(req),
      getUserAgent(req),
      getDeviceId(req),
      req.traceId,
    );
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<unknown> {
    return this.authService.login(
      dto,
      getClientIp(req),
      getUserAgent(req),
      getDeviceId(req),
      req.traceId,
    );
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<unknown> {
    return this.authService.refresh(dto, getClientIp(req), getUserAgent(req), req.traceId);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: LogoutDto, @Req() req: Request): Promise<{ success: true }> {
    return this.authService.logout(dto, getClientIp(req), getUserAgent(req), req.traceId);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: JwtUser): Promise<unknown> {
    return this.authService.listUserSessions(user.userId);
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser): Promise<unknown> {
    return this.authService.getCurrentUserAuth(user.userId);
  }

  @Post('authorize')
  authorize(@CurrentUser() user: JwtUser, @Body() dto: AuthorizeDto): Promise<unknown> {
    return this.authService.authorize(user.userId, dto);
  }

  @Public()
  @Get('oauth/:provider/url')
  oauthUrl(
    @Param('provider') provider: string,
    @Req() req: Request,
  ): Promise<{ provider: string; authorizeUrl: string }> {
    return this.authService.getOAuthAuthorizeUrl(provider, getDeviceId(req));
  }

  @Public()
  @Get('oauth/:provider/callback')
  oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
  ): Promise<unknown> {
    return this.authService.handleOAuthCallback(
      provider,
      code,
      state,
      getClientIp(req),
      getUserAgent(req),
      req.traceId,
    );
  }
}
