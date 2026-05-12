import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '../articles/schemas/article.schema';
import { BookDetail, BookDetailSchema } from '../books/schemas/book.schema';
import { ImagePackage, ImagePackageSchema } from '../images/schemas/image.schema';
import { Topic, TopicSchema } from '../topics/schemas/topic.schema';
import { InteractionsService } from './interactions.service';

@Module({
  imports: [
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
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
