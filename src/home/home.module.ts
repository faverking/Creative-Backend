import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { BooksModule } from '../books/books.module';
import { ImagesModule } from '../images/images.module';
import { TopicsModule } from '../topics/topics.module';
import { HomeApplicationService } from './application/home.application';
import { HomeController } from './home.controller';

@Module({
  imports: [ArticlesModule, TopicsModule, BooksModule, ImagesModule],
  controllers: [HomeController],
  providers: [HomeApplicationService],
})
export class HomeModule {}
