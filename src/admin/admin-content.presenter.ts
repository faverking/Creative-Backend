import { Injectable } from '@nestjs/common';
import type { ArticleDocument } from '../articles/schemas/article.schema';
import { type BookChapterDocument, type BookDetailDocument } from '../books/schemas/book.schema';
import {
  buildArticleBusinessTags,
  buildBookCompositeTags,
  buildImageBusinessTags,
  buildTopicCompositeTags,
  buildTopicFeatureFlagTags,
  readBusinessLabel,
} from '../common/utils/content-tag.util';
import {
  mapPrimaryReferencedMediaAsset,
  mapReferencedMediaAssets,
  mapSingleReferencedMediaAsset,
  resolveImagePackageCoverMediaId,
  toCompactUserIdentity,
} from '../common/utils/content-presentation.util';
import { toCoverView } from '../common/utils/cover-view.util';
import { buildImagePackageMeta } from '../common/utils/image-package-meta.util';
import { extractMediaReferenceId, normalizeMediaReferenceIds } from '../common/utils/media-reference.util';
import { type ResolvedMediaAssetMode } from '../common/utils/media-summary.util';
import { TargetType } from '../common/enums/target-type.enum';
import type { FeaturedContentAdminItem } from '../featured-contents/featured-contents.service';
import type { ImagePackageDocument } from '../images/schemas/image.schema';
import type { ImageMediaPresentation, MediaSummary } from '../media/application/media.application';
import type { TopicDocument } from '../topics/schemas/topic.schema';
import type { UserSafeProfile } from '../users/users.service';

@Injectable()
export class AdminContentPresenter {
  toArticleListItem(
    article: ArticleDocument,
    mediaMap: Map<string, MediaSummary>,
    owner?: UserSafeProfile,
    featuredConfig?: FeaturedContentAdminItem,
    mode: ResolvedMediaAssetMode = 'compact',
  ) {
    const coverMedia = mapPrimaryReferencedMediaAsset(article.images, mediaMap, mode);

    return {
      id: article.id,
      type: TargetType.ARTICLE,
      businessLabel: readBusinessLabel(TargetType.ARTICLE),
      title: article.title,
      summary: article.desc,
      cover: toCoverView(coverMedia),
      owner: toCompactUserIdentity(owner),
      tags: buildArticleBusinessTags(article.theme_id),
      viewCount: article.view_count ?? 0,
      favorCount: article.favor_count ?? 0,
      replyCount: article.reply_count ?? 0,
      reviewStatus: article.review_status,
      visibility: article.visibility,
      featured: Boolean(featuredConfig),
      featuredConfig,
      themeId: article.theme_id,
      status: article.status,
      deleted: Boolean(article.deleted_at),
      deletedAt: article.deleted_at,
      createTime: article.post_time,
      updateTime: article.update_time,
    };
  }

  toBookListItem(
    book: BookDetailDocument,
    mediaMap: Map<string, MediaSummary>,
    owner?: UserSafeProfile,
    featuredConfig?: FeaturedContentAdminItem,
    mode: ResolvedMediaAssetMode = 'compact',
  ) {
    const coverMedia = mapSingleReferencedMediaAsset(book.cover, mediaMap, mode);

    return {
      id: book.id,
      type: TargetType.BOOK,
      businessLabel: readBusinessLabel(TargetType.BOOK),
      title: book.name,
      summary: book.desc,
      cover: toCoverView(coverMedia),
      owner: toCompactUserIdentity(owner),
      tags: buildBookCompositeTags(book.part, book.area, book.style, 4),
      viewCount: book.view_count ?? 0,
      favorCount: book.favor_count ?? 0,
      replyCount: book.reply_count ?? 0,
      reviewStatus: book.review_status,
      visibility: book.visibility,
      featured: Boolean(featuredConfig),
      featuredConfig,
      part: book.part,
      area: book.area,
      status: book.status,
      total: book.total,
      authorNames: book.author,
      createTime: book.create_time,
      updateTime: book.update_time,
    };
  }

  toTopicListItem(
    topic: TopicDocument,
    mediaMap: Map<string, MediaSummary>,
    owner?: UserSafeProfile,
    featuredConfig?: FeaturedContentAdminItem,
    mode: ResolvedMediaAssetMode = 'compact',
  ) {
    const coverMedia = mapPrimaryReferencedMediaAsset(topic.images, mediaMap, mode);

    return {
      id: topic.id,
      type: TargetType.TOPIC,
      businessLabel: readBusinessLabel(TargetType.TOPIC),
      title: topic.title,
      summary: topic.desc,
      cover: toCoverView(coverMedia),
      owner: toCompactUserIdentity(owner),
      tags: buildTopicCompositeTags(topic.topic_id, topic.type_id, topic.feature_flags, 6),
      viewCount: topic.view_count ?? 0,
      favorCount: topic.favor_count ?? 0,
      replyCount: topic.reply_count ?? 0,
      reviewStatus: topic.review_status,
      visibility: topic.visibility,
      featured: Boolean(featuredConfig),
      featuredConfig,
      topicId: topic.topic_id,
      typeId: topic.type_id,
      featureFlags: topic.feature_flags ?? [],
      featureFlagLabels: buildTopicFeatureFlagTags(topic.feature_flags),
      createTime: topic.post_time,
      updateTime: topic.update_time,
    };
  }

