import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, PipelineStage } from 'mongoose';
import { Article, type ArticleDocument } from '../../articles/schemas/article.schema';
import { BookDetail, type BookDetailDocument } from '../../books/schemas/book.schema';
import { buildApprovedPublicFilter, buildPublicArticleFilter } from '../../common/utils/public-content-filter.util';
import { ImagePackage, type ImagePackageDocument } from '../../images/schemas/image.schema';
import { Topic, type TopicDocument } from '../../topics/schemas/topic.schema';

export interface SearchItem {
  id: string;
  type: 'article' | 'book' | 'image' | 'topic';
  title: string;
  snippet: string;
  score?: number;
  time?: Date;
}

export interface SearchGroup {
  total: number;
  items: SearchItem[];
}

interface AggregateModel {
  aggregate(pipeline: PipelineStage[]): {
    exec(): Promise<unknown[]>;
  };
}

@Injectable()
export class SearchRepository {
  constructor(
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(BookDetail.name)
    private readonly bookModel: Model<BookDetailDocument>,
    @InjectModel(ImagePackage.name)
    private readonly imagePackageModel: Model<ImagePackageDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
  ) {}

  async quickSearchArticles(regex: RegExp, limit: number): Promise<SearchItem[]> {
    const items = await this.articleModel
      .find({ ...buildPublicArticleFilter(), title: regex }, { title: 1, desc: 1, post_time: 1 })
      .sort({ post_time: -1 })
      .limit(limit)
      .lean()
      .exec();

    return items.map((item) => ({
      id: item._id.toString(),
      type: 'article',
      title: item.title,
      snippet: item.desc,
      time: item.post_time,
    }));
  }

  async quickSearchBooks(regex: RegExp, limit: number): Promise<SearchItem[]> {
    const items = await this.bookModel
      .find({ ...buildApprovedPublicFilter(), name: regex }, { name: 1, desc: 1, update_time: 1 })
      .sort({ update_time: -1 })
      .limit(limit)
      .lean()
      .exec();

    return items.map((item) => ({
      id: item._id.toString(),
      type: 'book',
      title: item.name,
      snippet: item.desc,
      time: item.update_time,
    }));
  }

  async quickSearchImages(regex: RegExp, limit: number): Promise<SearchItem[]> {
    const items = await this.imagePackageModel
      .find({ ...buildApprovedPublicFilter(), title: regex }, { title: 1, desc: 1, upload_time: 1 })
      .sort({ upload_time: -1 })
      .limit(limit)
      .lean()
      .exec();

    return items.map((item) => ({
      id: item._id.toString(),
      type: 'image',
      title: item.title,
      snippet: item.desc,
      time: item.upload_time,
    }));
  }

  async quickSearchTopics(regex: RegExp, limit: number): Promise<SearchItem[]> {
    const items = await this.topicModel
      .find({ ...buildApprovedPublicFilter(), title: regex }, { title: 1, desc: 1, update_time: 1 })
      .sort({ update_time: -1 })
      .limit(limit)
      .lean()
      .exec();

    return items.map((item) => ({
      id: item._id.toString(),
      type: 'topic',
      title: item.title,
      snippet: item.desc,
      time: item.update_time,
    }));
  }

  async searchArticles(query: string, page: number, limit: number): Promise<SearchGroup> {
    const { items, total } = await this.searchText(
      this.articleModel,
      { ...buildPublicArticleFilter(), $text: { $search: query } },
      { post_time: -1 },
      { title: 1, desc: 1, post_time: 1 },
      page,
      limit,
    );

    return {
      total,
      items: items.map((item) => ({
        id: String(item._id),
        type: 'article',
        title: String(item.title ?? ''),
        snippet: String(item.desc ?? ''),
        score: Number(item.score ?? 0),
        time: item.post_time as Date,
      })),
    };
  }

  async searchBooks(query: string, page: number, limit: number): Promise<SearchGroup> {
    const { items, total } = await this.searchText(
      this.bookModel,
      { ...buildApprovedPublicFilter(), $text: { $search: query } },
      { update_time: -1 },
      { name: 1, desc: 1, update_time: 1 },
      page,
      limit,
    );

    return {
      total,
      items: items.map((item) => ({
        id: String(item._id),
        type: 'book',
        title: String(item.name ?? ''),
        snippet: String(item.desc ?? ''),
        score: Number(item.score ?? 0),
        time: item.update_time as Date,
      })),
    };
  }

  async searchImages(query: string, page: number, limit: number): Promise<SearchGroup> {
    const { items, total } = await this.searchText(
      this.imagePackageModel,
      { ...buildApprovedPublicFilter(), $text: { $search: query } },
      { upload_time: -1 },
      { title: 1, desc: 1, upload_time: 1 },
      page,
      limit,
    );

    return {
      total,
      items: items.map((item) => ({
        id: String(item._id),
        type: 'image',
        title: String(item.title ?? ''),
        snippet: String(item.desc ?? ''),
        score: Number(item.score ?? 0),
        time: item.upload_time as Date,
      })),
    };
  }

  async searchTopics(query: string, page: number, limit: number): Promise<SearchGroup> {
    const { items, total } = await this.searchText(
      this.topicModel,
      { ...buildApprovedPublicFilter(), $text: { $search: query } },
      { update_time: -1 },
      { title: 1, desc: 1, update_time: 1 },
      page,
      limit,
    );

    return {
      total,
      items: items.map((item) => ({
        id: String(item._id),
        type: 'topic',
        title: String(item.title ?? ''),
        snippet: String(item.desc ?? ''),
        score: Number(item.score ?? 0),
        time: item.update_time as Date,
      })),
    };
  }

  private async searchText(
    model: AggregateModel,
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    projection: Record<string, 1>,
    page: number,
    limit: number,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const pipeline: PipelineStage[] = [
      { $match: filter },
      {
        $facet: {
          items: [
            { $addFields: { score: { $meta: 'textScore' } } },
            { $sort: { score: -1, ...sort } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { ...projection, score: 1 } },
          ],
          total: [{ $count: 'value' }],
        },
      },
    ];

    const [result] = await model
      .aggregate(pipeline)
      .exec();

    const items = ((result as { items?: Array<Record<string, unknown>> } | undefined)?.items ?? []);
    const total = Number(
      ((result as { total?: Array<{ value?: number }> } | undefined)?.total ?? [])[0]?.value ?? 0,
    );

    return {
      items,
      total,
    };
  }
}
