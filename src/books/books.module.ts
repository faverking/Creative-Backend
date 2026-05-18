import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FavoritesModule } from '../favorites/favorites.module';
import { MediaModule } from '../media/media.module';
import { SearchModule } from '../search/search.module';
import { WorkspaceActivityModule } from '../workspace/workspace-activity.module';
import { WorkspaceRelationsModule } from '../workspace/workspace-relations.module';
import { BooksApplicationService } from './application/books.application';
import { BooksController } from './books.controller';
import { BooksDomainService } from './domain/books.domain.service';
import { BooksRepository } from './repositories/books.repository';
import {
  BookChapter,
  BookChapterSchema,
  BookDetail,
  BookDetailSchema,
} from './schemas/book.schema';

@Module({
  imports: [
    MediaModule,
    FavoritesModule,
    SearchModule,
    WorkspaceActivityModule,
    WorkspaceRelationsModule,
    MongooseModule.forFeature([
      {
        name: BookDetail.name,
        schema: BookDetailSchema,
      },
      {
        name: BookChapter.name,
        schema: BookChapterSchema,
      },
    ]),
  ],
  controllers: [BooksController],
  providers: [BooksApplicationService, BooksDomainService, BooksRepository],
  exports: [BooksApplicationService],
})
export class BooksModule {}
