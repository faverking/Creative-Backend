import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Article, type ArticleDocument } from '../articles/schemas/article.schema';
import { BookDetail, type BookDetailDocument } from '../books/schemas/book.schema';
import { DEFAULT_FEATURED_SCENE } from '../common/constants/featured-content.constants';
import { TargetType } from '../common/enums/target-type.enum';
import { buildApprovedPublicFilter, buildPublicArticleFilter } from '../common/utils/public-content-filter.util';
import { FeaturedContentsService } from '../featured-contents/featured-contents.service';
import type { FeaturedContentDocument } from '../featured-contents/schemas/featured-content.schema';
import { ImagePackage, type ImagePackageDocument } from '../images/schemas/image.schema';
import { MediaApplicationService, type MediaSummary } from '../media/application/media.application';
import { Topic, type TopicDocument } from '../topics/schemas/topic.schema';
import { UsersService, type UserSafeProfile } from '../users/users.service';
import { SearchContentPresenter } from './search-content.presenter';
import { FEATURED_CONTENT_TYPES, FeaturedQueryDto, type FeaturedContentType } from './dto/search.dto';
import type { FeaturedCandidate, FeaturedEditorialEntry, FeaturedTypeCounts } from './search.types';

const FEATURED_CANDIDATE_MULTIPLIER = 6;
const FEATURED_MIN_POOL_SIZE = 24;
const FEATURED_MAX_POOL_SIZE = 120;

