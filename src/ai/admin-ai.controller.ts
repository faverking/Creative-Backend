import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ROLE_ADMIN, ROLE_EDITOR, ROLE_SUPER_ADMIN } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { AdminAiService } from './admin-ai.service';
import type { AdminComposeResponseDto } from './dto/admin-compose-response.dto';
import { AdminComposeRequestDto } from './dto/admin-compose.dto';

@Controller('admin/ai')
@Roles(ROLE_EDITOR, ROLE_ADMIN, ROLE_SUPER_ADMIN)
@Throttle({
  default: {
    limit: 6,
    ttl: 60_000,
  },
})
export class AdminAiController {
  constructor(private readonly adminAiService: AdminAiService) {}

  @Post('compose')
  compose(
    @CurrentUser() user: JwtUser,
    @Body() dto: AdminComposeRequestDto,
    @Req() req: Request,
  ): Promise<AdminComposeResponseDto> {
    return this.adminAiService.composeForAdmin(user, dto, req.traceId ?? '');
  }

  @Post('compose/stream')
  async composeStream(
    @CurrentUser() user: JwtUser,
    @Body() dto: AdminComposeRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const stream = await this.adminAiService.composeForAdminStream(user, dto, req.traceId ?? '');

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    for await (const event of stream) {
      if (res.destroyed || res.writableEnded) {
        break;
      }

      res.write(this.toSseMessage(event.event, event.data));
    }

    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
  }

  private toSseMessage(event: string, payload: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  }
}
