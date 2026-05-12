import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Article, type ArticleDocument } from '../articles/schemas/article.schema';
import { BookDetail, type BookDetailDocument } from '../books/schemas/book.schema';
import { TargetType } from '../common/enums/target-type.enum';
import { buildApprovedPublicFilter, buildPublicArticleFilter } from '../common/utils/public-content-filter.util';
import { ImagePackage, type ImagePackageDocument } from '../images/schemas/image.schema';
import { MediaApplicationService, type MediaSummary } from '../media/application/media.application';
import { Topic, type TopicDocument } from '../topics/schemas/topic.schema';
import { UsersService } from '../users/users.service';
import { SearchContentPresenter } from './search-content.presenter';
import { RelatedQueryDto } from './dto/search.dto';

const RELATED_CANDIDATE_MULTIPLIER = 6;
const RELATED_MIN_POOL_SIZE = 18;
const RELATED_MAX_POOL_SIZE = 72;

@Injectable()
export class SearchRelatedService {
  constructor(
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(BookDetail.name)
    private readonly bookModel: Model<BookDetailDocument>,
    @InjectModel(ImagePackage.name)
    private readonly imagePackageModel: Model<ImagePackageDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
    private readonly mediaApplicationService: MediaApplicationService,
    private readonly usersService: UsersService,
    private readonly searchContentPresenter: SearchContentPresenter,
  ) {}

  async related(targetType: TargetType, id: string, dto: RelatedQueryDto): Promise<unknown> {
    const limit = dto.limit ?? 6;
    const now = new Date();

    if (targetType === TargetType.ARTICLE) {
      return this.relatedArticles(id, limit, now);
    }

    if (targetType === TargetType.BOOK) {
      return this.relatedBooks(id, limit, now);
    }

    if (targetType === TargetType.TOPIC) {
      return this.relatedTopics(id, limit, now);
    }

    return this.relatedImages(id, limit, now);
  }

  private async relatedArticles(id: string, limit: number, now: Date): Promise<unknown> {
    const current = await this.articleModel.findOne({ _id: id, ...buildPublicArticleFilter() }).exec();
    if (!current) {
      throw new NotFoundException('Article not found');
    }

    const candidates = await this.loadRelatedArticleDocuments(current, limit);
    const selected = candidates
      .map((item) => ({
        item,
        score:
          this.searchContentPresenter.scoreByFreshness(
            item.post_time,
            now,
            (item.view_count ?? 0) + (item.favor_count ?? 0) * 8 + (item.reply_count ?? 0) * 6,
            30,
            40,
          ) + (item.theme_id === current.theme_id ? 80 : 0),
        sortTime: item.post_time,
      }))
      .sort((left, right) => right.score - left.score || right.sortTime.getTime() - left.sortTime.getTime())
      .slice(0, limit)
      .map((entry) => entry.item);
    const mediaMap = await this.createRelatedMediaMap(
      selected
        .map((item) => this.searchContentPresenter.resolveArticleCoverMediaId(item))
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    );
    const authorMap = await this.usersService.getSafeProfileMap(selected.map((item) => item.user_id.toString()));

    const items = selected.map((item) =>
      this.searchContentPresenter.toRelatedContentItem(
        'article',
        this.searchContentPresenter.toFeaturedArticle(item, mediaMap, authorMap.get(item.user_id.toString()), now).item,
      ),
    );

    return {
      type: 'article',
      sourceId: id,
      limit,
      items,
    };
  }

  private async relatedBooks(id: string, limit: number, now: Date): Promise<unknown> {
    const current = await this.bookModel.findOne({ _id: id, ...buildApprovedPublicFilter() }).exec();
    if (!current) {
      throw new NotFoundException('Book not found');
    }

    const candidates = await this.loadRelatedBookDocuments(current, limit);
    const selected = candidates
      .map((item) => ({
        item,
        score:
          this.searchContentPresenter.scoreByFreshness(
            item.update_time,
            now,
            (item.view_count ?? 0) + (item.favor_count ?? 0) * 8 + (item.reply_count ?? 0) * 6 + item.total * 2,
            45,
            35,
          ) +
          (item.part === current.part ? 50 : 0) +
          (item.area === current.area ? 30 : 0) +
          (item.status === current.status ? 10 : 0),
        sortTime: item.update_time,
      }))
      .sort((left, right) => right.score - left.score || right.sortTime.getTime() - left.sortTime.getTime())
      .slice(0, limit)
      .map((entry) => entry.item);
    const mediaMap = await this.createRelatedMediaMap(
      selected.map((item) => item.cover).filter((mediaId): mediaId is string => Boolean(mediaId)),
    );
    const authorMap = await this.usersService.getSafeProfileMap(selected.map((item) => item.user_id.toString()));

    const items = selected.map((item) =>
      this.searchContentPresenter.toRelatedContentItem(
        'book',
        this.searchContentPresenter.toFeaturedBook(item, mediaMap, authorMap.get(item.user_id.toString()), now).item,
      ),
    );

    return {
      type: 'book',
      sourceId: id,
      limit,
      items,
    };
  }

