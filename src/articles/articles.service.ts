import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContentStatus } from '../common/enums/content-status.enum';
import { TargetType } from '../common/enums/target-type.enum';
import { ReviewStatus } from '../common/enums/review-status.enum';
import { Visibility } from '../common/enums/visibility.enum';
import { buildShanghaiDateRangeFilter } from '../common/utils/date-range.util';
import {
  normalizeMediaReferenceIds,
  pickFirstMediaReferenceId,
  type MediaReferenceInput,
} from '../common/utils/media-reference.util';
import { buildKeywordSearchFilter, buildKeywordSearchTerms } from '../common/utils/keyword-search.util';
import {
  mapPrimaryReferencedMediaAsset,
  mapReferencedMediaAssets,
  toCompactUserIdentity,
} from '../common/utils/content-presentation.util';
import { buildPublicArticleFilter } from '../common/utils/public-content-filter.util';
import { buildStartsWithRegex } from '../common/utils/regex.util';
import {
  type ResolvedMediaAssetMode,
  type ResolvedMediaAsset,
} from '../common/utils/media-summary.util';
import { MongoTransactionService } from '../infra/database/mongo-transaction.service';
import { ContentOperationLockService } from '../infra/redis/content-operation-lock.service';
import { MediaApplicationService, type MediaSummary } from '../media/application/media.application';
import { UsersService, type UserSafeProfile } from '../users/users.service';
import { WorkspaceRelationCleanupService } from '../workspace/workspace-relation-cleanup.service';
import { CreateArticleDto, UpdateArticleDto } from './dto/create-article.dto';
import { QueryArticlesDto, QueryMyArticlesDto } from './dto/query-articles.dto';
import { ArticlesRepository } from './repositories/articles.repository';
import type { ArticleDocument } from './schemas/article.schema';

export interface HomeArticleItem {
  id: string;
  title: string;
  summary: string;
  coverMedia?: ResolvedMediaAsset;
  themeId: number;
  viewCount: number;
  replyCount: number;
  postTime: Date;
}

@Injectable()
export class ArticlesService {
  constructor(
    private readonly articlesRepository: ArticlesRepository,
    private readonly mediaApplicationService: MediaApplicationService,
    private readonly mongoTransactionService: MongoTransactionService,
    private readonly contentOperationLockService: ContentOperationLockService,
    private readonly usersService: UsersService,
    private readonly workspaceRelationCleanupService: WorkspaceRelationCleanupService,
  ) {}

  async create(userId: string, dto: CreateArticleDto) {
    const imageMediaIds = normalizeMediaReferenceIds(dto.images ?? []);
    await this.mediaApplicationService.assertMediaIdsExist(imageMediaIds, 'image');

    const userObjectId = new Types.ObjectId(userId);
    const article = await this.articlesRepository.create({
      title: dto.title,
      desc: dto.desc,
      content: dto.content,
      images: imageMediaIds,
      theme_id: dto.themeId,
      search_terms: buildKeywordSearchTerms(dto.title, dto.desc),
      user_id: userObjectId,
      status: dto.status ?? ContentStatus.PUBLISHED,
      review_status: ReviewStatus.APPROVED,
      visibility: Visibility.PUBLIC,
      view_count: 0,
      favor_count: 0,
      reply_count: 0,
    });

    return this.toEditableDetail(article, await this.createMediaSummaryMap(normalizeMediaReferenceIds(article.images)));
  }

  async list(query: QueryArticlesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const condition: Record<string, unknown> = {
      ...buildPublicArticleFilter(),
    };

    if (typeof query.themeId === 'number') {
      condition.theme_id = query.themeId;
    }

    if (query.userId) {
      condition.user_id = new Types.ObjectId(query.userId);
    }
    Object.assign(condition, buildKeywordSearchFilter(query.keyword));

    const { items, total } = await this.articlesRepository.list(condition, page, limit, this.resolveListSort(query.sort));
    const mediaMap = await this.createMediaSummaryMap(
      items.flatMap((item) => normalizeMediaReferenceIds(item.images)),
    );
    const authorMap = query.includeAuthor
      ? await this.usersService.getSafeProfileMap(items.map((item) => item.user_id.toString()))
      : new Map<string, UserSafeProfile>();

    return {
      items: items.map((item) => this.toListItem(item, mediaMap, authorMap.get(item.user_id.toString()))),
      page,
      limit,
      total,
    };
  }

