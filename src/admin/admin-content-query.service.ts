import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type FilterQuery, type Model } from 'mongoose';
import { Article, type ArticleDocument } from '../articles/schemas/article.schema';
import { BookChapter, type BookChapterDocument, BookDetail, type BookDetailDocument } from '../books/schemas/book.schema';
import { DEFAULT_FEATURED_SCENE } from '../common/constants/featured-content.constants';
import { ROLE_SUPER_ADMIN } from '../common/constants/roles';
import { ReviewStatus } from '../common/enums/review-status.enum';
import { TargetType } from '../common/enums/target-type.enum';
import { Visibility } from '../common/enums/visibility.enum';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { resolveImagePackageCoverMediaId } from '../common/utils/content-presentation.util';
import { normalizeMediaReferenceIds, pickFirstMediaReferenceId } from '../common/utils/media-reference.util';
import { buildShanghaiDateRangeFilter } from '../common/utils/date-range.util';
import { buildKeywordSearchFilter } from '../common/utils/keyword-search.util';
import { FeaturedContentsService } from '../featured-contents/featured-contents.service';
import { ImagePackage, type ImagePackageDocument } from '../images/schemas/image.schema';
import { MediaApplicationService } from '../media/application/media.application';
import { Topic, type TopicDocument } from '../topics/schemas/topic.schema';
import { UsersService } from '../users/users.service';
import { AdminContentPresenter } from './admin-content.presenter';
import {
  QueryAdminContentDetailDto,
  QueryAdminContentsDto,
  QueryAdminContentSummaryDto,
  type AdminContentSort,
} from './dto/admin-content.dto';

interface AdminContentPermissions {
  canRecommend: true;
  canSetPrivate: true;
  canPhysicalDelete: boolean;
}

@Injectable()
export class AdminContentQueryService {
  constructor(
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(BookDetail.name)
    private readonly bookDetailModel: Model<BookDetailDocument>,
    @InjectModel(BookChapter.name)
    private readonly bookChapterModel: Model<BookChapterDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
    @InjectModel(ImagePackage.name)
    private readonly imagePackageModel: Model<ImagePackageDocument>,
    private readonly usersService: UsersService,
    private readonly mediaApplicationService: MediaApplicationService,
    private readonly featuredContentsService: FeaturedContentsService,
    private readonly adminContentPresenter: AdminContentPresenter,
  ) {}

  async summary(user: JwtUser, query: QueryAdminContentSummaryDto): Promise<unknown> {
    const scene = this.resolveScene(query.scene);
    const [
      article,
      bookTotal,
      bookPublic,
      bookPrivate,
      bookPending,
      bookRejected,
      bookFeatured,
      topicTotal,
      topicPublic,
      topicPrivate,
      topicPending,
      topicRejected,
      topicFeatured,
      imageTotal,
      imagePublic,
      imagePrivate,
      imagePending,
      imageRejected,
      imageFeatured,
    ] = await Promise.all([
      this.summarizeArticles(scene),
      this.bookDetailModel.countDocuments({}).exec(),
      this.bookDetailModel.countDocuments({ visibility: Visibility.PUBLIC }).exec(),
      this.bookDetailModel.countDocuments({ visibility: Visibility.PRIVATE }).exec(),
      this.bookDetailModel.countDocuments({ review_status: ReviewStatus.PENDING }).exec(),
      this.bookDetailModel.countDocuments({ review_status: ReviewStatus.REJECTED }).exec(),
      this.featuredContentsService.countActiveByTargetType(scene, TargetType.BOOK),
      this.topicModel.countDocuments({}).exec(),
      this.topicModel.countDocuments({ visibility: Visibility.PUBLIC }).exec(),
      this.topicModel.countDocuments({ visibility: Visibility.PRIVATE }).exec(),
      this.topicModel.countDocuments({ review_status: ReviewStatus.PENDING }).exec(),
      this.topicModel.countDocuments({ review_status: ReviewStatus.REJECTED }).exec(),
      this.featuredContentsService.countActiveByTargetType(scene, TargetType.TOPIC),
      this.imagePackageModel.countDocuments({}).exec(),
      this.imagePackageModel.countDocuments({ visibility: Visibility.PUBLIC }).exec(),
      this.imagePackageModel.countDocuments({ visibility: Visibility.PRIVATE }).exec(),
      this.imagePackageModel.countDocuments({ review_status: ReviewStatus.PENDING }).exec(),
      this.imagePackageModel.countDocuments({ review_status: ReviewStatus.REJECTED }).exec(),
      this.featuredContentsService.countActiveByTargetType(scene, TargetType.IMAGE),
    ]);

    return {
      scene,
      permissions: this.buildPermissions(user),
      counts: {
        article,
        book: {
          total: bookTotal,
          public: bookPublic,
          private: bookPrivate,
          pending: bookPending,
          rejected: bookRejected,
          featured: bookFeatured,
        },
        topic: {
          total: topicTotal,
          public: topicPublic,
          private: topicPrivate,
          pending: topicPending,
          rejected: topicRejected,
          featured: topicFeatured,
        },
        image: {
          total: imageTotal,
          public: imagePublic,
          private: imagePrivate,
          pending: imagePending,
          rejected: imageRejected,
          featured: imageFeatured,
        },
      },
      operator: {
        id: user.userId,
        roles: user.roles,
      },
    };
  }

