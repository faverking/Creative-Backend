import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, FilterQuery, Model } from 'mongoose';
import { Article, type ArticleDocument } from '../schemas/article.schema';

@Injectable()
export class ArticlesRepository {
  constructor(
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
  ) {}

  create(payload: Partial<Article>): Promise<ArticleDocument> {
    return this.articleModel.create(payload);
  }

  async list(
    filter: FilterQuery<ArticleDocument>,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { post_time: -1 },
  ): Promise<{ items: ArticleDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.articleModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.articleModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  findById(id: string): Promise<ArticleDocument | null> {
    return this.articleModel.findById(id).exec();
  }

  findOneAndIncrementViewCount(filter: FilterQuery<ArticleDocument>): Promise<ArticleDocument | null> {
    return this.articleModel.findOneAndUpdate(filter, { $inc: { view_count: 1 } }, { new: true }).exec();
  }

  updateById(id: string, payload: Partial<Article>): Promise<ArticleDocument | null> {
    return this.articleModel.findByIdAndUpdate(id, payload, { new: true }).exec();
  }

  softDeleteById(id: string, deletedAt: Date, session?: ClientSession): Promise<ArticleDocument | null> {
    return this.articleModel.findByIdAndUpdate(id, { deleted_at: deletedAt }, { new: true, session }).exec();
  }

  deleteById(id: string, session?: ClientSession): Promise<ArticleDocument | null> {
    return this.articleModel.findByIdAndDelete(id, { session }).exec();
  }

  findByIdAndIncrementViewCount(id: string): Promise<ArticleDocument | null> {
    return this.articleModel.findByIdAndUpdate(id, { $inc: { view_count: 1 } }, { new: true }).exec();
  }
}