@Injectable()
export class SearchFeaturedService {
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
    private readonly featuredContentsService: FeaturedContentsService,
    private readonly searchContentPresenter: SearchContentPresenter,
  ) {}

  async featured(dto: FeaturedQueryDto): Promise<unknown> {
    const requestedTypes = this.resolveFeaturedTypes(dto.types);
    const limit = dto.limit ?? 8;
    const perTypeLimit = dto.groupByType
      ? dto.perTypeLimit ?? Math.max(1, Math.ceil(limit / requestedTypes.length))
      : undefined;
    const targetSize = dto.groupByType ? (perTypeLimit ?? 1) * requestedTypes.length : limit;
    const candidateLimit = this.resolveFeaturedCandidateLimit(targetSize);
    const editorialLimit = this.resolveEditorialCandidateLimit(targetSize);
    const now = new Date();

    const [articles, books, images, topics, totals, editorialConfigs] = await Promise.all([
      requestedTypes.includes('article') ? this.loadArticleCandidates(candidateLimit) : Promise.resolve([]),
      requestedTypes.includes('book') ? this.loadBookCandidates(candidateLimit) : Promise.resolve([]),
      requestedTypes.includes('image') ? this.loadImageCandidates(candidateLimit) : Promise.resolve([]),
      requestedTypes.includes('topic') ? this.loadTopicCandidates(candidateLimit) : Promise.resolve([]),
      this.loadFeaturedTotals(requestedTypes),
      this.featuredContentsService.listActive(
        DEFAULT_FEATURED_SCENE,
        this.toTargetTypes(requestedTypes),
        editorialLimit,
      ),
    ]);

    const editorialEntries = await this.loadEditorialEntries(editorialConfigs);
    const mediaMap = await this.createFeaturedMediaMap(articles, books, images, topics, editorialEntries);
    const authorMap = dto.includeAuthor
      ? await this.createFeaturedAuthorMap(articles, books, images, topics, editorialEntries)
      : new Map<string, UserSafeProfile>();

    const hotCandidates = [
      ...articles.map((item) =>
        this.searchContentPresenter.withHotRecommendation(
          this.searchContentPresenter.toFeaturedArticle(item, mediaMap, authorMap.get(item.user_id.toString()), now),
        ),
      ),
      ...books.map((item) =>
        this.searchContentPresenter.withHotRecommendation(
          this.searchContentPresenter.toFeaturedBook(item, mediaMap, authorMap.get(item.user_id.toString()), now),
        ),
      ),
      ...images.map((item) =>
        this.searchContentPresenter.withHotRecommendation(
          this.searchContentPresenter.toFeaturedImage(item, mediaMap, authorMap.get(item.user_id.toString()), now),
        ),
      ),
      ...topics.map((item) =>
        this.searchContentPresenter.withHotRecommendation(
          this.searchContentPresenter.toFeaturedTopic(item, mediaMap, authorMap.get(item.user_id.toString()), now),
        ),
      ),
    ].sort((left, right) => right.score - left.score || right.sortTime.getTime() - left.sortTime.getTime());

    const editorialCandidates = editorialEntries.map((entry) =>
      this.searchContentPresenter.toEditorialCandidate(entry, mediaMap, authorMap, now),
    );
    const candidates = this.searchContentPresenter.dedupeFeaturedCandidates([...editorialCandidates, ...hotCandidates]);
    const groupedCandidates = dto.groupByType
      ? this.searchContentPresenter.groupFeaturedCandidates(candidates, perTypeLimit ?? 1)
      : undefined;
    const selected = groupedCandidates
      ? this.searchContentPresenter.flattenGroupedFeaturedCandidates(candidates, groupedCandidates)
      : candidates.slice(0, limit);
    const items = selected.map((candidate) =>
      this.searchContentPresenter.toFeaturedCardItem(candidate.type, candidate.item),
    );

    return {
      limit,
      total: items.length,
      byType: this.searchContentPresenter.countFeaturedTypes(selected),
      bySource: this.searchContentPresenter.countFeaturedSources(selected),
      totals,
      algorithm: {
        version: 'featured-v3',
        summary: 'Blend editorial picks with engagement and freshness for homepage-ready public content.',
        factors: ['editorial', 'engagement', 'freshness'],
      },
      items,
      ...(dto.groupByType
        ? {
            perTypeLimit,
            groups: this.searchContentPresenter.buildFeaturedGroups(groupedCandidates),
          }
        : {}),
    };
  }

  private resolveFeaturedTypes(types?: FeaturedContentType[]): FeaturedContentType[] {
    if (!types || types.length === 0) {
      return [...FEATURED_CONTENT_TYPES];
    }

    return Array.from(new Set(types));
  }

  private async createFeaturedMediaMap(
    articles: ArticleDocument[],
    books: BookDetailDocument[],
    images: ImagePackageDocument[],
    topics: TopicDocument[],
    editorialEntries: FeaturedEditorialEntry[],
  ): Promise<Map<string, MediaSummary>> {
    const editorialArticles = editorialEntries
      .filter((entry) => entry.type === 'article')
      .map((entry) => entry.document as ArticleDocument);
    const editorialBooks = editorialEntries
      .filter((entry) => entry.type === 'book')
      .map((entry) => entry.document as BookDetailDocument);
    const editorialImages = editorialEntries
      .filter((entry) => entry.type === 'image')
      .map((entry) => entry.document as ImagePackageDocument);
    const editorialTopics = editorialEntries
      .filter((entry) => entry.type === 'topic')
      .map((entry) => entry.document as TopicDocument);

    const mediaIds = Array.from(
      new Set([
        ...articles
          .map((item) => this.searchContentPresenter.resolveArticleCoverMediaId(item))
          .filter((mediaId): mediaId is string => Boolean(mediaId)),
        ...editorialArticles
          .map((item) => this.searchContentPresenter.resolveArticleCoverMediaId(item))
          .filter((mediaId): mediaId is string => Boolean(mediaId)),
        ...books.map((item) => item.cover).filter((mediaId): mediaId is string => Boolean(mediaId)),
        ...editorialBooks.map((item) => item.cover).filter((mediaId): mediaId is string => Boolean(mediaId)),
        ...images
          .map((item) => this.searchContentPresenter.resolveImageCoverMediaId(item))
          .filter((mediaId): mediaId is string => Boolean(mediaId)),
        ...editorialImages
          .map((item) => this.searchContentPresenter.resolveImageCoverMediaId(item))
          .filter((mediaId): mediaId is string => Boolean(mediaId)),
        ...topics
          .map((item) => this.searchContentPresenter.resolveTopicCoverMediaId(item))
          .filter((mediaId): mediaId is string => Boolean(mediaId)),
        ...editorialTopics
          .map((item) => this.searchContentPresenter.resolveTopicCoverMediaId(item))
          .filter((mediaId): mediaId is string => Boolean(mediaId)),
      ]),
    );

    if (mediaIds.length === 0) {
      return new Map();
    }

    return this.mediaApplicationService.getMediaSummaryMap(mediaIds);
  }

  private createFeaturedAuthorMap(
    articles: ArticleDocument[],
    books: BookDetailDocument[],
    images: ImagePackageDocument[],
    topics: TopicDocument[],
    editorialEntries: FeaturedEditorialEntry[],
  ): Promise<Map<string, UserSafeProfile>> {
    return this.usersService.getSafeProfileMap(
      Array.from(
        new Set([
          ...articles.map((item) => item.user_id.toString()),
          ...books.map((item) => item.user_id.toString()),
          ...images.map((item) => item.user_id.toString()),
          ...topics.map((item) => item.user_id.toString()),
          ...editorialEntries.map((entry) => entry.document.user_id.toString()),
        ]),
      ),
    );
  }

  private async loadArticleCandidates(limit: number): Promise<ArticleDocument[]> {
    const filter = this.buildArticleFeaturedFilter();

    const [recent, popular] = await Promise.all([
      this.articleModel.find(filter).sort({ post_time: -1 }).limit(limit).exec(),
      this.articleModel
        .find(filter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, post_time: -1 })
        .limit(limit)
        .exec(),
    ]);

    return this.mergeDocumentsById(recent, popular);
  }

  private async loadBookCandidates(limit: number): Promise<BookDetailDocument[]> {
    const [recent, popular] = await Promise.all([
      this.bookModel.find(buildApprovedPublicFilter()).sort({ update_time: -1 }).limit(limit).exec(),
      this.bookModel
        .find(buildApprovedPublicFilter())
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, total: -1, update_time: -1 })
        .limit(limit)
        .exec(),
    ]);

    return this.mergeDocumentsById(recent, popular);
  }

  private async loadImageCandidates(limit: number): Promise<ImagePackageDocument[]> {
    const filter = this.buildImageFeaturedFilter();

    const [recent, popular] = await Promise.all([
      this.imagePackageModel.find(filter).sort({ upload_time: -1 }).limit(limit).exec(),
      this.imagePackageModel
        .find(filter)
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, total: -1, upload_time: -1 })
        .limit(limit)
        .exec(),
    ]);

    return this.mergeDocumentsById(recent, popular);
  }

  private async loadTopicCandidates(limit: number): Promise<TopicDocument[]> {
    const [recent, popular] = await Promise.all([
      this.topicModel.find(buildApprovedPublicFilter()).sort({ post_time: -1 }).limit(limit).exec(),
      this.topicModel
        .find(buildApprovedPublicFilter())
        .sort({ favor_count: -1, reply_count: -1, view_count: -1, post_time: -1 })
        .limit(limit)
        .exec(),
    ]);

    return this.mergeDocumentsById(recent, popular);
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

  private resolveFeaturedCandidateLimit(limit: number): number {
    return Math.min(
      Math.max(limit * FEATURED_CANDIDATE_MULTIPLIER, FEATURED_MIN_POOL_SIZE),
      FEATURED_MAX_POOL_SIZE,
    );
  }

  private resolveEditorialCandidateLimit(limit: number): number {
    return Math.max(limit * 4, 20);
  }

  private toTargetTypes(types: FeaturedContentType[]): TargetType[] {
    return types.map((type) => type as TargetType);
  }

  private async loadEditorialEntries(configs: FeaturedContentDocument[]): Promise<FeaturedEditorialEntry[]> {
    const articleIds = configs.filter((item) => item.target_type === TargetType.ARTICLE).map((item) => item.target_id);
    const bookIds = configs.filter((item) => item.target_type === TargetType.BOOK).map((item) => item.target_id);
    const imageIds = configs.filter((item) => item.target_type === TargetType.IMAGE).map((item) => item.target_id);
    const topicIds = configs.filter((item) => item.target_type === TargetType.TOPIC).map((item) => item.target_id);

    const [articles, books, images, topics] = await Promise.all([
      articleIds.length > 0
        ? this.articleModel.find({ ...this.buildArticleFeaturedFilter(), _id: { $in: articleIds } }).exec()
        : Promise.resolve([]),
      bookIds.length > 0
        ? this.bookModel.find({ ...buildApprovedPublicFilter(), _id: { $in: bookIds } }).exec()
        : Promise.resolve([]),
      imageIds.length > 0
        ? this.imagePackageModel.find({ ...this.buildImageFeaturedFilter(), _id: { $in: imageIds } }).exec()
        : Promise.resolve([]),
      topicIds.length > 0
        ? this.topicModel.find({ ...buildApprovedPublicFilter(), _id: { $in: topicIds } }).exec()
        : Promise.resolve([]),
    ]);

    const articleMap = new Map(articles.map((item) => [item.id, item]));
    const bookMap = new Map(books.map((item) => [item.id, item]));
    const imageMap = new Map(images.map((item) => [item.id, item]));
    const topicMap = new Map(topics.map((item) => [item.id, item]));
    const results: FeaturedEditorialEntry[] = [];

    for (const config of configs) {
      if (config.target_type === TargetType.ARTICLE) {
        const document = articleMap.get(config.target_id);
        if (document) {
          results.push({ config, type: 'article', document });
        }
        continue;
      }

      if (config.target_type === TargetType.BOOK) {
        const document = bookMap.get(config.target_id);
        if (document) {
          results.push({ config, type: 'book', document });
        }
        continue;
      }

      if (config.target_type === TargetType.IMAGE) {
        const document = imageMap.get(config.target_id);
        if (document) {
          results.push({ config, type: 'image', document });
        }
        continue;
      }

      const document = topicMap.get(config.target_id);
      if (document) {
        results.push({ config, type: 'topic', document });
      }
    }

    return results;
  }

  private async loadFeaturedTotals(requestedTypes: FeaturedContentType[]): Promise<FeaturedTypeCounts> {
    const [articles, books, images, topics] = await Promise.all([
      requestedTypes.includes('article')
        ? this.articleModel.countDocuments(this.buildArticleFeaturedFilter()).exec()
        : Promise.resolve(0),
      requestedTypes.includes('book')
        ? this.bookModel.countDocuments(buildApprovedPublicFilter()).exec()
        : Promise.resolve(0),
      requestedTypes.includes('image')
        ? this.imagePackageModel.countDocuments(this.buildImageFeaturedFilter()).exec()
        : Promise.resolve(0),
      requestedTypes.includes('topic')
        ? this.topicModel.countDocuments(buildApprovedPublicFilter()).exec()
        : Promise.resolve(0),
    ]);

    return {
      articles,
      books,
      images,
      topics,
    };
  }

  private buildArticleFeaturedFilter(): Record<string, unknown> {
    return buildPublicArticleFilter();
  }

  private buildImageFeaturedFilter(): Record<string, unknown> {
    return buildApprovedPublicFilter();
  }
}