  async list(user: JwtUser, query: QueryAdminContentsDto): Promise<unknown> {
    const scene = this.resolveScene(query.scene);
    const result = (await this.listByType(query, scene)) as Record<string, unknown>;

    return {
      scene,
      type: query.type,
      permissions: this.buildPermissions(user),
      operator: {
        id: user.userId,
        roles: user.roles,
      },
      ...result,
    };
  }

  async detail(
    type: TargetType,
    id: string,
    user: JwtUser,
    query: QueryAdminContentDetailDto,
  ): Promise<unknown> {
    const scene = this.resolveScene(query.scene);
    const item = await this.detailItemByType(type, id, scene);

    return {
      scene,
      type,
      permissions: this.buildPermissions(user),
      operator: {
        id: user.userId,
        roles: user.roles,
      },
      item,
    };
  }

  async detailItemByType(type: TargetType, id: string, scene: string): Promise<unknown> {
    switch (type) {
      case TargetType.ARTICLE: {
        const article = await this.articleModel.findById(id).exec();
        if (!article) {
          throw new NotFoundException('Article not found');
        }
        return this.buildArticleDetail(article, scene);
      }
      case TargetType.BOOK: {
        const book = await this.bookDetailModel.findById(id).exec();
        if (!book) {
          throw new NotFoundException('Book not found');
        }
        return this.buildBookDetail(book, scene);
      }
      case TargetType.TOPIC: {
        const topic = await this.topicModel.findById(id).exec();
        if (!topic) {
          throw new NotFoundException('Topic not found');
        }
        return this.buildTopicDetail(topic, scene);
      }
      case TargetType.IMAGE: {
        const imagePackage = await this.imagePackageModel.findById(id).exec();
        if (!imagePackage) {
          throw new NotFoundException('Image package not found');
        }
        return this.buildImageDetail(imagePackage, scene);
      }
    }

    throw new BadRequestException('Unsupported content type');
  }

  private async summarizeArticles(scene: string): Promise<unknown> {
    const activeFilter = {
      deleted_at: { $exists: false },
    };
    const [total, deleted, publicCount, privateCount, pendingCount, rejectedCount, featuredCount] =
      await Promise.all([
        this.articleModel.countDocuments(activeFilter).exec(),
        this.articleModel.countDocuments({ deleted_at: { $exists: true } }).exec(),
        this.articleModel.countDocuments({ ...activeFilter, visibility: Visibility.PUBLIC }).exec(),
        this.articleModel.countDocuments({ ...activeFilter, visibility: Visibility.PRIVATE }).exec(),
        this.articleModel.countDocuments({ ...activeFilter, review_status: ReviewStatus.PENDING }).exec(),
        this.articleModel.countDocuments({ ...activeFilter, review_status: ReviewStatus.REJECTED }).exec(),
        this.featuredContentsService.countActiveByTargetType(scene, TargetType.ARTICLE),
      ]);

    return {
      total,
      deleted,
      public: publicCount,
      private: privateCount,
      pending: pendingCount,
      rejected: rejectedCount,
      featured: featuredCount,
    };
  }

  private async listByType(query: QueryAdminContentsDto, scene: string): Promise<unknown> {
    switch (query.type) {
      case TargetType.ARTICLE:
        return this.listArticles(query, scene);
      case TargetType.BOOK:
        return this.listBooks(query, scene);
      case TargetType.TOPIC:
        return this.listTopics(query, scene);
      case TargetType.IMAGE:
        return this.listImages(query, scene);
    }

    throw new BadRequestException('Unsupported content type');
  }

