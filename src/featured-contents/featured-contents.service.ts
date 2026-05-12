import { BadRequestException, Injectable } from '@nestjs/common';
import { Types, type ClientSession } from 'mongoose';
import {
  DEFAULT_FEATURED_DURATION_MS,
  DEFAULT_FEATURED_RANK,
  DEFAULT_FEATURED_SCENE,
} from '../common/constants/featured-content.constants';
import { TargetType } from '../common/enums/target-type.enum';
import { AuditService } from '../infra/audit/audit.service';
import { ContentOperationLockService } from '../infra/redis/content-operation-lock.service';
import { InteractionsService } from '../interactions/interactions.service';
import {
  CancelFeaturedContentDto,
  QueryFeaturedContentsDto,
  UpsertFeaturedContentDto,
} from './dto/featured-content.dto';
import { FeaturedContentsRepository } from './repositories/featured-contents.repository';
import type { FeaturedContentDocument } from './schemas/featured-content.schema';

export interface FeaturedContentAdminItem {
  id: string;
  scene: string;
  targetType: TargetType;
  targetId: string;
  rank: number;
  enabled: boolean;
  activeNow: boolean;
  startAt: string;
  endAt: string;
  note: string;
  operatorId: string;
  createTime: string;
  updateTime: string;
}

@Injectable()
export class FeaturedContentsService {
  constructor(
    private readonly featuredContentsRepository: FeaturedContentsRepository,
    private readonly interactionsService: InteractionsService,
    private readonly auditService: AuditService,
    private readonly contentOperationLockService: ContentOperationLockService,
  ) {}

  async upsert(
    dto: UpsertFeaturedContentDto,
    operatorId: string,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(dto.targetType, dto.targetId, async () => {
      const scene = this.normalizeScene(dto.scene);
      const filter = {
        scene,
        target_type: dto.targetType,
        target_id: dto.targetId,
      };
      const before = await this.featuredContentsRepository.findOne(filter);
      const { startAt, endAt } = this.resolveSchedule(
        dto.startAt ? new Date(dto.startAt) : undefined,
        dto.endAt ? new Date(dto.endAt) : undefined,
        before ?? undefined,
      );

      this.assertScheduleValid(startAt, endAt);
      await this.interactionsService.assertTargetExists(dto.targetType, dto.targetId);

      const setPayload: Record<string, unknown> = {
        rank: dto.rank ?? DEFAULT_FEATURED_RANK,
        enabled: dto.enabled ?? true,
        note: dto.note?.trim() ?? '',
        operator_id: new Types.ObjectId(operatorId),
        start_at: startAt,
        end_at: endAt,
      };
      const updated = await this.featuredContentsRepository.upsertByTarget(filter, {
        $set: setPayload,
        $setOnInsert: {
          scene,
          target_type: dto.targetType,
          target_id: dto.targetId,
        },
      });

      if (!updated) {
        throw new BadRequestException('Failed to save featured content');
      }

      await this.auditService.recordCritical({
        operatorId,
        action: 'featured_content.upsert',
        resourceType: 'featured_content',
        resourceId: updated.id,
        before: before ? this.toAuditSnapshot(before) : undefined,
        after: this.toAuditSnapshot(updated),
        ip,
        ua,
        traceId,
      });

      return this.toAdminItem(updated);
    });
  }

  async cancel(
    dto: CancelFeaturedContentDto,
    operatorId: string,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(dto.targetType, dto.targetId, async () => {
      const scene = this.normalizeScene(dto.scene);
      const filter = {
        scene,
        target_type: dto.targetType,
        target_id: dto.targetId,
      };
      const before = await this.featuredContentsRepository.findOne(filter);

      if (!before) {
        return {
          success: true,
          canceled: false,
          scene,
          targetType: dto.targetType,
          targetId: dto.targetId,
        };
      }

      const updated = await this.featuredContentsRepository.updateByTarget(filter, {
        $set: {
          enabled: false,
          operator_id: new Types.ObjectId(operatorId),
        },
      });

      if (!updated) {
        return {
          success: true,
          canceled: false,
          scene,
          targetType: dto.targetType,
          targetId: dto.targetId,
        };
      }

      await this.auditService.recordCritical({
        operatorId,
        action: 'featured_content.cancel',
        resourceType: 'featured_content',
        resourceId: updated.id,
        before: this.toAuditSnapshot(before),
        after: this.toAuditSnapshot(updated),
        ip,
        ua,
        traceId,
      });

      return {
        success: true,
        canceled: true,
        item: this.toAdminItem(updated),
      };
    });
  }

  async list(query: QueryFeaturedContentsDto): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const now = new Date();
    const filter: Record<string, unknown> = {
      scene: this.normalizeScene(query.scene),
    };

    if (query.targetType) {
      filter.target_type = query.targetType;
    }
    if (typeof query.enabled === 'boolean') {
      filter.enabled = query.enabled;
    }

    if (!query.activeOnly) {
      const { items, total } = await this.featuredContentsRepository.list(
        filter,
        page,
        limit,
        { enabled: -1, rank: 1, update_time: -1 },
      );

      return {
        items: items.map((item) => this.toAdminItem(item, now)),
        page,
        limit,
        total,
      };
    }

    const activeFilter = {
      ...filter,
      ...this.buildScheduledActiveFilter(now),
    };
    const { items, total } = await this.featuredContentsRepository.list(
      activeFilter,
      page,
      limit,
      { rank: 1, update_time: -1 },
    );