  private async relatedTopics(id: string, limit: number, now: Date): Promise<unknown> {
    const current = await this.topicModel.findOne({ _id: id, ...buildApprovedPublicFilter() }).exec();
    if (!current) {
      throw new NotFoundException('Topic not found');
    }

    const candidates = await this.loadRelatedTopicDocuments(current, limit);
    const selected = candidates
      .map((item) => ({
        item,
        score:
          this.searchContentPresenter.scoreByFreshness(
            item.post_time,
            now,
            (item.view_count ?? 0) + (item.favor_count ?? 0) * 8 + (item.reply_count ?? 0) * 6,
            30,
            40,
          ) +
          (item.topic_id === current.topic_id ? 55 : 0) +
          (item.type_id === current.type_id ? 35 : 0) +
          this.scoreTopicFeatureFlagOverlap(item.feature_flags, current.feature_flags),
        sortTime: item.post_time,
      }))
      .sort((left, right) => right.score - left.score || right.sortTime.getTime() - left.sortTime.getTime())
      .slice(0, limit)
      .map((entry) => entry.item);
    const mediaMap = await this.createRelatedMediaMap(
      selected
        .map((item) => this.searchContentPresenter.resolveTopicCoverMediaId(item))
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    );
    const authorMap = await this.usersService.getSafeProfileMap(selected.map((item) => item.user_id.toString()));

    const items = selected.map((item) =>
      this.searchContentPresenter.toRelatedContentItem(
        'topic',
        this.searchContentPresenter.toFeaturedTopic(item, mediaMap, authorMap.get(item.user_id.toString()), now).item,
      ),
    );

    return {
      type: 'topic',
      sourceId: id,
      limit,
      items,
    };
  }

  private async relatedImages(id: string, limit: number, now: Date): Promise<unknown> {
    const current = await this.imagePackageModel.findOne({ _id: id, ...buildApprovedPublicFilter() }).exec();
    if (!current) {
      throw new NotFoundException('Image package not found');
    }

    const candidates = await this.loadRelatedImageDocuments(current, limit);
    const selected = candidates
      .map((item) => ({
        item,
        score:
          this.searchContentPresenter.scoreByFreshness(
            item.upload_time,
            now,
            (item.view_count ?? 0) + (item.favor_count ?? 0) * 8 + (item.reply_count ?? 0) * 6 + item.total * 2,
            21,
            45,
          ) + (item.theme_id === current.theme_id ? 85 : 0),
        sortTime: item.upload_time,
      }))
      .sort((left, right) => right.score - left.score || right.sortTime.getTime() - left.sortTime.getTime())
      .slice(0, limit)
      .map((entry) => entry.item);
    const mediaMap = await this.createRelatedMediaMap(
      selected
        .map((item) => this.searchContentPresenter.resolveImageCoverMediaId(item))
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    );
    const authorMap = await this.usersService.getSafeProfileMap(selected.map((item) => item.user_id.toString()));

    const items = selected.map((item) =>
      this.searchContentPresenter.toRelatedContentItem(
        'image',
        this.searchContentPresenter.toFeaturedImage(item, mediaMap, authorMap.get(item.user_id.toString()), now).item,
      ),
    );

    return {
      type: 'image',
      sourceId: id,
      limit,
      items,
    };
  }