  private async listArticles(query: QueryAdminContentsDto, scene: string): Promise<unknown> {
    const filter: FilterQuery<ArticleDocument> = {
      deleted_at: query.deleted ? { $exists: true } : { $exists: false },
    };
    this.applyKeywordSearchFilter(filter, query.keyword);
    if (query.userId) {
      filter.user_id = new Types.ObjectId(query.userId);
    }
    if (typeof query.themeId === 'number') {
      filter.theme_id = query.themeId;
    }
    if (query.reviewStatus) {
      filter.review_status = query.reviewStatus;
    }
    if (query.visibility) {
      filter.visibility = query.visibility;
    }
    if (query.status) {
      filter.status = query.status;
    }

    const postTimeRange = buildShanghaiDateRangeFilter(query.startDate, query.endDate);
    if (postTimeRange) {
      filter.post_time = postTimeRange;
    }

    const shouldReturnEmpty = await this.applyFeaturedFilter(filter, query.featured, scene, TargetType.ARTICLE);
    if (shouldReturnEmpty) {
      return {
        items: [],
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        total: 0,
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [items, total] = await Promise.all([
      this.articleModel
        .find(filter)
        .sort(this.resolveArticleSort(query.sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.articleModel.countDocuments(filter).exec(),
    ]);
    const mediaIds = items
      .map((item) => pickFirstMediaReferenceId(item.images))
      .filter((mediaId): mediaId is string => Boolean(mediaId));
    const [mediaMap, ownerMap, featuredMap] = await Promise.all([
      this.mediaApplicationService.getMediaSummaryMap(mediaIds),
      this.usersService.getSafeProfileMap(items.map((item) => item.user_id.toString())),
      this.featuredContentsService.getActiveTargetAdminItemMap(scene, TargetType.ARTICLE, items.map((item) => item.id)),
    ]);

    return {
      items: items.map((item) =>
        this.adminContentPresenter.toArticleListItem(
          item,
          mediaMap,
          ownerMap.get(item.user_id.toString()),
          featuredMap.get(item.id),
        ),
      ),
      page,
      limit,
      total,
    };
  }

  private async listBooks(query: QueryAdminContentsDto, scene: string): Promise<unknown> {
    const filter: FilterQuery<BookDetailDocument> = {};
    this.applyKeywordSearchFilter(filter, query.keyword);
    if (query.userId) {
      filter.user_id = new Types.ObjectId(query.userId);
    }
    if (typeof query.part === 'number') {
      filter.part = query.part;
    }
    if (typeof query.area === 'number') {
      filter.area = query.area;
    }
    if (typeof query.bookStatus === 'number') {
      filter.status = query.bookStatus;
    }
    if (query.reviewStatus) {
      filter.review_status = query.reviewStatus;
    }
    if (query.visibility) {
      filter.visibility = query.visibility;
    }

    const createTimeRange = buildShanghaiDateRangeFilter(query.startDate, query.endDate);
    if (createTimeRange) {
      filter.create_time = createTimeRange;
    }

    const shouldReturnEmpty = await this.applyFeaturedFilter(filter, query.featured, scene, TargetType.BOOK);
    if (shouldReturnEmpty) {
      return {
        items: [],
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        total: 0,
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [items, total] = await Promise.all([
      this.bookDetailModel
        .find(filter)
        .sort(this.resolveBookSort(query.sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.bookDetailModel.countDocuments(filter).exec(),
    ]);
    const [mediaMap, ownerMap, featuredMap] = await Promise.all([
      this.mediaApplicationService.getMediaSummaryMap(items.map((item) => item.cover)),
      this.usersService.getSafeProfileMap(items.map((item) => item.user_id.toString())),
      this.featuredContentsService.getActiveTargetAdminItemMap(scene, TargetType.BOOK, items.map((item) => item.id)),
    ]);

    return {
      items: items.map((item) =>
        this.adminContentPresenter.toBookListItem(
          item,
          mediaMap,
          ownerMap.get(item.user_id.toString()),
          featuredMap.get(item.id),
        ),
      ),
      page,
      limit,
      total,
    };
  }

  private async listTopics(query: QueryAdminContentsDto, scene: string): Promise<unknown> {
    const filter: FilterQuery<TopicDocument> = {};
    this.applyKeywordSearchFilter(filter, query.keyword);
    if (query.userId) {
      filter.user_id = new Types.ObjectId(query.userId);
    }
    if (typeof query.topicId === 'number') {
      filter.topic_id = query.topicId;
    }
    if (typeof query.typeId === 'number') {
      filter.type_id = query.typeId;
    }
    if (Array.isArray(query.featureFlags) && query.featureFlags.length > 0) {
      filter.feature_flags = { $all: Array.from(new Set(query.featureFlags)) };
    }
    if (query.reviewStatus) {
      filter.review_status = query.reviewStatus;
    }
    if (query.visibility) {
      filter.visibility = query.visibility;
    }

    const postTimeRange = buildShanghaiDateRangeFilter(query.startDate, query.endDate);
    if (postTimeRange) {
      filter.post_time = postTimeRange;
    }

    const shouldReturnEmpty = await this.applyFeaturedFilter(filter, query.featured, scene, TargetType.TOPIC);
    if (shouldReturnEmpty) {
      return {
        items: [],
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        total: 0,
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [items, total] = await Promise.all([
      this.topicModel
        .find(filter)
        .sort(this.resolveTopicSort(query.sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.topicModel.countDocuments(filter).exec(),
    ]);
    const mediaIds = items
      .map((item) => pickFirstMediaReferenceId(item.images))
      .filter((mediaId): mediaId is string => Boolean(mediaId));
    const [mediaMap, ownerMap, featuredMap] = await Promise.all([
      this.mediaApplicationService.getMediaSummaryMap(mediaIds),
      this.usersService.getSafeProfileMap(items.map((item) => item.user_id.toString())),
      this.featuredContentsService.getActiveTargetAdminItemMap(scene, TargetType.TOPIC, items.map((item) => item.id)),
    ]);

    return {
      items: items.map((item) =>
        this.adminContentPresenter.toTopicListItem(
          item,
          mediaMap,
          ownerMap.get(item.user_id.toString()),
          featuredMap.get(item.id),
        ),
      ),
      page,
      limit,
      total,
    };
  }

  private async listImages(query: QueryAdminContentsDto, scene: string): Promise<unknown> {
    const filter: FilterQuery<ImagePackageDocument> = {};
    this.applyKeywordSearchFilter(filter, query.keyword);
    if (query.userId) {
      filter.user_id = new Types.ObjectId(query.userId);
    }
    if (typeof query.themeId === 'number') {
      filter.theme_id = query.themeId;
    }
    if (query.reviewStatus) {
      filter.review_status = query.reviewStatus;
    }
    if (query.visibility) {
      filter.visibility = query.visibility;
    }

    const uploadTimeRange = buildShanghaiDateRangeFilter(query.startDate, query.endDate);
    if (uploadTimeRange) {
      filter.upload_time = uploadTimeRange;
    }

    const shouldReturnEmpty = await this.applyFeaturedFilter(filter, query.featured, scene, TargetType.IMAGE);
    if (shouldReturnEmpty) {
      return {
        items: [],
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        total: 0,
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [items, total] = await Promise.all([
      this.imagePackageModel
        .find(filter)
        .sort(this.resolveImageSort(query.sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.imagePackageModel.countDocuments(filter).exec(),
    ]);
    const [mediaMap, ownerMap, featuredMap] = await Promise.all([
      this.mediaApplicationService.getImagePresentationMap(items.flatMap((item) => this.collectImagePackageCoverIds(item))),
      this.usersService.getSafeProfileMap(items.map((item) => item.user_id.toString())),
      this.featuredContentsService.getActiveTargetAdminItemMap(scene, TargetType.IMAGE, items.map((item) => item.id)),
    ]);

    return {
      items: items.map((item) =>
        this.adminContentPresenter.toImageListItem(
          item,
          mediaMap,
          ownerMap.get(item.user_id.toString()),
          featuredMap.get(item.id),
        ),
      ),
      page,
      limit,
      total,
    };
  }

  private async buildArticleDetail(article: ArticleDocument, scene: string): Promise<unknown> {
    const mediaIds = normalizeMediaReferenceIds(article.images);
    const [mediaMap, ownerMap, featuredMap] = await Promise.all([
      this.mediaApplicationService.getMediaSummaryMap(mediaIds),
      this.usersService.getSafeProfileMap([article.user_id.toString()]),
      this.featuredContentsService.getActiveTargetAdminItemMap(scene, TargetType.ARTICLE, [article.id]),
    ]);

    return this.adminContentPresenter.toArticleDetail(
      article,
      mediaMap,
      ownerMap.get(article.user_id.toString()),
      featuredMap.get(article.id),
      mediaIds,
    );
  }

  private async buildBookDetail(book: BookDetailDocument, scene: string): Promise<unknown> {
    const [mediaMap, ownerMap, featuredMap, chapter] = await Promise.all([
      this.mediaApplicationService.getMediaSummaryMap([book.cover]),
      this.usersService.getSafeProfileMap([book.user_id.toString()]),
      this.featuredContentsService.getActiveTargetAdminItemMap(scene, TargetType.BOOK, [book.id]),
      this.bookChapterModel.findOne({ book_id: new Types.ObjectId(book.id) }).exec(),
    ]);

    return this.adminContentPresenter.toBookDetail(
      book,
      mediaMap,
      ownerMap.get(book.user_id.toString()),
      featuredMap.get(book.id),
      chapter,
    );
  }

  private async buildTopicDetail(topic: TopicDocument, scene: string): Promise<unknown> {
    const mediaIds = normalizeMediaReferenceIds(topic.images);
    const [mediaMap, ownerMap, featuredMap] = await Promise.all([
      this.mediaApplicationService.getMediaSummaryMap(mediaIds),
      this.usersService.getSafeProfileMap([topic.user_id.toString()]),
      this.featuredContentsService.getActiveTargetAdminItemMap(scene, TargetType.TOPIC, [topic.id]),
    ]);

    return this.adminContentPresenter.toTopicDetail(
      topic,
      mediaMap,
      ownerMap.get(topic.user_id.toString()),
      featuredMap.get(topic.id),
      mediaIds,
    );
  }

  private async buildImageDetail(imagePackage: ImagePackageDocument, scene: string): Promise<unknown> {
    const imageMediaIds = normalizeMediaReferenceIds(imagePackage.images);
    const mediaIds = Array.from(new Set([...imageMediaIds, ...this.collectImagePackageCoverIds(imagePackage)]));
    const [mediaMap, ownerMap, featuredMap] = await Promise.all([
      this.mediaApplicationService.getImagePresentationMap(mediaIds),
      this.usersService.getSafeProfileMap([imagePackage.user_id.toString()]),
      this.featuredContentsService.getActiveTargetAdminItemMap(scene, TargetType.IMAGE, [imagePackage.id]),
    ]);

    return this.adminContentPresenter.toImageDetail(
      imagePackage,
      mediaMap,
      ownerMap.get(imagePackage.user_id.toString()),
      featuredMap.get(imagePackage.id),
      imageMediaIds,
    );
  }

  private async applyFeaturedFilter<TDocument>(
    filter: FilterQuery<TDocument>,
    featured: boolean | undefined,
    scene: string,
    targetType: TargetType,
  ): Promise<boolean> {
    if (typeof featured !== 'boolean') {
      return false;
    }

    const objectIds = (await this.featuredContentsService.listActiveTargetIds(scene, targetType))
      .filter((targetId) => Types.ObjectId.isValid(targetId))
      .map((targetId) => new Types.ObjectId(targetId));

    if (featured) {
      if (objectIds.length === 0) {
        return true;
      }
      filter._id = { $in: objectIds } as FilterQuery<TDocument>['_id'];
      return false;
    }

    if (objectIds.length > 0) {
      filter._id = { $nin: objectIds } as FilterQuery<TDocument>['_id'];
    }

    return false;
  }

  private applyKeywordSearchFilter<TDocument>(filter: FilterQuery<TDocument>, keyword?: string): void {
    Object.assign(filter, buildKeywordSearchFilter(keyword));
  }

  private resolveScene(scene?: string): string {
    const normalized = scene?.trim();
    return normalized && normalized.length > 0 ? normalized : DEFAULT_FEATURED_SCENE;
  }

  private resolveArticleSort(sort: AdminContentSort = 'latest'): Record<string, 1 | -1> {
    if (sort === 'hot') {
      return {
        favor_count: -1,
        reply_count: -1,
        view_count: -1,
        post_time: -1,
      };
    }

    return {
      post_time: -1,
    };
  }

  private resolveBookSort(sort: AdminContentSort = 'latest'): Record<string, 1 | -1> {
    if (sort === 'hot') {
      return {
        favor_count: -1,
        reply_count: -1,
        view_count: -1,
        total: -1,
        update_time: -1,
      };
    }

    return {
      create_time: -1,
    };
  }

  private resolveTopicSort(sort: AdminContentSort = 'latest'): Record<string, 1 | -1> {
    if (sort === 'hot') {
      return {
        favor_count: -1,
        reply_count: -1,
        view_count: -1,
        post_time: -1,
      };
    }

    return {
      post_time: -1,
    };
  }

  private resolveImageSort(sort: AdminContentSort = 'latest'): Record<string, 1 | -1> {
    if (sort === 'hot') {
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

  private buildPermissions(user: JwtUser): AdminContentPermissions {
    return {
      canRecommend: true,
      canSetPrivate: true,
      canPhysicalDelete: user.roles.includes(ROLE_SUPER_ADMIN),
    };
  }

  private collectImagePackageCoverIds(imagePackage: ImagePackageDocument): string[] {
    const coverMediaId = resolveImagePackageCoverMediaId(imagePackage);
    return coverMediaId ? [coverMediaId] : [];
  }
}
