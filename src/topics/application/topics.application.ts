import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { TargetType } from '../../common/enums/target-type.enum';
import { Visibility } from '../../common/enums/visibility.enum';
import { buildTopicFeatureFlagTags } from '../../common/utils/content-tag.util';
import { buildShanghaiDateRangeFilter } from '../../common/utils/date-range.util';
import {
  buildKeywordSearchFilter,
  buildKeywordSearchTerms,
} from '../../common/utils/keyword-search.util';
import {
  mapPrimaryReferencedMediaAsset,
  mapReferencedMediaAssets,
  toCompactUserIdentity,
} from '../../common/utils/content-presentation.util';
import {
  normalizeMediaReferenceIds,
  pickFirstMediaReferenceId,
  type MediaReferenceInput,
} from '../../common/utils/media-reference.util';
import { buildStartsWithRegex } from '../../common/utils/regex.util';
import { buildApprovedPublicFilter } from '../../common/utils/public-content-filter.util';
import {
  type ResolvedMediaAssetMode,
  type ResolvedMediaAsset,
} from '../../common/utils/media-summary.util';
import { AuditService } from '../../infra/audit/audit.service';
import { MongoTransactionService } from '../../infra/database/mongo-transaction.service';
import { ContentOperationLockService } from '../../infra/redis/content-operation-lock.service';
import { FavoritesService } from '../../favorites/favorites.service';
import {
  MediaApplicationService,
  type MediaSummary,
} from '../../media/application/media.application';
import { UsersService, type UserSafeProfile } from '../../users/users.service';
import { WorkspaceRelationCleanupService } from '../../workspace/workspace-relation-cleanup.service';
import { CreateTopicDto, QueryMyTopicsDto, QueryTopicsDto, UpdateTopicDto } from '../dto/topic.dto';
import { TopicsRepository } from '../repositories/topics.repository';
import type { TopicDocument } from '../schemas/topic.schema';

export interface HomeTopicItem {
  id: string;
  topicId: number;
  title: string;
  summary: string;
  coverMedia?: ResolvedMediaAsset;
  author?: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  featureFlags: number[];
  featureFlagLabels: string[];
  viewCount: number;
  replyCount: number;
}

@Injectable()
export class TopicsApplicationService {
  constructor(
    private readonly topicsRepository: TopicsRepository,
    private readonly auditService: AuditService,
    private readonly mediaApplicationService: MediaApplicationService,
    private readonly mongoTransactionService: MongoTransactionService,
    private readonly contentOperationLockService: ContentOperationLockService,
    private readonly usersService: UsersService,
    private readonly favoritesService: FavoritesService,
    private readonly workspaceRelationCleanupService: WorkspaceRelationCleanupService,
  ) {}

  async createTopic(dto: CreateTopicDto, operatorId: string, traceId?: string): Promise<unknown> {
    const imageMediaIds = normalizeMediaReferenceIds(dto.images ?? []);
    await this.mediaApplicationService.assertMediaIdsExist(imageMediaIds, 'image');

    const created = await this.topicsRepository.create({
      topic_id: dto.topicId,
      type_id: dto.typeId,
      title: dto.title,
      images: imageMediaIds,
      content: dto.content,
      desc: dto.desc,
      search_terms: buildKeywordSearchTerms(dto.title, dto.desc),
      download_url: dto.downloadUrl,
      feature_flags: this.normalizeFeatureFlags(dto.featureFlags),
      user_id: new Types.ObjectId(operatorId),
      view_count: 0,
      reply_count: 0,
      favor_count: 0,
      review_status: ReviewStatus.APPROVED,
      visibility: Visibility.PUBLIC,
    });

    this.auditService.recordEventually({
      operatorId,
      action: 'topic.create',
      resourceType: 'topic',
      resourceId: created.id,
      traceId,
    });

    return this.toEditableDetail(
      created,
      await this.createMediaSummaryMap(normalizeMediaReferenceIds(created.images)),
    );
  }

