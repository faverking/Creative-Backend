import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FavoritesModule } from '../favorites/favorites.module';
import { MediaModule } from '../media/media.module';
import { SearchModule } from '../search/search.module';
import { UsersModule } from '../users/users.module';
import { WorkspaceActivityModule } from '../workspace/workspace-activity.module';
import { WorkspaceRelationsModule } from '../workspace/workspace-relations.module';
import { ImagesApplicationService } from './application/images.application';
import { ImagesController } from './images.controller';
import { ImagesRepository } from './repositories/images.repository';
import { ImagePackage, ImagePackageSchema } from './schemas/image.schema';

@Module({
  imports: [
    MediaModule,
    UsersModule,
    FavoritesModule,
    SearchModule,
    WorkspaceActivityModule,
    WorkspaceRelationsModule,
    MongooseModule.forFeature([
      {
        name: ImagePackage.name,
        schema: ImagePackageSchema,
      },
    ]),
  ],
  controllers: [ImagesController],
  providers: [ImagesApplicationService, ImagesRepository],
  exports: [ImagesApplicationService],
})
export class ImagesModule {}
