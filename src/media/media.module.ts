import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '../articles/schemas/article.schema';
import { BookDetail, BookDetailSchema } from '../books/schemas/book.schema';
import { ImagePackage, ImagePackageSchema } from '../images/schemas/image.schema';
import { Topic, TopicSchema } from '../topics/schemas/topic.schema';
import { MediaApplicationService } from './application/media.application';
import { MediaController } from './media.controller';
import { MediaRepository } from './repositories/media.repository';
import { MediaAsset, MediaAssetSchema } from './schemas/media-asset.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: MediaAsset.name,
        schema: MediaAssetSchema,
      },
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
  controllers: [MediaController],
  providers: [MediaRepository, MediaApplicationService],
  exports: [MediaApplicationService],
})
export class MediaModule {}
