import { Injectable } from '@nestjs/common';
import type { ArticleDocument } from '../articles/schemas/article.schema';
import type { BookDetailDocument } from '../books/schemas/book.schema';
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
  mapSingleReferencedMediaAsset,
  resolveImagePackageCoverMediaId,
  toCompactUserIdentity,
} from '../common/utils/content-presentation.util';
import { buildImagePackageMeta } from '../common/utils/image-package-meta.util';
import type { ResolvedMediaAsset } from '../common/utils/media-summary.util';
import { TargetType } from '../common/enums/target-type.enum';
import type { ImagePackageDocument } from '../images/schemas/image.schema';
import type { ImageMediaPresentation, MediaSummary } from '../media/application/media.application';
import type { TopicDocument } from '../topics/schemas/topic.schema';
import type { UserSafeProfile } from '../users/users.service';
import type { WorkspaceContentSummary } from './workspace-content.service';

@Injectable()
export class WorkspaceContentPresenter {
  toArticleSummary(
    item: ArticleDocument,
    mediaMap: Map<string, MediaSummary>,
    authorMap: Map<string, UserSafeProfile>,
  ): WorkspaceContentSummary {
    return {
      targetType: TargetType.ARTICLE,
      businessLabel: readBusinessLabel(TargetType.ARTICLE),
      targetId: item.id,
      title: item.title,
      summary: item.desc,
      coverMedia: mapPrimaryReferencedMediaAsset(item.images, mediaMap, 'compact'),
      meta: {
        viewCount: item.view_count ?? 0,
        favorCount: item.favor_count ?? 0,
        replyCount: item.reply_count ?? 0,
        publishTime: item.post_time,
        themeId: item.theme_id,
      },
      tags: buildArticleBusinessTags(item.theme_id),
      author: toCompactUserIdentity(authorMap.get(item.user_id.toString())),
    };
  }

  toBookSummary(item: BookDetailDocument, mediaMap: Map<string, MediaSummary>): WorkspaceContentSummary {
    return {
      targetType: TargetType.BOOK,
      businessLabel: readBusinessLabel(TargetType.BOOK),
      targetId: item.id,
      title: item.name,
      summary: item.desc,
      coverMedia: mapSingleReferencedMediaAsset(item.cover, mediaMap, 'compact'),
      meta: {
        viewCount: item.view_count ?? 0,
        favorCount: item.favor_count ?? 0,
        replyCount: item.reply_count ?? 0,
        updateTime: item.update_time,
        releaseTime: item.release_time,
        part: item.part,
        area: item.area,
        total: item.total,
        authorNames: item.author,
      },
      tags: this.buildBookTags(item),
    };
  }

  toTopicSummary(
    item: TopicDocument,
    mediaMap: Map<string, MediaSummary>,
    authorMap: Map<string, UserSafeProfile>,
  ): WorkspaceContentSummary {
    return {
      targetType: TargetType.TOPIC,
      businessLabel: readBusinessLabel(TargetType.TOPIC),
      targetId: item.id,
      title: item.title,
      summary: item.desc,
      coverMedia: mapPrimaryReferencedMediaAsset(item.images, mediaMap, 'compact'),
      meta: {
        viewCount: item.view_count ?? 0,
        favorCount: item.favor_count ?? 0,
        replyCount: item.reply_count ?? 0,
        publishTime: item.post_time,
        topicId: item.topic_id,
        typeId: item.type_id,
        featureFlags: item.feature_flags ?? [],
        featureFlagLabels: buildTopicFeatureFlagTags(item.feature_flags),
      },
      tags: buildTopicCompositeTags(item.topic_id, item.type_id, item.feature_flags, 6),
      author: toCompactUserIdentity(authorMap.get(item.user_id.toString())),
    };
  }

  toImageSummary(
    item: ImagePackageDocument,
    mediaMap: Map<string, ImageMediaPresentation>,
    authorMap: Map<string, UserSafeProfile>,
  ): WorkspaceContentSummary {
    const coverMediaId = resolveImagePackageCoverMediaId(item);
    const coverPresentation = coverMediaId ? mediaMap.get(coverMediaId) : undefined;

    return {
      targetType: TargetType.IMAGE,
      businessLabel: readBusinessLabel(TargetType.IMAGE),
      targetId: item.id,
      title: item.title,
      summary: item.desc,
      coverMedia:
        mapSingleReferencedMediaAsset(item.cover, mediaMap, 'compact') ??
        mapPrimaryReferencedMediaAsset(item.images, mediaMap, 'compact'),
      meta: {
        viewCount: item.view_count ?? 0,
        favorCount: item.favor_count ?? 0,
        replyCount: item.reply_count ?? 0,
        uploadTime: item.upload_time,
        total: item.total,
        themeId: item.theme_id,
        source: item.source,
        qualityLabel: coverPresentation?.quality?.qualityLabel,
        resolution: coverPresentation?.quality?.resolution,
        packageMeta: buildImagePackageMeta(item.total, item.theme_id, item.source),
      },
      tags: buildImageBusinessTags(item.theme_id),
      author: toCompactUserIdentity(authorMap.get(item.user_id.toString())),
    };
  }

  private buildBookTags(item: BookDetailDocument): string[] {
    return buildBookCompositeTags(item.part, item.area, item.style, 4);
  }
}
