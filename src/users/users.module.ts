import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '../articles/schemas/article.schema';
import { BookDetail, BookDetailSchema } from '../books/schemas/book.schema';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema';
import { Draft, DraftSchema } from '../drafts/schemas/draft.schema';
import { ImagePackage, ImagePackageSchema } from '../images/schemas/image.schema';
import { Topic, TopicSchema } from '../topics/schemas/topic.schema';
import { UsersController } from './users.controller';
import { UsersBootstrapService } from './users-bootstrap.service';
import { UsersRepository } from './repositories/users.repository';
import { User, UserSchema } from './schemas/user.schema';
import { UserBusinessStatsService } from './user-business-stats.service';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
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
        name: ImagePackage.name,
        schema: ImagePackageSchema,
      },
      {
        name: Topic.name,
        schema: TopicSchema,
      },
      {
        name: Draft.name,
        schema: DraftSchema,
      },
      {
        name: Comment.name,
        schema: CommentSchema,
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserBusinessStatsService, UsersBootstrapService],
  exports: [UsersService, UsersRepository, UserBusinessStatsService, MongooseModule],
})
export class UsersModule {}





