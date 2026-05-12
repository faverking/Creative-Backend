import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '../articles/schemas/article.schema';
import { BookChapter, BookChapterSchema, BookDetail, BookDetailSchema } from '../books/schemas/book.schema';
import { FeaturedContentsModule } from '../featured-contents/featured-contents.module';
import { ImagePackage, ImagePackageSchema } from '../images/schemas/image.schema';
import { MediaModule } from '../media/media.module';
import { Topic, TopicSchema } from '../topics/schemas/topic.schema';
import { UsersModule } from '../users/users.module';
import { WorkspaceRelationsModule } from '../workspace/workspace-relations.module';
import { AdminContentCommandService } from './admin-content-command.service';
import { AdminContentController } from './admin-content.controller';
import { AdminContentPresenter } from './admin-content.presenter';
import { AdminContentQueryService } from './admin-content-query.service';
import { AdminContentService } from './admin-content.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    UsersModule,
    MediaModule,
    FeaturedContentsModule,
    WorkspaceRelationsModule,
    MongooseModule.forFeature([
      {
        name: Article.name,
        schema: ArticleSchema,
      },
      {
        name: BookDetail.name,
        schema: BookDetailSchema,
      },
      {
        name: BookChapter.name,
        schema: BookChapterSchema,
      },
      {
        name: Topic.name,
        schema: TopicSchema,
      },
      {
        name: ImagePackage.name,
        schema: ImagePackageSchema,
      },
    ]),
  ],
  controllers: [AdminController, AdminContentController],
  providers: [
    AdminContentService,
    AdminContentPresenter,
    AdminContentQueryService,
    AdminContentCommandService,
  ],
})
export class AdminModule {}