  async listTopics(query: QueryTopicsDto, viewerUserId?: string): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const filter: Record<string, unknown> = {
      ...buildApprovedPublicFilter(),
    };
    if (typeof query.topicId === 'number') {
      filter.topic_id = query.topicId;
    }
    if (typeof query.typeId === 'number') {
      filter.type_id = query.typeId;
    }
    if (Array.isArray(query.featureFlags) && query.featureFlags.length > 0) {
      filter.feature_flags = { $all: this.normalizeFeatureFlags(query.featureFlags) };
    }
    Object.assign(filter, buildKeywordSearchFilter(query.keyword));

    const { items, total } = await this.topicsRepository.list(
      filter,
      page,
      limit,
      this.resolveListSort(query.sort),
    );
    const mediaMap = await this.createMediaSummaryMap(
      items.flatMap((item) => normalizeMediaReferenceIds(item.images)),
    );
    const authorMap = query.includeAuthor
      ? await this.usersService.getSafeProfileMap(items.map((item) => item.user_id.toString()))
      : new Map<string, UserSafeProfile>();

    return {
      items: items.map((item) =>
        this.toListItem(
          item,
          mediaMap,
          authorMap.get(item.user_id.toString()),
          Boolean(viewerUserId),
        ),
      ),
      page,
      limit,
      total,
    };
  }

  async listHome(limit: number): Promise<HomeTopicItem[]> {
    const { items } = await this.topicsRepository.list(
      buildApprovedPublicFilter(),
      1,
      limit,
      this.resolveListSort('recommend'),
    );
    const mediaMap = await this.createMediaSummaryMap(
      items
        .map((item) => pickFirstMediaReferenceId(item.images))
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    );
    const authorMap = await this.usersService.getSafeProfileMap(
      items.map((item) => item.user_id.toString()),
    );

    return items.map((item) =>
      this.toHomeItem(item, mediaMap, authorMap.get(item.user_id.toString())),
    );
  }

  async listMyTopics(userId: string, query: QueryMyTopicsDto): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const filter: Record<string, unknown> = {
      user_id: new Types.ObjectId(userId),
    };

    if (typeof query.topicId === 'number') {
      filter.topic_id = query.topicId;
    }
    if (typeof query.typeId === 'number') {
      filter.type_id = query.typeId;
    }
    if (Array.isArray(query.featureFlags) && query.featureFlags.length > 0) {
      filter.feature_flags = { $all: this.normalizeFeatureFlags(query.featureFlags) };
    }
    if (query.title) {
      filter.title = buildStartsWithRegex(query.title);
    }

    const postTimeRange = buildShanghaiDateRangeFilter(query.startDate, query.endDate);
    if (postTimeRange) {
      filter.post_time = postTimeRange;
    }

    const { items, total } = await this.topicsRepository.list(filter, page, limit);
    const mediaMap = await this.createMediaSummaryMap(
      items.flatMap((item) => normalizeMediaReferenceIds(item.images)),
    );

    return {
      items: items.map((item) => this.toListItem(item, mediaMap)),
      page,
      limit,
      total,
    };
  }

  async getTopicDetail(id: string, viewerUserId?: string): Promise<unknown> {
    const topic = await this.topicsRepository.findOneAndIncrementViewCount({
      _id: id,
      ...buildApprovedPublicFilter(),
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const [mediaMap, authorMap, favored] = await Promise.all([
      this.createMediaSummaryMap(normalizeMediaReferenceIds(topic.images)),
      this.usersService.getSafeProfileMap([topic.user_id.toString()]),
      this.favoritesService.isFavorited(viewerUserId, TargetType.TOPIC, id),
    ]);
    return {
      ...this.toPublicDetail(
        topic,
        mediaMap,
        authorMap.get(topic.user_id.toString()),
        Boolean(viewerUserId),
      ),
      favored,
    };
  }

  async getMyTopicDetail(id: string, userId: string): Promise<unknown> {
    const topic = await this.topicsRepository.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    if (topic.user_id.toString() !== userId) {
      throw new ForbiddenException('No permission to access this topic');
    }

    return this.toEditableDetail(
      topic,
      await this.createMediaSummaryMap(normalizeMediaReferenceIds(topic.images)),
    );
  }

  async updateTopic(
    id: string,
    userId: string,
    dto: UpdateTopicDto,
    traceId?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(TargetType.TOPIC, id, async () => {
      const topic = await this.topicsRepository.findById(id);
      if (!topic) {
        throw new NotFoundException('Topic not found');
      }

      if (topic.user_id.toString() !== userId) {
        throw new ForbiddenException('No permission to update this topic');
      }

      const payload: Record<string, unknown> = {};
      if (typeof dto.topicId === 'number') payload.topic_id = dto.topicId;
      if (typeof dto.typeId === 'number') payload.type_id = dto.typeId;
      if (typeof dto.title === 'string') payload.title = dto.title;
      if (dto.images) {
        const imageMediaIds = normalizeMediaReferenceIds(dto.images);
        await this.mediaApplicationService.assertMediaIdsExist(imageMediaIds, 'image');
        payload.images = imageMediaIds;
      }
      if (typeof dto.content === 'string') payload.content = dto.content;
      if (typeof dto.desc === 'string') payload.desc = dto.desc;
      if (typeof dto.downloadUrl === 'string') payload.download_url = dto.downloadUrl;
      if (Array.isArray(dto.featureFlags))
        payload.feature_flags = this.normalizeFeatureFlags(dto.featureFlags);
      payload.search_terms = buildKeywordSearchTerms(
        typeof dto.title === 'string' ? dto.title : topic.title,
        typeof dto.desc === 'string' ? dto.desc : topic.desc,
      );

      const updated = await this.topicsRepository.updateById(id, payload);
      if (!updated) {
        throw new NotFoundException('Topic not found');
      }

      this.auditService.recordEventually({
        operatorId: userId,
        action: 'topic.update',
        resourceType: 'topic',
        resourceId: id,
        traceId,
      });

      return this.toEditableDetail(
        updated,
        await this.createMediaSummaryMap(normalizeMediaReferenceIds(updated.images)),
      );
    });
  }

  async deleteTopic(
    id: string,
    userId: string,
    cascadeMedia = false,
    traceId?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(TargetType.TOPIC, id, async () => {
      const topic = await this.topicsRepository.findById(id);
      if (!topic) {
        throw new NotFoundException('Topic not found');
      }

      if (topic.user_id.toString() !== userId) {
        throw new ForbiddenException('No permission to delete this topic');
      }

      const linkedMediaIds = normalizeMediaReferenceIds(topic.images);
      const result = await this.mongoTransactionService.runInTransaction(async (session) => {
        await this.topicsRepository.deleteById(id, session);
        return this.workspaceRelationCleanupService.cleanupDeletedTarget(
          TargetType.TOPIC,
          id,
          session,
        );
      });

      let mediaCleanup:
        | { deletedIds: string[]; skipped: Array<{ id: string; reason: string }> }
        | undefined;
      if (cascadeMedia) {
        mediaCleanup = await this.mediaApplicationService.deleteOwnedImagesIfUnreferenced(
          linkedMediaIds,
          userId,
          traceId,
        );
      }

      this.auditService.recordEventually({
        operatorId: userId,
        action: 'topic.delete',
        resourceType: 'topic',
        resourceId: id,
        traceId,
      });

      return {
        success: true,
        ...result,
        mediaCleanup,
      };
    });
  }

  private resolveListSort(sort: QueryTopicsDto['sort']): Record<string, 1 | -1> {
    if (sort === 'hot') {
      return {
        favor_count: -1,
        reply_count: -1,
        view_count: -1,
        post_time: -1,
      };
    }

    if (sort === 'recommend') {
      return {
        favor_count: -1,
        reply_count: -1,
        view_count: -1,
        update_time: -1,
      };
    }

    return {
      post_time: -1,
    };
  }

  private async createMediaSummaryMap(mediaIds: string[]) {
    return this.mediaApplicationService.getMediaSummaryMap(mediaIds);
  }

  private mapImageAssets(
    mediaIds: MediaReferenceInput[],
    mediaMap: Map<string, MediaSummary>,
    mode: ResolvedMediaAssetMode = 'full',
  ): ResolvedMediaAsset[] {
    return mapReferencedMediaAssets(mediaIds, mediaMap, mode);
  }

  private mapPrimaryImageAsset(
    mediaIds: MediaReferenceInput[],
    mediaMap: Map<string, MediaSummary>,
    mode: ResolvedMediaAssetMode = 'full',
  ): ResolvedMediaAsset | undefined {
    return mapPrimaryReferencedMediaAsset(mediaIds, mediaMap, mode);
  }

  private toAuthor(author?: UserSafeProfile) {
    return toCompactUserIdentity(author);
  }

  private toHomeItem(
    item: TopicDocument,
    mediaMap: Map<string, MediaSummary>,
    author?: UserSafeProfile,
  ): HomeTopicItem {
    return {
      id: item.id,
      topicId: item.topic_id,
      title: item.title,
      summary: item.desc,
      coverMedia: this.mapPrimaryImageAsset(item.images, mediaMap, 'compact'),
      author: this.toAuthor(author),
      featureFlags: item.feature_flags ?? [],
      featureFlagLabels: this.buildFeatureFlagLabels(item.feature_flags),
      viewCount: item.view_count ?? 0,
      replyCount: item.reply_count ?? 0,
    };
  }

  private toListItem(
    item: TopicDocument,
    mediaMap: Map<string, MediaSummary>,
    author?: UserSafeProfile,
    exposeDownloadUrl = true,
  ) {
    const imageAssets = this.mapImageAssets(item.images, mediaMap, 'compact');
    const viewCount = item.view_count ?? 0;
    const replyCount = item.reply_count ?? 0;
    const favorCount = item.favor_count ?? 0;

    return {
      id: item.id,
      topicId: item.topic_id,
      typeId: item.type_id,
      title: item.title,
      summary: item.desc,
      imageAssets,
      coverMedia: imageAssets[0],
      desc: item.desc,
      ...this.toDownloadUrlPayload(item.download_url, exposeDownloadUrl),
      userId: item.user_id.toString(),
      author: this.toAuthor(author),
      featureFlags: item.feature_flags ?? [],
      featureFlagLabels: this.buildFeatureFlagLabels(item.feature_flags),
      reviewStatus: item.review_status,
      visibility: item.visibility,
      viewCount,
      replyCount,
      favorCount,
      postTime: item.post_time,
      updateTime: item.update_time,
    };
  }

  private toPublicDetail(
    topic: TopicDocument,
    mediaMap: Map<string, MediaSummary>,
    author?: UserSafeProfile,
    exposeDownloadUrl = true,
  ) {
    return {
      ...this.toListItem(topic, mediaMap, author, exposeDownloadUrl),
      imageAssets: this.mapImageAssets(topic.images, mediaMap, 'full'),
      coverMedia: this.mapPrimaryImageAsset(topic.images, mediaMap, 'full'),
      content: topic.content,
    };
  }

  private toEditableDetail(topic: TopicDocument, mediaMap: Map<string, MediaSummary>) {
    return {
      ...this.toPublicDetail(topic, mediaMap, undefined, true),
      imageMediaIds: normalizeMediaReferenceIds(topic.images),
    };
  }

  private toDownloadUrlPayload(downloadUrl: string, exposeDownloadUrl: boolean) {
    if (!exposeDownloadUrl) {
      return {};
    }

    return {
      downloadUrl,
    };
  }

  private buildFeatureFlagLabels(featureFlags?: number[]) {
    return buildTopicFeatureFlagTags(featureFlags ?? []);
  }

  private normalizeFeatureFlags(featureFlags?: number[]) {
    return Array.from(
      new Set((featureFlags ?? []).filter((featureFlag) => Number.isInteger(featureFlag))),
    );
  }
}