  async listHome(limit: number): Promise<HomeArticleItem[]> {
    const { items } = await this.articlesRepository.list(
      buildPublicArticleFilter(),
      1,
      limit,
      this.resolveListSort('recommend'),
    );
    const mediaMap = await this.createMediaSummaryMap(
      items
        .map((item) => pickFirstMediaReferenceId(item.images))
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    );

    return items.map((item) => this.toHomeItem(item, mediaMap));
  }

  async listMine(userId: string, query: QueryMyArticlesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const condition: Record<string, unknown> = {
      deleted_at: { $exists: false },
      user_id: new Types.ObjectId(userId),
    };

    if (query.status) {
      condition.status = query.status;
    }

    if (query.title) {
      condition.title = buildStartsWithRegex(query.title);
    }

    const postTimeRange = buildShanghaiDateRangeFilter(query.startDate, query.endDate);
    if (postTimeRange) {
      condition.post_time = postTimeRange;
    }

    const { items, total } = await this.articlesRepository.list(condition, page, limit);
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

  async detail(id: string) {
    const article = await this.articlesRepository.findOneAndIncrementViewCount({
      _id: id,
      ...buildPublicArticleFilter(),
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const [mediaMap, authorMap] = await Promise.all([
      this.createMediaSummaryMap(normalizeMediaReferenceIds(article.images)),
      this.usersService.getSafeProfileMap([article.user_id.toString()]),
    ]);

    return this.toPublicDetail(article, mediaMap, authorMap.get(article.user_id.toString()));
  }

  async detailMine(id: string, userId: string) {
    const article = await this.requireOwnedArticle(id, userId);

    return this.toEditableDetail(article, await this.createMediaSummaryMap(normalizeMediaReferenceIds(article.images)));
  }

  async update(id: string, userId: string, dto: UpdateArticleDto) {
    return this.contentOperationLockService.runWithContentLock(TargetType.ARTICLE, id, async () => {
      const article = await this.requireOwnedArticle(id, userId);

      const payload: Record<string, unknown> = {};
      if (typeof dto.title === 'string') payload.title = dto.title;
      if (typeof dto.desc === 'string') payload.desc = dto.desc;
      if (typeof dto.content === 'string') payload.content = dto.content;
      if (dto.images) {
        const imageMediaIds = normalizeMediaReferenceIds(dto.images);
        await this.mediaApplicationService.assertMediaIdsExist(imageMediaIds, 'image');
        payload.images = imageMediaIds;
      }
      if (typeof dto.themeId === 'number') payload.theme_id = dto.themeId;
      if (dto.status) payload.status = dto.status;
      payload.search_terms = buildKeywordSearchTerms(
        typeof dto.title === 'string' ? dto.title : article.title,
        typeof dto.desc === 'string' ? dto.desc : article.desc,
      );

      const updated = await this.articlesRepository.updateById(id, payload);
      if (!updated) {
        throw new NotFoundException('Article not found');
      }

      return this.toEditableDetail(updated, await this.createMediaSummaryMap(normalizeMediaReferenceIds(updated.images)));
    });
  }

  async deleteArticle(
    id: string,
    userId: string,
    options: {
      physicalDelete: boolean;
      cascadeMedia: boolean;
      traceId?: string;
    },
  ) {
    return this.contentOperationLockService.runWithContentLock(TargetType.ARTICLE, id, async () => {
      const article = await this.requireOwnedArticle(id, userId, true);

      if (options.cascadeMedia && !options.physicalDelete) {
        throw new BadRequestException('cascadeMedia requires physicalDelete=true');
      }

      if (!options.physicalDelete) {
        await this.mongoTransactionService.runInTransaction(async (session) => {
          await this.workspaceRelationCleanupService.cleanupHiddenTarget(TargetType.ARTICLE, id, userId, session);
          if (!article.deleted_at) {
            await this.articlesRepository.softDeleteById(id, new Date(), session);
          }
        });

        return {
          success: true,
          deleteMode: 'soft' as const,
        };
      }

      const linkedMediaIds = normalizeMediaReferenceIds(article.images);
      const result = await this.mongoTransactionService.runInTransaction(async (session) => {
        const deleted = await this.articlesRepository.deleteById(id, session);
        if (!deleted) {
          throw new NotFoundException('Article not found');
        }

        return this.workspaceRelationCleanupService.cleanupDeletedTarget(TargetType.ARTICLE, id, session);
      });

      let mediaCleanup: { deletedIds: string[]; skipped: Array<{ id: string; reason: string }> } | undefined;
      if (options.cascadeMedia) {
        mediaCleanup = await this.mediaApplicationService.deleteOwnedImagesIfUnreferenced(
          linkedMediaIds,
          userId,
          options.traceId,
        );
      }

      return {
        success: true,
        deleteMode: 'physical' as const,
        ...result,
        mediaCleanup,
      };
    });
  }

  private async requireOwnedArticle(id: string, userId: string, includeDeleted = false): Promise<ArticleDocument> {
    const article = await this.articlesRepository.findById(id);
    if (!article || (!includeDeleted && article.deleted_at)) {
      throw new NotFoundException('Article not found');
    }

    if (article.user_id.toString() !== userId) {
      throw new ForbiddenException('No permission to access this article');
    }

    return article;
  }

  private async createMediaSummaryMap(mediaIds: string[]) {
    return this.mediaApplicationService.getMediaSummaryMap(mediaIds);
  }

  private resolveListSort(sort: QueryArticlesDto['sort']): Record<string, 1 | -1> {
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

  private toHomeItem(
    item: ArticleDocument,
    mediaMap: Map<string, MediaSummary>,
  ): HomeArticleItem {
    return {
      id: item.id,
      title: item.title,
      summary: item.desc,
      coverMedia: this.mapPrimaryImageAsset(item.images, mediaMap, 'compact'),
      themeId: item.theme_id,
      viewCount: item.view_count ?? 0,
      replyCount: item.reply_count ?? 0,
      postTime: item.post_time,
    };
  }

  private toAuthor(author?: UserSafeProfile) {
    return toCompactUserIdentity(author);
  }

  private toListItem(
    item: ArticleDocument,
    mediaMap: Map<string, MediaSummary>,
    author?: UserSafeProfile,
  ) {
    const imageAssets = this.mapImageAssets(item.images, mediaMap, 'compact');
    const viewCount = item.view_count ?? 0;
    const favorCount = item.favor_count ?? 0;
    const replyCount = item.reply_count ?? 0;

    return {
      id: item.id,
      title: item.title,
      desc: item.desc,
      summary: item.desc,
      imageAssets,
      coverMedia: imageAssets[0],
      themeId: item.theme_id,
      userId: item.user_id.toString(),
      author: this.toAuthor(author),
      status: item.status,
      reviewStatus: item.review_status,
      visibility: item.visibility,
      viewCount,
      favorCount,
      replyCount,
      postTime: item.post_time,
      updateTime: item.update_time,
    };
  }

  private toPublicDetail(
    article: ArticleDocument,
    mediaMap: Map<string, MediaSummary>,
    author?: UserSafeProfile,
  ) {
    return {
      ...this.toListItem(article, mediaMap, author),
      imageAssets: this.mapImageAssets(article.images, mediaMap, 'full'),
      coverMedia: this.mapPrimaryImageAsset(article.images, mediaMap, 'full'),
      content: article.content,
    };
  }

  private toEditableDetail(
    article: ArticleDocument,
    mediaMap: Map<string, MediaSummary>,
  ) {
    return {
      ...this.toPublicDetail(article, mediaMap),
      imageMediaIds: normalizeMediaReferenceIds(article.images),
    };
  }
}

