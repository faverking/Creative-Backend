import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { type MediaVariant } from '../../common/constants/content-query.constants';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { TargetType } from '../../common/enums/target-type.enum';
import { Visibility } from '../../common/enums/visibility.enum';
import {
  mapReferencedMediaAssets,
  mapSingleReferencedMediaAsset,
  resolveImagePackageCoverMediaId,
  toCompactUserIdentity,
} from '../../common/utils/content-presentation.util';
import { buildShanghaiDateRangeFilter } from '../../common/utils/date-range.util';
import { buildKeywordSearchFilter, buildKeywordSearchTerms } from '../../common/utils/keyword-search.util';
import { buildStartsWithRegex } from '../../common/utils/regex.util';
import { buildApprovedPublicFilter } from '../../common/utils/public-content-filter.util';
import {
  collectMediaReferenceIds,
  extractMediaReferenceId,
  normalizeMediaReferenceIds,
  type MediaReferenceInput,
} from '../../common/utils/media-reference.util';
import { buildImagePackageMeta } from '../../common/utils/image-package-meta.util';
import { pickMediaPath, type ResolvedMediaAssetMode, type ResolvedMediaAsset } from '../../common/utils/media-summary.util';
import { AuditService } from '../../infra/audit/audit.service';
import { MongoTransactionService } from '../../infra/database/mongo-transaction.service';
import { ContentOperationLockService } from '../../infra/redis/content-operation-lock.service';
import {
  MediaApplicationService,
  type ImageMediaPresentation,
} from '../../media/application/media.application';
import { UsersService, type UserSafeProfile } from '../../users/users.service';
import { WorkspaceRelationCleanupService } from '../../workspace/workspace-relation-cleanup.service';
import {
  CreateImagePackageDto,
  QueryImagePackagesDto,
  QueryMyImagePackagesDto,
  UpdateImagePackageDto,
} from '../dto/image.dto';
import { ImagesRepository } from '../repositories/images.repository';
import type { ImagePackageDocument } from '../schemas/image.schema';

export interface HomeImageItem {
  id: string;
  title: string;
  meta: string;
  qualityLabel?: string;
  resolution?: string;
  images: Array<{
    previewPath: string;
    downloadPath: string;
  }>;
  total: number;
  viewCount: number;
  replyCount: number;
}

const HOME_GALLERY_PREVIEW_LIMIT = 4;

@Injectable()
export class ImagesApplicationService {
  constructor(
    private readonly imagesRepository: ImagesRepository,
    private readonly auditService: AuditService,
    private readonly mediaApplicationService: MediaApplicationService,
    private readonly mongoTransactionService: MongoTransactionService,
    private readonly contentOperationLockService: ContentOperationLockService,
    private readonly usersService: UsersService,
    private readonly workspaceRelationCleanupService: WorkspaceRelationCleanupService,
  ) {}

  async createImagePackage(
    dto: CreateImagePackageDto,
    operatorId: string,
    traceId?: string,
  ): Promise<unknown> {
    const imageMediaIds = normalizeMediaReferenceIds(dto.images);
    const coverMediaId = extractMediaReferenceId(dto.cover) ?? imageMediaIds[0];
    await this.assertImageReferences(imageMediaIds, coverMediaId);

    const created = await this.imagesRepository.create({
      title: dto.title,
      desc: dto.desc,
      images: imageMediaIds,
      search_terms: buildKeywordSearchTerms(dto.title, dto.desc),
      total: imageMediaIds.length,
      theme_id: (dto.themeId as 1 | 2 | 3 | 4) ?? 1,
      user_id: new Types.ObjectId(operatorId),
      view_count: 0,
      favor_count: 0,
      reply_count: 0,
      cover: coverMediaId,
      source: dto.source,
      review_status: ReviewStatus.APPROVED,
      visibility: Visibility.PUBLIC,
    });

    this.auditService.recordEventually({
      operatorId,
      action: 'image.create',
      resourceType: 'image',
      resourceId: created.id,
      traceId,
    });

    return this.toEditableDetail(
      created,
      await this.createImagePresentationMap(collectMediaReferenceIds(created.images, [created.cover])),
    );
  }

