import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { TargetType } from '../common/enums/target-type.enum';
import { HistoryRepository } from './repositories/history.repository';
import { QueryMyHistoryDto } from './dto/history.dto';
import { WorkspaceContentService } from '../workspace/workspace-content.service';

const HISTORY_MAX_ITEMS_PER_USER = 1000;

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    private readonly historyRepository: HistoryRepository,
    private readonly workspaceContentService: WorkspaceContentService,
  ) {}

  recordVisitAsync(userId: string, targetType: TargetType, targetId: string, sourceLabel?: string): void {
    setImmediate(() => {
      void this.recordVisit(userId, targetType, targetId, sourceLabel).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown history write error';
        this.logger.warn(
          `Failed to record history visit: targetType=${targetType}, targetId=${targetId}, userId=${userId}, reason=${message}`,
        );
      });
    });
  }

  async recordVisit(userId: string, targetType: TargetType, targetId: string, sourceLabel?: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(targetId)) {
      return;
    }

    await this.historyRepository.upsertVisit(userId, targetType, targetId, sourceLabel);
    await this.historyRepository.pruneOverflowByUser(userId, HISTORY_MAX_ITEMS_PER_USER);
  }

  async listMyHistory(userId: string, query: QueryMyHistoryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter: Record<string, unknown> = {
      user_id: new Types.ObjectId(userId),
    };

    if (query.targetType) {
      filter.target_type = query.targetType;
    }

    return this.loadVisibleHistoryPage(filter, page, limit);
  }

  async clearMyHistory(userId: string) {
    const deletedCount = await this.historyRepository.clearByUser(userId);

    return {
      success: true as const,
      deletedCount,
    };
  }

  private async loadVisibleHistoryPage(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{
    items: Array<{
      id: string;
      targetType: string;
      targetId: string;
      visitedAt: Date;
      sourceLabel?: string;
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
    const { items, total } = await this.historyRepository.list(filter, page, limit);
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
      await this.historyRepository.deleteManyByIds(hiddenItemIds);
      return this.loadVisibleHistoryPage(filter, page, limit);
    }

    return {
      items: items.map((item) => {
        const content = contentMap.get(`${item.target_type}:${item.target_id}`)!;
        return {
          id: item.id,
          targetType: item.target_type,
          targetId: item.target_id,
          visitedAt: item.visited_at,
          sourceLabel: item.source_label,
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
