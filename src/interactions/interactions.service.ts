import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, UpdateResult } from 'mongoose';
import { Article, type ArticleDocument } from '../articles/schemas/article.schema';
import { BookDetail, type BookDetailDocument } from '../books/schemas/book.schema';
import { TargetType } from '../common/enums/target-type.enum';
import { buildApprovedPublicFilter, buildPublicArticleFilter } from '../common/utils/public-content-filter.util';
import { ImagePackage, type ImagePackageDocument } from '../images/schemas/image.schema';
import { Topic, type TopicDocument } from '../topics/schemas/topic.schema';

type CounterField = 'favor_count' | 'reply_count';
type CounterQuery = Record<string, unknown>;
type CounterUpdate = Record<string, unknown>;
type SessionableQuery<T = unknown> = {
  session(session: ClientSession | null): { exec(): Promise<T> };
  exec(): Promise<T>;
};
type CounterModel = {
  exists(filter: CounterQuery): SessionableQuery<unknown>;
  updateOne(filter: CounterQuery, update: CounterUpdate): SessionableQuery<UpdateResult>;
};

@Injectable()
export class InteractionsService {
  constructor(
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(BookDetail.name)
    private readonly bookDetailModel: Model<BookDetailDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
    @InjectModel(ImagePackage.name)
    private readonly imagePackageModel: Model<ImagePackageDocument>,
  ) {}

  setFavorCountStrict(targetType: TargetType, targetId: string, count: number, session?: ClientSession) {
    return this.setCounter(targetType, targetId, 'favor_count', count, session, true);
  }

  setFavorCountIfPresent(targetType: TargetType, targetId: string, count: number, session?: ClientSession) {
    return this.setCounter(targetType, targetId, 'favor_count', count, session, false);
  }

  incrementReplyCount(targetType: TargetType, targetId: string, amount = 1, session?: ClientSession) {
    return this.updateCounter(targetType, targetId, 'reply_count', amount, session, true);
  }

  async assertTargetExists(targetType: TargetType, targetId: string, session?: ClientSession): Promise<void> {
    const exists = await this.resolveModel(targetType)
      .exists(this.resolveTargetFilter(targetType, targetId))
      .session(session ?? null)
      .exec();

    if (!exists) {
      throw new NotFoundException('Target not found');
    }
  }

  private async updateCounter(
    targetType: TargetType,
    targetId: string,
    field: CounterField,
    amount: number,
    session?: ClientSession,
    strict = true,
  ): Promise<void> {
    const model = this.resolveModel(targetType);
    let result: UpdateResult;

    if (amount >= 0) {
      result = await model
        .updateOne({ _id: targetId }, { $inc: { [field]: amount } })
        .session(session ?? null)
        .exec();
    } else {
      result = await model
        .updateOne(
          {
            _id: targetId,
            [field]: { $gt: 0 },
          },
          { $inc: { [field]: amount } },
        )
        .session(session ?? null)
        .exec();
    }

    this.assertCounterTargetMatched(targetType, targetId, strict, result);
  }

  private async setCounter(
    targetType: TargetType,
    targetId: string,
    field: CounterField,
    value: number,
    session?: ClientSession,
    strict = true,
  ): Promise<void> {
    const result = await this.resolveModel(targetType)
      .updateOne({ _id: targetId }, { $set: { [field]: Math.max(0, value) } })
      .session(session ?? null)
      .exec();

    this.assertCounterTargetMatched(targetType, targetId, strict, result);
  }

  private assertCounterTargetMatched(
    targetType: TargetType,
    targetId: string,
    strict: boolean,
    result: UpdateResult,
  ): void {
    if (!strict || result.matchedCount > 0) {
      return;
    }

    throw new NotFoundException(`Interaction target not found: ${targetType}:${targetId}`);
  }

  private resolveModel(targetType: TargetType): CounterModel {
    if (targetType === TargetType.ARTICLE) return this.articleModel as unknown as CounterModel;
    if (targetType === TargetType.BOOK) return this.bookDetailModel as unknown as CounterModel;
    if (targetType === TargetType.TOPIC) return this.topicModel as unknown as CounterModel;
    return this.imagePackageModel as unknown as CounterModel;
  }

  private resolveTargetFilter(targetType: TargetType, targetId: string): Record<string, unknown> {
    if (targetType === TargetType.ARTICLE) {
      return {
        _id: targetId,
        ...buildPublicArticleFilter(),
      };
    }

    if (targetType === TargetType.BOOK || targetType === TargetType.TOPIC || targetType === TargetType.IMAGE) {
      return {
        _id: targetId,
        ...buildApprovedPublicFilter(),
      };
    }

    return { _id: targetId };
  }
}
