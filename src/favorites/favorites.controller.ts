import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { JwtUser } from '../common/interfaces/jwt-user.interface';
import { getClientIp, getUserAgent } from '../common/utils/request.util';
import { QueryMyFavoritesDto, ToggleFavoriteDto } from './dto/favorite.dto';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post('toggle')
  @Idempotent(60)
  toggle(@CurrentUser() user: JwtUser, @Body() dto: ToggleFavoriteDto, @Req() req: Request) {
    return this.favoritesService.toggle(
      user.userId,
      dto,
      req.traceId,
      getClientIp(req),
      getUserAgent(req),
    );
  }

  @Get('me')
  listMyFavorites(@CurrentUser() user: JwtUser, @Query() query: QueryMyFavoritesDto) {
    return this.favoritesService.listMyFavorites(user.userId, query);
  }
}
