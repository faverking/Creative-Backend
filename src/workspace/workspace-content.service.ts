import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type ClientSession, type FilterQuery, type Model } from 'mongoose';
import { type ArticleDocument, Article } from '../articles/schemas/article.schema';
import { type BookDetailDocument, BookDetail } from '../books/schemas/book.schema';
import { collectMediaReferenceIds, normalizeMediaReferenceIds } from '../common/utils/media-reference.util';
import {
  buildApprovedPublicFilter,
  buildPublicArticleFilter,
} from '../common/utils/public-content-filter.util';
import type { ResolvedMediaAsset } from '../common/utils/media-summary.util';
import { TargetType } from '../common/enums/target-type.enum';
import { type ImagePackageDocument, ImagePackage } from '../images/schemas/image.schema';
import {
  MediaApplicationService,
  type ImageMediaPresentation,
  type MediaSummary,
} from '../media/application/media.application';
import { type TopicDocument, Topic } from '../topics/schemas/topic.schema';
import { UsersService, type UserSafeProfile } from '../users/users.service';
import { WorkspaceContentPresenter } from './workspace-content.presenter';

export interface WorkspaceContentTarget {
  targetType: TargetType;
  targetId: string;
}

export interface WorkspaceContentSummary {
  targetType: TargetType;
  businessLabel: string;
  targetId: string;
  title: string;
  summary: string;
  coverMedia?: ResolvedMediaAsset;
  meta: Record<string, unknown>;
  tags: string[];
  author?: {
    id: string;
    name: string;
    avatarUrl: string;
  };
}

interface TargetOwnerView {
  targetId: string;
  userId: string;
}

@Injectable()
export class WorkspaceContentService {
  constructor(
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(BookDetail.name)
    private readonly bookModel: Model<BookDetailDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
    @InjectModel(ImagePackage.name)
    private readonly imageModel: Model<ImagePackageDocument>,
    private readonly mediaApplicationService: MediaApplicationService,
    private readonly usersService: UsersService,
    private readonly workspaceContentPresenter: WorkspaceContentPresenter,
  ) {}

  async getContentSummaryMap(targets: WorkspaceContentTarget[]): Promise<Map<string, WorkspaceContentSummary>> {
    const groupedIds = this.groupTargetIds(targets);
    const [articles, books, topics, images] = await Promise.all([
      this.findArticles(groupedIds.article),
      this.findBooks(groupedIds.book),
      this.findTopics(groupedIds.topic),
      this.findImages(groupedIds.image),
    ]);

    const articleAuthorIds = articles.map((item) => item.user_id.toString());
    const topicAuthorIds = topics.map((item) => item.user_id.toString());
    const imageAuthorIds = images.map((item) => item.user_id.toString());
    const authorMap = await this.usersService.getSafeProfileMap([
      ...articleAuthorIds,
      ...topicAuthorIds,
      ...imageAuthorIds,
    ]);

    const mediaMap = await this.mediaApplicationService.getMediaSummaryMap([
      ...articles.flatMap((item) => normalizeMediaReferenceIds(item.images)),
      ...books.map((item) => item.cover),
      ...topics.flatMap((item) => normalizeMediaReferenceIds(item.images)),
    ]);
    const imageMediaMap = await this.mediaApplicationService.getImagePresentationMap(
      images.flatMap((item) => collectMediaReferenceIds(item.images, [item.cover])),
    );

    const summaryMap = new Map<string, WorkspaceContentSummary>();

    for (const item of articles) {
      summaryMap.set(
        this.toTargetKey(TargetType.ARTICLE, item.id),
        this.workspaceContentPresenter.toArticleSummary(item, mediaMap, authorMap),
      );
    }

    for (const item of books) {
      summaryMap.set(
        this.toTargetKey(TargetType.BOOK, item.id),
        this.workspaceContentPresenter.toBookSummary(item, mediaMap),
      );
    }

    for (const item of topics) {
      summaryMap.set(
        this.toTargetKey(TargetType.TOPIC, item.id),
        this.workspaceContentPresenter.toTopicSummary(item, mediaMap, authorMap),
      );
    }

    for (const item of images) {
      summaryMap.set(
        this.toTargetKey(TargetType.IMAGE, item.id),
        this.workspaceContentPresenter.toImageSummary(item, imageMediaMap, authorMap),
      );
    }

    return summaryMap;
  }

