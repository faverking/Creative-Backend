import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuditService } from '../infra/audit/audit.service';
import { MongoTransactionService } from '../infra/database/mongo-transaction.service';
import { ContentOperationLockService } from '../infra/redis/content-operation-lock.service';
import { InteractionsService } from '../interactions/interactions.service';
import { WorkspaceContentService } from '../workspace/workspace-content.service';
import { QueryMyFavoritesDto, ToggleFavoriteDto } from './dto/favorite.dto';
import { FavoritesRepository } from './repositories/favorites.repository';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly favoritesRepository: FavoritesRepository,
    private readonly interactionsService: InteractionsService,
    private readonly auditService: AuditService,
    private readonly mongoTransactionService: MongoTransactionService,
    private readonly contentOperationLockService: ContentOperationLockService,
    private readonly workspaceContentService: WorkspaceContentService,
  ) {}

  async toggle(userId: string, dto: ToggleFavoriteDto, traceId?: string, ip?: string, ua?: string) {
    return this.contentOperationLockService.runWithContentLock(dto.targetType, dto.targetId, async () => {
      const filter = {
        user_id: new Types.ObjectId(userId),
        target_type: dto.targetType,
        target_id: dto.targetId,
      };

      const removed = await this.mongoTransactionService.runInTransaction(async (session) => {
        const deletedFavorite = await this.favoritesRepository.findOneAndDelete(filter, session);
        if (!deletedFavorite) {
          return null;
        }

        const count = await this.favoritesRepository.countByTarget(dto.targetType, dto.targetId, session);
        await this.interactionsService.setFavorCountStrict(dto.targetType, dto.targetId, count, session);
        return deletedFavorite;
      });

      if (removed) {
        this.auditService.recordEventually({
          operatorId: userId,
          action: 'favorite.cancel',
          resourceType: dto.targetType,
          resourceId: dto.targetId,
          ip,
          ua,
          traceId,
        });
        return {
          favored: false,
          targetType: dto.targetType,
          targetId: dto.targetId,
        };
      }

      await this.interactionsService.assertTargetExists(dto.targetType, dto.targetId);

      const created = await this.mongoTransactionService.runInTransaction(async (session) => {
        const createdFavorite = await this.favoritesRepository.create(
          {
            user_id: new Types.ObjectId(userId),
            target_type: dto.targetType,
            target_id: dto.targetId,
          },
          session,
        );
        const count = await this.favoritesRepository.countByTarget(dto.targetType, dto.targetId, session);
        await this.interactionsService.setFavorCountStrict(dto.targetType, dto.targetId, count, session);
        return createdFavorite;
      });

      this.auditService.recordEventually({
        operatorId: userId,
        action: 'favorite.create',
        resourceType: dto.targetType,
        resourceId: dto.targetId,
        ip,
        ua,
        traceId,
      });

      return {
        favored: true,
        favoriteId: created.id,
        targetType: dto.targetType,
        targetId: dto.targetId,
      };
    });
  }

  async listMyFavorites(userId: string, query: QueryMyFavoritesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const condition: Record<string, unknown> = {
      user_id: new Types.ObjectId(userId),
    };
    if (query.targetType) {
      condition.target_type = query.targetType;
    }

    return this.loadVisibleFavoritesPage(condition, page, limit);
  }

  private async loadVisibleFavoritesPage(
    condition: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{
    items: Array<{
      id: string;
      targetType: string;
      targetId: string;
      savedAt: Date;
      title: string;
      summary: string;
      coverMedia: unknown;
      meta: Record<string, unknown>;
      author: unknown;
      tags: string[];
    }>;
    page: number;
    limit: number;
    total: number;
  }> {
    const { items, total } = await this.favoritesRepository.list(condition, page, limit);
    const contentMap = await this.workspaceContentService.getContentSummaryMap(
      items.map((item) => ({
        targetType: item.target_type,
        targetId: item.target_id,
      })),
    );
    const hiddenItemIds = items
      .filter((item) => !contentMap.has(`${item.target_type}:${item.target_id}`))
      .map((item) => item.id);

    if (hiddenItemIds.length > 0) {
      await this.favoritesRepository.deleteManyByIds(hiddenItemIds);
      return this.loadVisibleFavoritesPage(condition, page, limit);
    }

    return {
      items: items.map((item) => {
        const content = contentMap.get(`${item.target_type}:${item.target_id}`)!;
        return {
          id: item.id,
          targetType: item.target_type,
          targetId: item.target_id,
          savedAt: item.create_time,
          title: content.title,
          summary: content.summary,
          coverMedia: content.coverMedia,
          meta: content.meta,
          author: content.author,
          tags: content.tags,
        };
      }),
      page,
      limit,
      total,
    };
  }
}