  async listImagePackages(query: QueryImagePackagesDto): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const mediaVariant = query.mediaVariant ?? 'download';

    const filter: Record<string, unknown> = {
      ...buildApprovedPublicFilter(),
    };
    if (typeof query.themeId === 'number') {
      filter.theme_id = query.themeId;
    }
    Object.assign(filter, buildKeywordSearchFilter(query.keyword));

    const { items, total } = await this.imagesRepository.list(filter, page, limit, this.resolveListSort(query.sort));
    const mediaMap = await this.createImagePresentationMap(
      items.flatMap((item) => collectMediaReferenceIds(item.images, [item.cover])),
    );
    return {
      items: items.map((item) => this.toListItem(item, mediaMap, mediaVariant)),
      page,
      limit,
      total,
    };
  }

  async listHome(limit: number): Promise<HomeImageItem[]> {
    const { items } = await this.imagesRepository.list(
      buildApprovedPublicFilter(),
      1,
      limit,
      this.resolveListSort('recommend'),
    );
    const mediaMap = await this.createImagePresentationMap(
      items.flatMap((item) =>
        collectMediaReferenceIds(normalizeMediaReferenceIds(item.images).slice(0, HOME_GALLERY_PREVIEW_LIMIT), [
          item.cover,
        ]),
      ),
    );

    return items.map((item) => this.toHomeItem(item, mediaMap));
  }

  async listMyImagePackages(userId: string, query: QueryMyImagePackagesDto): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const filter: Record<string, unknown> = {
      user_id: new Types.ObjectId(userId),
    };

    if (typeof query.themeId === 'number') {
      filter.theme_id = query.themeId;
    }
    if (query.title) {
      filter.title = buildStartsWithRegex(query.title);
    }

    const uploadTimeRange = buildShanghaiDateRangeFilter(query.startDate, query.endDate);
    if (uploadTimeRange) {
      filter.upload_time = uploadTimeRange;
    }

    const { items, total } = await this.imagesRepository.list(filter, page, limit);
    const mediaMap = await this.createImagePresentationMap(
      items.flatMap((item) => collectMediaReferenceIds(item.images, [item.cover])),
    );
    return {
      items: items.map((item) => this.toListItem(item, mediaMap)),
      page,
      limit,
      total,
    };
  }

  async getImagePackageDetail(id: string): Promise<unknown> {
    const imagePackage = await this.imagesRepository.findOneAndIncrementViewCount({
      _id: id,
      ...buildApprovedPublicFilter(),
    });
    if (!imagePackage) {
      throw new NotFoundException('Image package not found');
    }

    const [mediaMap, authorMap] = await Promise.all([
      this.createImagePresentationMap(collectMediaReferenceIds(imagePackage.images, [imagePackage.cover])),
      this.usersService.getSafeProfileMap([imagePackage.user_id.toString()]),
    ]);

    return this.toPublicDetail(imagePackage, mediaMap, 'download', authorMap.get(imagePackage.user_id.toString()));
  }

  async getMyImagePackageDetail(id: string, userId: string): Promise<unknown> {
    const imagePackage = await this.imagesRepository.findById(id);
    if (!imagePackage) {
      throw new NotFoundException('Image package not found');
    }

    if (imagePackage.user_id.toString() !== userId) {
      throw new ForbiddenException('No permission to access this image package');
    }

    return this.toEditableDetail(
      imagePackage,
      await this.createImagePresentationMap(collectMediaReferenceIds(imagePackage.images, [imagePackage.cover])),
    );
  }

  async updateImagePackage(
    id: string,
    userId: string,
    dto: UpdateImagePackageDto,
    traceId?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(TargetType.IMAGE, id, async () => {
      const imagePackage = await this.imagesRepository.findById(id);
      if (!imagePackage) {
        throw new NotFoundException('Image package not found');
      }

      if (imagePackage.user_id.toString() !== userId) {
        throw new ForbiddenException('No permission to update this image package');
      }

      const payload: Record<string, unknown> = {};
      let normalizedImages = normalizeMediaReferenceIds(imagePackage.images);
      let normalizedCover = extractMediaReferenceId(imagePackage.cover);

      if (typeof dto.title === 'string') payload.title = dto.title;
      if (typeof dto.desc === 'string') payload.desc = dto.desc;
      if (dto.images) {
        normalizedImages = normalizeMediaReferenceIds(dto.images);
        payload.images = normalizedImages;
        payload.total = normalizedImages.length;
        if (!dto.cover) {
          normalizedCover = normalizedImages[0];
          payload.cover = normalizedCover;
        }
      }
      if (typeof dto.themeId === 'number') payload.theme_id = dto.themeId;
      if (typeof dto.cover === 'string') {
        normalizedCover = extractMediaReferenceId(dto.cover);
        payload.cover = normalizedCover;
      }
      if (typeof dto.source === 'string') payload.source = dto.source;
      payload.search_terms = buildKeywordSearchTerms(
        typeof dto.title === 'string' ? dto.title : imagePackage.title,
        typeof dto.desc === 'string' ? dto.desc : imagePackage.desc,
      );

      await this.assertImageReferences(normalizedImages, normalizedCover);

      const updated = await this.imagesRepository.updateById(id, payload);
      if (!updated) {
        throw new NotFoundException('Image package not found');
      }

      this.auditService.recordEventually({
        operatorId: userId,
        action: 'image.update',
        resourceType: 'image',
        resourceId: id,
        traceId,
      });

      return this.toEditableDetail(
        updated,
        await this.createImagePresentationMap(collectMediaReferenceIds(updated.images, [updated.cover])),
      );
    });
  }

  async deleteImagePackage(
    id: string,
    userId: string,
    cascadeMedia = false,
    traceId?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(TargetType.IMAGE, id, async () => {
      const imagePackage = await this.imagesRepository.findById(id);
      if (!imagePackage) {
        throw new NotFoundException('Image package not found');
      }

      if (imagePackage.user_id.toString() !== userId) {
        throw new ForbiddenException('No permission to delete this image package');
      }

      const linkedMediaIds = collectMediaReferenceIds(imagePackage.images, [imagePackage.cover]);
      const result = await this.mongoTransactionService.runInTransaction(async (session) => {
        await this.imagesRepository.deleteById(id, session);
        return this.workspaceRelationCleanupService.cleanupDeletedTarget(TargetType.IMAGE, id, session);
      });

      let mediaCleanup: { deletedIds: string[]; skipped: Array<{ id: string; reason: string }> } | undefined;
      if (cascadeMedia) {
        mediaCleanup = await this.mediaApplicationService.deleteOwnedImagesIfUnreferenced(
          linkedMediaIds,
          userId,
          traceId,
        );
      }

      this.auditService.recordEventually({
        operatorId: userId,
        action: 'image.delete',
        resourceType: 'image',
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

  private resolveListSort(sort: QueryImagePackagesDto['sort']): Record<string, 1 | -1> {
    if (sort === 'hot') {
      return {
        favor_count: -1,
        reply_count: -1,
        view_count: -1,
        total: -1,
        upload_time: -1,
      };
    }

    if (sort === 'recommend') {
      return {
        favor_count: -1,
        reply_count: -1,
        view_count: -1,
        total: -1,
        upload_time: -1,
      };
    }

    return {
      upload_time: -1,
    };
  }

  private async assertImageReferences(imageMediaIds: string[], coverMediaId?: string) {
    if (imageMediaIds.length === 0) {
      throw new BadRequestException('Image package must contain at least one image');
    }

    if (!coverMediaId) {
      throw new BadRequestException('Image package cover is required');
    }

    const ids = Array.from(new Set([...imageMediaIds, coverMediaId]));
    await this.mediaApplicationService.assertMediaIdsExist(ids, 'image');
  }

  private async createImagePresentationMap(mediaIds: string[]) {
    return this.mediaApplicationService.getImagePresentationMap(mediaIds);
  }

  private mapImageAssets(
    mediaIds: MediaReferenceInput[],
    mediaMap: Map<string, ImageMediaPresentation>,
    mode: ResolvedMediaAssetMode = 'full',
  ): ResolvedMediaAsset[] {
    return mapReferencedMediaAssets(mediaIds, mediaMap, mode);
  }

  private mapSingleImageAsset(
    mediaId: MediaReferenceInput,
    mediaMap: Map<string, ImageMediaPresentation>,
    mode: ResolvedMediaAssetMode = 'full',
  ): ResolvedMediaAsset | undefined {
    return mapSingleReferencedMediaAsset(mediaId, mediaMap, mode);
  }

  private resolveCoverPresentation(
    item: Pick<ImagePackageDocument, 'cover' | 'images'>,
    mediaMap: Map<string, ImageMediaPresentation>,
  ): ImageMediaPresentation | undefined {
    const coverMediaId = resolveImagePackageCoverMediaId(item);
    return coverMediaId ? mediaMap.get(coverMediaId) : undefined;
  }

  private toHomeItem(
    item: ImagePackageDocument,
    mediaMap: Map<string, ImageMediaPresentation>,
  ): HomeImageItem {
    const images = mapReferencedMediaAssets(
      normalizeMediaReferenceIds(item.images).slice(0, HOME_GALLERY_PREVIEW_LIMIT),
      mediaMap,
      'compact',
    )
      .map((media) => ({
        previewPath: media.previewPath,
        downloadPath: media.downloadPath,
      }));
    const coverPresentation = this.resolveCoverPresentation(item, mediaMap);

    return {
      id: item.id,
      title: item.title,
      meta: buildImagePackageMeta(item.total, item.theme_id, item.source),
      qualityLabel: coverPresentation?.quality?.qualityLabel,
      resolution: coverPresentation?.quality?.resolution,
      images,
      total: item.total,
      viewCount: item.view_count ?? 0,
      replyCount: item.reply_count ?? 0,
    };
  }

  private toAuthor(author?: UserSafeProfile) {
    return toCompactUserIdentity(author);
  }

  private toListItem(
    item: ImagePackageDocument,
    mediaMap: Map<string, ImageMediaPresentation>,
    mediaVariant: MediaVariant = 'download',
    author?: UserSafeProfile,
  ) {
    const imageAssets = this.mapImageAssets(item.images, mediaMap, 'compact');
    const coverPresentation = this.resolveCoverPresentation(item, mediaMap);
    const coverMedia = this.mapSingleImageAsset(item.cover, mediaMap, 'compact') ?? imageAssets[0];
    const viewCount = item.view_count ?? 0;
    const favorCount = item.favor_count ?? 0;
    const replyCount = item.reply_count ?? 0;

    return {
      id: item.id,
      title: item.title,
      summary: item.desc,
      desc: item.desc,
      imageAssets,
      total: item.total,
      themeId: item.theme_id,
      viewCount,
      favorCount,
      replyCount,
      cover: pickMediaPath(coverMedia, mediaVariant),
      coverMedia,
      qualityLabel: coverPresentation?.quality?.qualityLabel,
      resolution: coverPresentation?.quality?.resolution,
      reviewStatus: item.review_status,
      visibility: item.visibility,
      author: this.toAuthor(author),
      meta: buildImagePackageMeta(item.total, item.theme_id, item.source),
      uploadTime: item.upload_time,
      userId: item.user_id.toString(),
    };
  }

  private toPublicDetail(
    imagePackage: ImagePackageDocument,
    mediaMap: Map<string, ImageMediaPresentation>,
    mediaVariant: MediaVariant = 'download',
    author?: UserSafeProfile,
  ) {
    const fullImageAssets = this.mapImageAssets(imagePackage.images, mediaMap, 'full');
    const fullCoverMedia = this.mapSingleImageAsset(imagePackage.cover, mediaMap, 'full') ?? fullImageAssets[0];
    return {
      ...this.toListItem(imagePackage, mediaMap, mediaVariant, author),
      imageAssets: fullImageAssets,
      coverMedia: fullCoverMedia,
      cover: pickMediaPath(fullCoverMedia, mediaVariant),
      source: imagePackage.source,
    };
  }

  private toEditableDetail(
    imagePackage: ImagePackageDocument,
    mediaMap: Map<string, ImageMediaPresentation>,
    mediaVariant: MediaVariant = 'download',
  ) {
    return {
      ...this.toPublicDetail(imagePackage, mediaMap, mediaVariant),
      imageMediaIds: normalizeMediaReferenceIds(imagePackage.images),
      coverMediaId: extractMediaReferenceId(imagePackage.cover),
    };
  }
}






