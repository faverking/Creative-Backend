import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaModule } from '../media/media.module';
import { SearchModule } from '../search/search.module';
import { UsersModule } from '../users/users.module';
import { WorkspaceActivityModule } from '../workspace/workspace-activity.module';
import { WorkspaceRelationsModule } from '../workspace/workspace-relations.module';
import { ArticlesController } from './articles.controller';
import { ArticlesRepository } from './repositories/articles.repository';
import { Article, ArticleSchema } from './schemas/article.schema';
import { ArticlesService } from './articles.service';

@Module({
  imports: [
    MediaModule,
    UsersModule,
    SearchModule,
    WorkspaceActivityModule,
    WorkspaceRelationsModule,
    MongooseModule.forFeature([
      {
        name: Article.name,
        schema: ArticleSchema,
      },
    ]),
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService, ArticlesRepository],
  exports: [ArticlesService],
})
export class ArticlesModule {}
