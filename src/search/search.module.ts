import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '../articles/schemas/article.schema';
import { BookDetail, BookDetailSchema } from '../books/schemas/book.schema';
import { FeaturedContentsModule } from '../featured-contents/featured-contents.module';
import { ImagePackage, ImagePackageSchema } from '../images/schemas/image.schema';
import { MediaModule } from '../media/media.module';
import { Topic, TopicSchema } from '../topics/schemas/topic.schema';
import { UsersModule } from '../users/users.module';
import { SearchContentPresenter } from './search-content.presenter';
import { SearchController } from './search.controller';
import { SearchFeaturedService } from './search-featured.service';
import { SearchQueryService } from './search-query.service';
import { SearchRelatedService } from './search-related.service';
import { SearchRepository } from './repositories/search.repository';
import { SearchService } from './search.service';

@Module({
  imports: [
    MediaModule,
    UsersModule,
    FeaturedContentsModule,
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
  controllers: [SearchController],
  providers: [
    SearchService,
    SearchRepository,
    SearchQueryService,
    SearchFeaturedService,
    SearchRelatedService,
    SearchContentPresenter,
  ],
  exports: [SearchService],
})
export class SearchModule {}
