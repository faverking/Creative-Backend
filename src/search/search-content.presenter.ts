import { Injectable } from '@nestjs/common';
import type { ArticleDocument } from '../articles/schemas/article.schema';
import type { BookDetailDocument } from '../books/schemas/book.schema';
import {
  ADMIN_FEATURED_SCORE_BASE,
  FEATURED_RECOMMEND_LABELS,
} from '../common/constants/featured-content.constants';
import {
  buildArticleBusinessTags,
  buildBookCompositeTags,
  buildImageBusinessTags,
  buildTopicCompositeTags,
  readBusinessLabel,
} from '../common/utils/content-tag.util';
import {
  mapPrimaryReferencedMediaAsset,
  mapSingleReferencedMediaAsset,
  resolveImagePackageCoverMediaId,
  toCompactUserIdentity,
} from '../common/utils/content-presentation.util';
import { toCoverView } from '../common/utils/cover-view.util';
import { pickFirstMediaReferenceId } from '../common/utils/media-reference.util';
import type { ResolvedMediaAsset } from '../common/utils/media-summary.util';
import { TargetType } from '../common/enums/target-type.enum';
import { FEATURED_CONTENT_TYPES, type FeaturedContentType } from './dto/search.dto';
import type { ImagePackageDocument } from '../images/schemas/image.schema';
import type { MediaSummary } from '../media/application/media.application';
import type {
  FeaturedCandidate,
  FeaturedCardAuthor,
  FeaturedCardItem,
  FeaturedCardStats,
  FeaturedEditorialEntry,
  FeaturedSourceCounts,
  FeaturedTypeCounts,
  RelatedContentItem,
  SearchFeaturedPayload,
} from './search.types';
import type { TopicDocument } from '../topics/schemas/topic.schema';
import type { UserSafeProfile } from '../users/users.service';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SearchContentPresenter {
  toFeaturedCardItem(type: FeaturedContentType, item: SearchFeaturedPayload): FeaturedCardItem {
    const badge = this.resolveFeaturedBadge(type);
    const author = item.author as FeaturedCardAuthor | undefined;
    const stats = item.stats as FeaturedCardStats | undefined;
    const coverMedia = item.coverMedia as ResolvedMediaAsset | undefined;
    const publishTime = item.publishTime instanceof Date ? item.publishTime : new Date(String(item.publishTime ?? ''));
    const recommendSource = item.recommendSource === 'admin' ? 'admin' : 'hot';
    const featuredRank = this.toOptionalNumber(item.featuredRank);
    const heatScore = typeof item.heatScore === 'number' ? item.heatScore : undefined;

    return {
      id: String(item.id ?? ''),
      type,
      businessLabel: this.resolveBusinessLabel(type),
      title: String(item.title ?? ''),
      summary: String(item.summary ?? ''),
      cover: toCoverView(coverMedia),
      badge,
      kicker: author?.name ?? badge,
      tags: this.resolveFeaturedTags(type, item),
      author,
      stats: stats ?? {
        viewCount: 0,
        favorCount: 0,
        replyCount: 0,
      },
      recommendSource,
      recommendLabel: String(item.recommendLabel ?? FEATURED_RECOMMEND_LABELS[recommendSource]),
      featuredRank,
      heatScore,
      publishTime: publishTime.toISOString(),
    };
  }

  toRelatedContentItem(type: FeaturedContentType, item: SearchFeaturedPayload): RelatedContentItem {
    const author = item.author as FeaturedCardAuthor | undefined;
    const stats = item.stats as FeaturedCardStats | undefined;
    const coverMedia = item.coverMedia as ResolvedMediaAsset | undefined;
    const publishTime = item.publishTime instanceof Date ? item.publishTime : new Date(String(item.publishTime ?? ''));

    return {
      id: String(item.id ?? ''),
      type,
      businessLabel: this.resolveBusinessLabel(type),
      title: String(item.title ?? ''),
      summary: String(item.summary ?? ''),
      cover: toCoverView(coverMedia),
      tags: this.resolveFeaturedTags(type, item),
      author,
      viewCount: stats?.viewCount ?? 0,
      favorCount: stats?.favorCount ?? 0,
      replyCount: stats?.replyCount ?? 0,
      publishTime: publishTime.toISOString(),
    };
  }

  withHotRecommendation(candidate: FeaturedCandidate): FeaturedCandidate {
    return {
      ...candidate,
      item: {
        ...candidate.item,
        recommendSource: 'hot',
        recommendLabel: FEATURED_RECOMMEND_LABELS.hot,
        heatScore: Number(candidate.score.toFixed(2)),
      },
    };
  }

  withAdminRecommendation(candidate: FeaturedCandidate, rank: number): FeaturedCandidate {
    return {
      ...candidate,
      score: ADMIN_FEATURED_SCORE_BASE - rank,
      item: {
        ...candidate.item,
        recommendSource: 'admin',
        recommendLabel: FEATURED_RECOMMEND_LABELS.admin,
        featuredRank: rank,
        heatScore: Number(candidate.score.toFixed(2)),
      },
    };
  }

  toEditorialCandidate(
    entry: FeaturedEditorialEntry,
    mediaMap: Map<string, MediaSummary>,
    authorMap: Map<string, UserSafeProfile>,
    now: Date,
  ): FeaturedCandidate {
    if (entry.type === 'article') {
      const document = entry.document as ArticleDocument;
      return this.withAdminRecommendation(
        this.toFeaturedArticle(document, mediaMap, authorMap.get(document.user_id.toString()), now),
        entry.config.rank,
      );
    }

    if (entry.type === 'book') {
      const document = entry.document as BookDetailDocument;
      return this.withAdminRecommendation(
        this.toFeaturedBook(document, mediaMap, authorMap.get(document.user_id.toString()), now),
        entry.config.rank,
      );
    }

    if (entry.type === 'image') {
      const document = entry.document as ImagePackageDocument;
      return this.withAdminRecommendation(
        this.toFeaturedImage(document, mediaMap, authorMap.get(document.user_id.toString()), now),
        entry.config.rank,
      );
    }

    const document = entry.document as TopicDocument;
    return this.withAdminRecommendation(
      this.toFeaturedTopic(document, mediaMap, authorMap.get(document.user_id.toString()), now),
      entry.config.rank,
    );
  }

  toFeaturedArticle(
    item: ArticleDocument,
    mediaMap: Map<string, MediaSummary>,
    author: UserSafeProfile | undefined,
    now: Date,
  ): FeaturedCandidate {
    const coverMedia = this.mapPrimaryImageAsset(item.images, mediaMap);
    const viewCount = item.view_count ?? 0;
    const favorCount = item.favor_count ?? 0;
    const replyCount = item.reply_count ?? 0;

    return {
      type: 'article',
      score: this.scoreByFreshness(
        item.post_time,
        now,
        viewCount + favorCount * 8 + replyCount * 6,
        30,
        40,
      ),
      sortTime: item.post_time,
      userId: item.user_id.toString(),
      item: {
        id: item.id,
        title: item.title,
        summary: item.desc,
        coverMedia,
        themeId: item.theme_id,
        author: toCompactUserIdentity(author),
        stats: {
          viewCount,
          favorCount,
          replyCount,
        },
        publishTime: item.post_time,
      },
    };
  }

  toFeaturedBook(
    item: BookDetailDocument,
    mediaMap: Map<string, MediaSummary>,
    author: UserSafeProfile | undefined,
    now: Date,
  ): FeaturedCandidate {
    const coverMedia = this.mapSingleImageAsset(item.cover, mediaMap);
    const viewCount = item.view_count ?? 0;
    const favorCount = item.favor_count ?? 0;
    const replyCount = item.reply_count ?? 0;

    return {
      type: 'book',
      score: this.scoreByFreshness(
        item.update_time,
        now,
        viewCount + favorCount * 8 + replyCount * 6 + item.total * 2,
        45,
        35,
      ),
      sortTime: item.update_time,
      userId: item.user_id.toString(),
      item: {
        id: item.id,
        title: item.name,
        summary: item.desc,
        author: toCompactUserIdentity(author),
        part: item.part,
        area: item.area,
        style: item.style,
        coverMedia,
        stats: {
          viewCount,
          favorCount,
          replyCount,
        },
        publishTime: item.update_time,
      },
    };
  }

  toFeaturedImage(
    item: ImagePackageDocument,
    mediaMap: Map<string, MediaSummary>,
    author: UserSafeProfile | undefined,
    now: Date,
  ): FeaturedCandidate {
    const coverMedia =
      this.mapSingleImageAsset(this.resolveImageCoverMediaId(item), mediaMap) ??
      this.mapPrimaryImageAsset(item.images, mediaMap);
    const viewCount = item.view_count ?? 0;
    const favorCount = item.favor_count ?? 0;
    const replyCount = item.reply_count ?? 0;

    return {
      type: 'image',
      score: this.scoreByFreshness(
        item.upload_time,
        now,
        viewCount + favorCount * 8 + replyCount * 6 + item.total * 2,
        21,
        45,
      ),
      sortTime: item.upload_time,
      userId: item.user_id.toString(),
      item: {
        id: item.id,
        title: item.title,
        summary: item.desc,
        author: toCompactUserIdentity(author),
        coverMedia,
        themeId: item.theme_id,
        stats: {
          viewCount,
          favorCount,
          replyCount,
        },
        publishTime: item.upload_time,
      },
    };
  }

  toFeaturedTopic(
    item: TopicDocument,
    mediaMap: Map<string, MediaSummary>,
    author: UserSafeProfile | undefined,
    now: Date,
  ): FeaturedCandidate {
    const coverMedia = this.mapPrimaryImageAsset(item.images, mediaMap);
    const viewCount = item.view_count ?? 0;
    const favorCount = item.favor_count ?? 0;
    const replyCount = item.reply_count ?? 0;

    return {
      type: 'topic',
      score: this.scoreByFreshness(
        item.post_time,
        now,
        viewCount + favorCount * 8 + replyCount * 6,
        30,
        40,
      ),
      sortTime: item.post_time,
      userId: item.user_id.toString(),
      item: {
        id: item.id,
        title: item.title,
        summary: item.desc,
        coverMedia,
        topicId: item.topic_id,
        typeId: item.type_id,
        featureFlags: item.feature_flags ?? [],
        author: toCompactUserIdentity(author),
        stats: {
          viewCount,
          favorCount,
          replyCount,
        },
        publishTime: item.post_time,
      },
    };
  }

  groupFeaturedCandidates(
    candidates: FeaturedCandidate[],
    perTypeLimit: number,
  ): Map<FeaturedContentType, FeaturedCandidate[]> {
    const grouped = new Map<FeaturedContentType, FeaturedCandidate[]>();
    for (const type of FEATURED_CONTENT_TYPES) {
      grouped.set(type, []);
    }

    for (const candidate of candidates) {
      const items = grouped.get(candidate.type);
      if (!items || items.length >= perTypeLimit) {
        continue;
      }

      items.push(candidate);
    }

    return grouped;
  }

  flattenGroupedFeaturedCandidates(
    candidates: FeaturedCandidate[],
    grouped: Map<FeaturedContentType, FeaturedCandidate[]>,
  ): FeaturedCandidate[] {
    const selectedKeys = new Set(
      Array.from(grouped.values()).flatMap((items) => items.map((item) => this.toFeaturedCandidateKey(item))),
    );

    return candidates.filter((candidate) => selectedKeys.has(this.toFeaturedCandidateKey(candidate)));
  }

  buildFeaturedGroups(grouped?: Map<FeaturedContentType, FeaturedCandidate[]>) {
    const groups = grouped ?? new Map<FeaturedContentType, FeaturedCandidate[]>();

    return {
      articles: (groups.get('article') ?? []).map((item) => this.toFeaturedCardItem(item.type, item.item)),
      topics: (groups.get('topic') ?? []).map((item) => this.toFeaturedCardItem(item.type, item.item)),
      books: (groups.get('book') ?? []).map((item) => this.toFeaturedCardItem(item.type, item.item)),
      images: (groups.get('image') ?? []).map((item) => this.toFeaturedCardItem(item.type, item.item)),
    };
  }

  countFeaturedTypes(candidates: FeaturedCandidate[]): FeaturedTypeCounts {
    return candidates.reduce(
      (accumulator, candidate) => {
        if (candidate.type === 'article') accumulator.articles += 1;
        if (candidate.type === 'book') accumulator.books += 1;
        if (candidate.type === 'image') accumulator.images += 1;
        if (candidate.type === 'topic') accumulator.topics += 1;
        return accumulator;
      },
      {
        articles: 0,
        books: 0,
        images: 0,
        topics: 0,
      },
    );
  }

  countFeaturedSources(candidates: FeaturedCandidate[]): FeaturedSourceCounts {
    return candidates.reduce(
      (accumulator, candidate) => {
        const source = candidate.item.recommendSource;
        if (source === 'admin') accumulator.admin += 1;
        if (source === 'hot') accumulator.hot += 1;
        return accumulator;
      },
      {
        admin: 0,
        hot: 0,
      },
    );
  }

  dedupeFeaturedCandidates(candidates: FeaturedCandidate[]): FeaturedCandidate[] {
    const itemsByKey = new Map<string, FeaturedCandidate>();

    for (const candidate of candidates) {
      const key = this.toFeaturedCandidateKey(candidate);
      if (!itemsByKey.has(key)) {
        itemsByKey.set(key, candidate);
      }
    }

    return Array.from(itemsByKey.values());
  }

  resolveArticleCoverMediaId(item: ArticleDocument): string | undefined {
    return pickFirstMediaReferenceId(item.images);
  }

  resolveTopicCoverMediaId(item: TopicDocument): string | undefined {
    return pickFirstMediaReferenceId(item.images);
  }

  resolveImageCoverMediaId(item: ImagePackageDocument): string | undefined {
    return resolveImagePackageCoverMediaId(item);
  }

  scoreByFreshness(
    date: Date,
    now: Date,
    engagementScore: number,
    freshnessDays: number,
    freshnessMax: number,
  ): number {
    const ageInDays = Math.max(0, (now.getTime() - date.getTime()) / DAY_IN_MS);
    const freshnessScore = Math.max(0, freshnessMax * (1 - ageInDays / freshnessDays));
    return engagementScore + freshnessScore;
  }

  private mapPrimaryImageAsset(
    mediaIds: string[],
    mediaMap: Map<string, MediaSummary>,
  ): ResolvedMediaAsset | undefined {
    return mapPrimaryReferencedMediaAsset(mediaIds, mediaMap, 'compact');
  }

  private mapSingleImageAsset(
    mediaId: string | undefined,
    mediaMap: Map<string, MediaSummary>,
  ): ResolvedMediaAsset | undefined {
    return mapSingleReferencedMediaAsset(mediaId, mediaMap, 'compact');
  }

  private resolveFeaturedBadge(type: FeaturedContentType): string {
    if (type === 'article') return 'ARTICLE';
    if (type === 'topic') return 'COLUMN';
    if (type === 'book') return 'BOOK';
    return 'GALLERY';
  }

  private resolveBusinessLabel(type: FeaturedContentType): string {
    if (type === 'article') return readBusinessLabel(TargetType.ARTICLE);
    if (type === 'topic') return readBusinessLabel(TargetType.TOPIC);
    if (type === 'book') return readBusinessLabel(TargetType.BOOK);
    return readBusinessLabel(TargetType.IMAGE);
  }

  private resolveFeaturedTags(type: FeaturedContentType, item: SearchFeaturedPayload): string[] {
    if (type === 'article') {
      return buildArticleBusinessTags(this.toOptionalNumber(item.themeId));
    }

    if (type === 'book') {
      return buildBookCompositeTags(
        this.toOptionalNumber(item.part),
        this.toOptionalNumber(item.area),
        this.toBookStyles(item.style),
        4,
      );
    }

    if (type === 'topic') {
      return buildTopicCompositeTags(
        this.toOptionalNumber(item.topicId),
        this.toOptionalNumber(item.typeId),
        this.toTopicFeatureFlags(item.featureFlags),
        6,
      );
    }

    return buildImageBusinessTags(this.toOptionalNumber(item.themeId));
  }

  private toOptionalNumber(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
  }

  private toBookStyles(value: unknown): Array<{ id?: number }> | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value
      .filter((item): item is { id?: number } => typeof item === 'object' && item !== null)
      .map((item) => ({ id: typeof item.id === 'number' ? item.id : undefined }));
  }

  private toTopicFeatureFlags(value: unknown): number[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.filter((item): item is number => typeof item === 'number');
  }

  private toFeaturedCandidateKey(candidate: FeaturedCandidate): string {
    return `${candidate.type}:${String(candidate.item.id ?? '')}`;
  }
}
