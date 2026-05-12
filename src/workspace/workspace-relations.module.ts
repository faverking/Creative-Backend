import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { FeaturedContentsModule } from '../featured-contents/featured-contents.module';
import { HistoryModule } from '../history/history.module';
import { InteractionsModule } from '../interactions/interactions.module';
import { NotificationModule } from '../notification/notification.module';
import { WorkspaceRelationCleanupService } from './workspace-relation-cleanup.service';

@Module({
  imports: [
    CommentsModule,
    FavoritesModule,
    HistoryModule,
    NotificationModule,
    FeaturedContentsModule,
    InteractionsModule,
  ],
  providers: [WorkspaceRelationCleanupService],
  exports: [WorkspaceRelationCleanupService],
})
export class WorkspaceRelationsModule {}
