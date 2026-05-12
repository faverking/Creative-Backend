import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '../articles/schemas/article.schema';
import { BookDetail, BookDetailSchema } from '../books/schemas/book.schema';
import { ImagePackage, ImagePackageSchema } from '../images/schemas/image.schema';
import { MediaModule } from '../media/media.module';
import { Topic, TopicSchema } from '../topics/schemas/topic.schema';
import { UsersModule } from '../users/users.module';
import { WorkspaceContentPresenter } from './workspace-content.presenter';
import { WorkspaceContentService } from './workspace-content.service';

@Module({
  imports: [
    MediaModule,
    UsersModule,
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
        name: Topic.name,
        schema: TopicSchema,
      },
      {
        name: ImagePackage.name,
        schema: ImagePackageSchema,
      },
    ]),
  ],
  providers: [WorkspaceContentService, WorkspaceContentPresenter],
  exports: [WorkspaceContentService],
})
export class WorkspaceModule {}
