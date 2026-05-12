import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InteractionsModule } from '../interactions/interactions.module';
import { NotificationModule } from '../notification/notification.module';
import { UsersModule } from '../users/users.module';
import { CommentsApplicationService } from './application/comments.application';
import { CommentsController } from './comments.controller';
import { CommentsRepository } from './repositories/comments.repository';
import { Comment, CommentSchema } from './schemas/comment.schema';

@Module({
  imports: [
    UsersModule,
    InteractionsModule,
    NotificationModule,
    MongooseModule.forFeature([
      {
        name: Comment.name,
        schema: CommentSchema,
      },
    ]),
  ],
  controllers: [CommentsController],
  providers: [CommentsApplicationService, CommentsRepository],
  exports: [CommentsApplicationService, CommentsRepository],
})
export class CommentsModule {}