    return {
      items: items.map((item) => this.toAdminItem(item, now)),
      page,
      limit,
      total,
    };
  }

  async listActive(scene: string, targetTypes: TargetType[], limit: number): Promise<FeaturedContentDocument[]> {
    return this.featuredContentsRepository.listActive(
      {
        scene: this.normalizeScene(scene),
        target_type: { $in: targetTypes },
        ...this.buildScheduledActiveFilter(new Date()),
      },
      limit,
    );
  }

  async listActiveTargetIds(scene: string, targetType: TargetType): Promise<string[]> {
    const items = await this.featuredContentsRepository.findMany({
      scene: this.normalizeScene(scene),
      target_type: targetType,
      ...this.buildScheduledActiveFilter(new Date()),
    });

    return items.map((item) => item.target_id);
  }

  async getActiveTargetAdminItemMap(
    scene: string,
    targetType: TargetType,
    targetIds: string[],
  ): Promise<Map<string, FeaturedContentAdminItem>> {
    const uniqueTargetIds = Array.from(new Set(targetIds.filter((targetId) => targetId.trim().length > 0)));
    if (uniqueTargetIds.length === 0) {
      return new Map();
    }

    const now = new Date();
    const items = await this.featuredContentsRepository.findMany({
      scene: this.normalizeScene(scene),
      target_type: targetType,
      target_id: { $in: uniqueTargetIds },
      ...this.buildScheduledActiveFilter(now),
    });

    return new Map(items.map((item) => [item.target_id, this.toAdminItem(item, now)]));
  }

  async countActiveByTargetType(scene: string, targetType: TargetType): Promise<number> {
    return this.featuredContentsRepository.count({
      scene: this.normalizeScene(scene),
      target_type: targetType,
      ...this.buildScheduledActiveFilter(new Date()),
    });
  }

  cancelAllByTarget(
    targetType: TargetType,
    targetId: string,
    operatorId: string,
    session?: ClientSession,
  ): Promise<number> {
    return this.featuredContentsRepository.updateMany(
      {
        target_type: targetType,
        target_id: targetId,
        enabled: true,
      },
      {
        $set: {
          enabled: false,
          operator_id: new Types.ObjectId(operatorId),
        },
      },
      session,
    );
  }

  deleteAllByTarget(targetType: TargetType, targetId: string, session?: ClientSession): Promise<number> {
    return this.featuredContentsRepository.deleteMany({
      target_type: targetType,
      target_id: targetId,
    }, session);
  }

  private toAdminItem(item: FeaturedContentDocument, now = new Date()): FeaturedContentAdminItem {
    const schedule = this.resolveEffectiveSchedule(item);

    return {
      id: item.id,
      scene: item.scene,
      targetType: item.target_type,
      targetId: item.target_id,
      rank: item.rank,
      enabled: item.enabled,
      activeNow: this.isActive(item, now),
      startAt: schedule.startAt.toISOString(),
      endAt: schedule.endAt.toISOString(),
      note: item.note,
      operatorId: item.operator_id.toString(),
      createTime: item.create_time.toISOString(),
      updateTime: item.update_time.toISOString(),
    };
  }

  private toAuditSnapshot(item: FeaturedContentDocument) {
    const schedule = this.resolveEffectiveSchedule(item);

    return {
      scene: item.scene,
      targetType: item.target_type,
      targetId: item.target_id,
      rank: item.rank,
      enabled: item.enabled,
      startAt: schedule.startAt.toISOString(),
      endAt: schedule.endAt.toISOString(),
      note: item.note,
      operatorId: item.operator_id.toString(),
    };
  }

  private isActive(item: FeaturedContentDocument, now: Date): boolean {
    const schedule = this.resolveEffectiveSchedule(item);
    if (!item.enabled) {
      return false;
    }
    if (schedule.startAt.getTime() > now.getTime()) {
      return false;
    }
    if (schedule.endAt.getTime() < now.getTime()) {
      return false;
    }

    return true;
  }

  private normalizeScene(scene?: string): string {
    const normalized = scene?.trim();
    return normalized && normalized.length > 0 ? normalized : DEFAULT_FEATURED_SCENE;
  }

  private assertScheduleValid(startAt?: Date, endAt?: Date): void {
    if (startAt && Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('startAt is invalid');
    }
    if (endAt && Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('endAt is invalid');
    }
    if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
      throw new BadRequestException('startAt cannot be later than endAt');
    }
  }

  private resolveSchedule(
    startAt?: Date,
    endAt?: Date,
    current?: FeaturedContentDocument,
  ): { startAt: Date; endAt: Date } {
    if (startAt && endAt) {
      return { startAt, endAt };
    }

    if (startAt) {
      return {
        startAt,
        endAt: new Date(startAt.getTime() + DEFAULT_FEATURED_DURATION_MS),
      };
    }

    if (endAt) {
      return {
        startAt: new Date(endAt.getTime() - DEFAULT_FEATURED_DURATION_MS),
        endAt,
      };
    }

    if (current) {
      return this.resolveEffectiveSchedule(current);
    }

    const now = new Date();
    return {
      startAt: now,
      endAt: new Date(now.getTime() + DEFAULT_FEATURED_DURATION_MS),
    };
  }

  private resolveEffectiveSchedule(item: FeaturedContentDocument): { startAt: Date; endAt: Date } {
    return {
      startAt: item.start_at,
      endAt: item.end_at,
    };
  }

  private buildScheduledActiveFilter(now: Date): Record<string, unknown> {
    return {
      enabled: true,
      start_at: { $lte: now },
      end_at: { $gte: now },
    };
  }
}
