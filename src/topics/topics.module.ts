import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FavoritesModule } from '../favorites/favorites.module';
import { MediaModule } from '../media/media.module';
import { SearchModule } from '../search/search.module';
import { UsersModule } from '../users/users.module';
import { WorkspaceActivityModule } from '../workspace/workspace-activity.module';
import { WorkspaceRelationsModule } from '../workspace/workspace-relations.module';
import { TopicsApplicationService } from './application/topics.application';
import { TopicsController } from './topics.controller';
import { TopicsRepository } from './repositories/topics.repository';
import { Topic, TopicSchema } from './schemas/topic.schema';

@Module({
  imports: [
    MediaModule,
    SearchModule,
    WorkspaceActivityModule,
    UsersModule,
    FavoritesModule,
    WorkspaceRelationsModule,
    MongooseModule.forFeature([
      {
        name: Topic.name,
        schema: TopicSchema,
      },
    ]),
  ],
  controllers: [TopicsController],
  providers: [TopicsApplicationService, TopicsRepository],
  exports: [TopicsApplicationService],
})
export class TopicsModule {}