  toImageListItem(
    imagePackage: ImagePackageDocument,
    mediaMap: Map<string, ImageMediaPresentation>,
    owner?: UserSafeProfile,
    featuredConfig?: FeaturedContentAdminItem,
    mode: ResolvedMediaAssetMode = 'compact',
  ) {
    const coverMediaId = resolveImagePackageCoverMediaId(imagePackage);
    const coverPresentation = coverMediaId ? mediaMap.get(coverMediaId) : undefined;

    return {
      id: imagePackage.id,
      type: TargetType.IMAGE,
      businessLabel: readBusinessLabel(TargetType.IMAGE),
      title: imagePackage.title,
      summary: imagePackage.desc,
      cover: toCoverView(mapSingleReferencedMediaAsset(coverMediaId, mediaMap, mode)),
      owner: toCompactUserIdentity(owner),
      tags: buildImageBusinessTags(imagePackage.theme_id),
      viewCount: imagePackage.view_count ?? 0,
      favorCount: imagePackage.favor_count ?? 0,
      replyCount: imagePackage.reply_count ?? 0,
      reviewStatus: imagePackage.review_status,
      visibility: imagePackage.visibility,
      featured: Boolean(featuredConfig),
      featuredConfig,
      themeId: imagePackage.theme_id,
      total: imagePackage.total,
      source: imagePackage.source,
      meta: buildImagePackageMeta(imagePackage.total, imagePackage.theme_id, imagePackage.source),
      qualityLabel: coverPresentation?.quality?.qualityLabel,
      resolution: coverPresentation?.quality?.resolution,
      createTime: imagePackage.upload_time,
      updateTime: imagePackage.upload_time,
    };
  }

  toArticleDetail(
    article: ArticleDocument,
    mediaMap: Map<string, MediaSummary>,
    owner?: UserSafeProfile,
    featuredConfig?: FeaturedContentAdminItem,
    imageMediaIds = normalizeMediaReferenceIds(article.images),
  ) {
    return {
      ...this.toArticleListItem(article, mediaMap, owner, featuredConfig, 'full'),
      content: article.content,
      imageMediaIds,
      imageAssets: mapReferencedMediaAssets(imageMediaIds, mediaMap, 'full'),
    };
  }

  toBookDetail(
    book: BookDetailDocument,
    mediaMap: Map<string, MediaSummary>,
    owner?: UserSafeProfile,
    featuredConfig?: FeaturedContentAdminItem,
    chapter?: BookChapterDocument | null,
  ) {
    return {
      ...this.toBookListItem(book, mediaMap, owner, featuredConfig, 'full'),
      coverMediaId: book.cover,
      style: book.style,
      chapterList: chapter?.chapter_list ?? [],
      origin: chapter?.origin,
      comicId: chapter?.comic_id ?? '',
      novelId: chapter?.novel_id ?? '',
      otherId: chapter?.other_id ?? '',
    };
  }

  toTopicDetail(
    topic: TopicDocument,
    mediaMap: Map<string, MediaSummary>,
    owner?: UserSafeProfile,
    featuredConfig?: FeaturedContentAdminItem,
    imageMediaIds = normalizeMediaReferenceIds(topic.images),
  ) {
    return {
      ...this.toTopicListItem(topic, mediaMap, owner, featuredConfig, 'full'),
      content: topic.content,
      imageMediaIds,
      imageAssets: mapReferencedMediaAssets(imageMediaIds, mediaMap, 'full'),
    };
  }

  toImageDetail(
    imagePackage: ImagePackageDocument,
    mediaMap: Map<string, ImageMediaPresentation>,
    owner?: UserSafeProfile,
    featuredConfig?: FeaturedContentAdminItem,
    imageMediaIds = normalizeMediaReferenceIds(imagePackage.images),
  ) {
    return {
      ...this.toImageListItem(imagePackage, mediaMap, owner, featuredConfig, 'full'),
      source: imagePackage.source,
      imageMediaIds,
      coverMediaId: extractMediaReferenceId(imagePackage.cover),
      imageAssets: mapReferencedMediaAssets(imageMediaIds, mediaMap, 'full'),
    };
  }
}