  async getTargetOwner(targetType: TargetType, targetId: string, session?: ClientSession): Promise<TargetOwnerView | null> {
    if (!Types.ObjectId.isValid(targetId)) {
      return null;
    }

    const condition = this.buildTargetCondition(targetType, [targetId]);
    const projection = { _id: 1, user_id: 1 };
    const query = this.resolveModel(targetType).findOne(condition, projection);
    if (session) {
      query.session(session);
    }

    const item = await query.exec();
    if (!item) {
      return null;
    }

    return {
      targetId: item.id,
      userId: item.user_id.toString(),
    };
  }

  private async findArticles(ids: string[]): Promise<ArticleDocument[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.articleModel
      .find(
        this.buildTargetCondition(TargetType.ARTICLE, ids),
        {
          title: 1,
          desc: 1,
          images: 1,
          theme_id: 1,
          user_id: 1,
          favor_count: 1,
          reply_count: 1,
          view_count: 1,
          post_time: 1,
        },
      )
      .exec();
  }

  private async findBooks(ids: string[]): Promise<BookDetailDocument[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.bookModel
      .find(
        this.buildTargetCondition(TargetType.BOOK, ids),
        {
          name: 1,
          desc: 1,
          cover: 1,
          part: 1,
          area: 1,
          total: 1,
          author: 1,
          favor_count: 1,
          reply_count: 1,
          view_count: 1,
          update_time: 1,
          release_time: 1,
        },
      )
      .exec();
  }

  private async findTopics(ids: string[]): Promise<TopicDocument[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.topicModel
      .find(
        this.buildTargetCondition(TargetType.TOPIC, ids),
        {
          topic_id: 1,
          type_id: 1,
          title: 1,
          desc: 1,
          images: 1,
          feature_flags: 1,
          user_id: 1,
          favor_count: 1,
          reply_count: 1,
          view_count: 1,
          post_time: 1,
        },
      )
      .exec();
  }

  private async findImages(ids: string[]): Promise<ImagePackageDocument[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.imageModel
      .find(
        this.buildTargetCondition(TargetType.IMAGE, ids),
        {
          title: 1,
          desc: 1,
          cover: 1,
          images: 1,
          total: 1,
          theme_id: 1,
          source: 1,
          user_id: 1,
          favor_count: 1,
          reply_count: 1,
          view_count: 1,
          upload_time: 1,
        },
      )
      .exec();
  }

  private groupTargetIds(targets: WorkspaceContentTarget[]): Record<TargetType, string[]> {
    const grouped: Record<TargetType, string[]> = {
      [TargetType.ARTICLE]: [],
      [TargetType.BOOK]: [],
      [TargetType.TOPIC]: [],
      [TargetType.IMAGE]: [],
    };

    for (const item of targets) {
      if (!Types.ObjectId.isValid(item.targetId)) {
        continue;
      }

      grouped[item.targetType].push(item.targetId);
    }

    return {
      [TargetType.ARTICLE]: Array.from(new Set(grouped[TargetType.ARTICLE])),
      [TargetType.BOOK]: Array.from(new Set(grouped[TargetType.BOOK])),
      [TargetType.TOPIC]: Array.from(new Set(grouped[TargetType.TOPIC])),
      [TargetType.IMAGE]: Array.from(new Set(grouped[TargetType.IMAGE])),
    };
  }

  private buildTargetCondition(targetType: TargetType, ids: string[]): FilterQuery<unknown> {
    const baseFilter =
      targetType === TargetType.ARTICLE
        ? buildPublicArticleFilter()
        : buildApprovedPublicFilter();

    return {
      _id: {
        $in: ids.map((id) => new Types.ObjectId(id)),
      },
      ...baseFilter,
    };
  }

  private resolveModel(targetType: TargetType): Model<{ user_id: Types.ObjectId } & { id: string }> {
    if (targetType === TargetType.ARTICLE) {
      return this.articleModel as unknown as Model<{ user_id: Types.ObjectId } & { id: string }>;
    }

    if (targetType === TargetType.BOOK) {
      return this.bookModel as unknown as Model<{ user_id: Types.ObjectId } & { id: string }>;
    }

    if (targetType === TargetType.TOPIC) {
      return this.topicModel as unknown as Model<{ user_id: Types.ObjectId } & { id: string }>;
    }

    return this.imageModel as unknown as Model<{ user_id: Types.ObjectId } & { id: string }>;
  }

  private toTargetKey(targetType: TargetType, targetId: string): string {
    return `${targetType}:${targetId}`;
  }
}
