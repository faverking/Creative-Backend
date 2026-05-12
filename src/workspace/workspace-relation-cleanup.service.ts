import { Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import { CommentsRepository } from '../comments/repositories/comments.repository';
import { TargetType } from '../common/enums/target-type.enum';
import { FavoritesRepository } from '../favorites/repositories/favorites.repository';
import { FeaturedContentsService } from '../featured-contents/featured-contents.service';
import { HistoryRepository } from '../history/repositories/history.repository';
import { InteractionsService } from '../interactions/interactions.service';
import { NotificationRepository } from '../notification/repositories/notification.repository';

@Injectable()
export class WorkspaceRelationCleanupService {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly favoritesRepository: FavoritesRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly featuredContentsService: FeaturedContentsService,
    private readonly interactionsService: InteractionsService,
  ) {}

  async cleanupHiddenTarget(
    targetType: TargetType,
    targetId: string,
    operatorId: string,
    session?: ClientSession,
  ): Promise<{
    deletedFavorites: number;
    deletedHistoryEntries: number;
    deletedNotifications: number;
    canceledFeaturedCount: number;
  }> {
    const [deletedFavorites, deletedHistoryEntries, deletedNotifications, canceledFeaturedCount] = await Promise.all([
      this.favoritesRepository.deleteManyByTarget(targetType, targetId, session),
      this.historyRepository.deleteManyByTarget(targetType, targetId, session),
      this.notificationRepository.deleteManyByTarget(targetType, targetId, session),
      this.featuredContentsService.cancelAllByTarget(targetType, targetId, operatorId, session),
    ]);

    await this.interactionsService.setFavorCountIfPresent(targetType, targetId, 0, session);

    return {
      deletedFavorites,
      deletedHistoryEntries,
      deletedNotifications,
      canceledFeaturedCount,
    };
  }

  async cleanupDeletedTarget(
    targetType: TargetType,
    targetId: string,
    session?: ClientSession,
  ): Promise<{
    deletedComments: number;
    deletedFavorites: number;
    deletedHistoryEntries: number;
    deletedNotifications: number;
    deletedFeaturedConfigs: number;
  }> {
    const [deletedComments, deletedFavorites, deletedHistoryEntries, deletedNotifications, deletedFeaturedConfigs] =
      await Promise.all([
        this.commentsRepository.deleteByTarget(targetType, targetId, session),
        this.favoritesRepository.deleteManyByTarget(targetType, targetId, session),
        this.historyRepository.deleteManyByTarget(targetType, targetId, session),
        this.notificationRepository.deleteManyByTarget(targetType, targetId, session),
        this.featuredContentsService.deleteAllByTarget(targetType, targetId, session),
      ]);

    return {
      deletedComments,
      deletedFavorites,
      deletedHistoryEntries,
      deletedNotifications,
      deletedFeaturedConfigs,
    };
  }
}