  private async loadRelatedArticleDocuments(current: ArticleDocument, limit: number): Promise<ArticleDocument[]> {
    const primaryFilter: Record<string, unknown> = {
      ...buildPublicArticleFilter(),
      _id: { $ne: current._id },
      theme_id: current.theme_id,
    };
    const fallbackFilter: Record<string, unknown> = {
      ...buildPublicArticleFilter(),
      _id: { $ne: current._id },
    };

    return this.loadRelatedDocuments(limit, (candidateLimit) => [
      this.articleModel.find(primaryFilter).sort({ post_time: -1 }).limit(candidateLimit).exec(),
      this.articleModel
        .find(primaryFilter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, post_time: -1 })
        .limit(candidateLimit)
        .exec(),
      this.articleModel.find(fallbackFilter).sort({ post_time: -1 }).limit(candidateLimit).exec(),
      this.articleModel
        .find(fallbackFilter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, post_time: -1 })
        .limit(candidateLimit)
        .exec(),
    ]);
  }

  private async loadRelatedBookDocuments(current: BookDetailDocument, limit: number): Promise<BookDetailDocument[]> {
    const primaryFilter: Record<string, unknown> = {
      ...buildApprovedPublicFilter(),
      _id: { $ne: current._id },
      $or: [{ part: current.part }, { area: current.area }],
    };
    const fallbackFilter: Record<string, unknown> = {
      ...buildApprovedPublicFilter(),
      _id: { $ne: current._id },
    };

    return this.loadRelatedDocuments(limit, (candidateLimit) => [
      this.bookModel.find(primaryFilter).sort({ update_time: -1 }).limit(candidateLimit).exec(),
      this.bookModel
        .find(primaryFilter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, total: -1, update_time: -1 })
        .limit(candidateLimit)
        .exec(),
      this.bookModel.find(fallbackFilter).sort({ update_time: -1 }).limit(candidateLimit).exec(),
      this.bookModel
        .find(fallbackFilter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, total: -1, update_time: -1 })
        .limit(candidateLimit)
        .exec(),
    ]);
  }

  private async loadRelatedTopicDocuments(current: TopicDocument, limit: number): Promise<TopicDocument[]> {
    const featureFlags = Array.isArray(current.feature_flags)
      ? Array.from(new Set(current.feature_flags.filter((featureFlag) => typeof featureFlag === 'number')))
      : [];
    const primaryFilter: Record<string, unknown> = {
      ...buildApprovedPublicFilter(),
      _id: { $ne: current._id },
      $or: [
        { topic_id: current.topic_id },
        { type_id: current.type_id },
        ...(featureFlags.length > 0 ? [{ feature_flags: { $in: featureFlags } }] : []),
      ],
    };
    const fallbackFilter: Record<string, unknown> = {
      ...buildApprovedPublicFilter(),
      _id: { $ne: current._id },
    };

    return this.loadRelatedDocuments(limit, (candidateLimit) => [
      this.topicModel.find(primaryFilter).sort({ post_time: -1 }).limit(candidateLimit).exec(),
      this.topicModel
        .find(primaryFilter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, post_time: -1 })
        .limit(candidateLimit)
        .exec(),
      this.topicModel.find(fallbackFilter).sort({ post_time: -1 }).limit(candidateLimit).exec(),
      this.topicModel
        .find(fallbackFilter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, post_time: -1 })
        .limit(candidateLimit)
        .exec(),
    ]);
  }

  private async loadRelatedImageDocuments(current: ImagePackageDocument, limit: number): Promise<ImagePackageDocument[]> {
    const primaryFilter: Record<string, unknown> = {
      ...buildApprovedPublicFilter(),
      _id: { $ne: current._id },
      theme_id: current.theme_id,
    };
    const fallbackFilter: Record<string, unknown> = {
      ...buildApprovedPublicFilter(),
      _id: { $ne: current._id },
    };

    return this.loadRelatedDocuments(limit, (candidateLimit) => [
      this.imagePackageModel.find(primaryFilter).sort({ upload_time: -1 }).limit(candidateLimit).exec(),
      this.imagePackageModel
        .find(primaryFilter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, total: -1, upload_time: -1 })
        .limit(candidateLimit)
        .exec(),
      this.imagePackageModel.find(fallbackFilter).sort({ upload_time: -1 }).limit(candidateLimit).exec(),
      this.imagePackageModel
        .find(fallbackFilter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, total: -1, upload_time: -1 })
        .limit(candidateLimit)
        .exec(),
    ]);
  }

  private async loadRelatedDocuments<TDocument extends { _id: unknown }>(
    limit: number,
    loaders: (candidateLimit: number) => Array<Promise<TDocument[]>>,
  ): Promise<TDocument[]> {
    const candidateLimit = this.resolveRelatedCandidateLimit(limit);
    const [primaryRecent, primaryPopular, fallbackRecent, fallbackPopular] = await Promise.all(loaders(candidateLimit));

    return this.mergeDocumentsById(primaryRecent, primaryPopular, fallbackRecent, fallbackPopular);
  }

  private resolveRelatedCandidateLimit(limit: number): number {
    return Math.min(
      Math.max(limit * RELATED_CANDIDATE_MULTIPLIER, RELATED_MIN_POOL_SIZE),
      RELATED_MAX_POOL_SIZE,
    );
  }

  private async createRelatedMediaMap(mediaIds: string[]): Promise<Map<string, MediaSummary>> {
    if (mediaIds.length === 0) {
      return new Map();
    }

    return this.mediaApplicationService.getMediaSummaryMap(Array.from(new Set(mediaIds)));
  }

  private mergeDocumentsById<T extends { _id: unknown }>(...groups: T[][]): T[] {
    const itemsById = new Map<string, T>();

    for (const group of groups) {
      for (const item of group) {
        const itemId = String(item._id);
        if (!itemsById.has(itemId)) {
          itemsById.set(itemId, item);
        }
      }
    }

    return Array.from(itemsById.values());
  }

  private scoreTopicFeatureFlagOverlap(left?: number[], right?: number[]): number {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0) {
      return 0;
    }

    const rightSet = new Set(right.filter((item) => typeof item === 'number'));
    return left.filter((item) => rightSet.has(item)).length * 18;
  }
}
