import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InteractionsModule } from '../interactions/interactions.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { FavoritesController } from './favorites.controller';
import { FavoritesRepository } from './repositories/favorites.repository';
import { Favorite, FavoriteSchema } from './schemas/favorite.schema';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [
    InteractionsModule,
    WorkspaceModule,
    MongooseModule.forFeature([
      {
        name: Favorite.name,
        schema: FavoriteSchema,
      },
    ]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService, FavoritesRepository],
  exports: [FavoritesService, FavoritesRepository],
})
export class FavoritesModule {}
