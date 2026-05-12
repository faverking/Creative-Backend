import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Article, type ArticleDocument } from '../articles/schemas/article.schema';
import { BookDetail, type BookDetailDocument } from '../books/schemas/book.schema';
import { Comment, type CommentDocument } from '../comments/schemas/comment.schema';
import { Draft, type DraftDocument } from '../drafts/schemas/draft.schema';
import { ImagePackage, type ImagePackageDocument } from '../images/schemas/image.schema';
import { Topic, type TopicDocument } from '../topics/schemas/topic.schema';
import { QueryUserBusinessDailyStatsDto } from './dto/query-user-business-daily-stats.dto';
import { buildApprovedPublicFilter, buildPublicArticleFilter } from '../common/utils/public-content-filter.util';

const SHANGHAI_TIMEZONE = 'Asia/Shanghai';
const SHANGHAI_OFFSET = '+08:00';
const USER_BUSINESS_TYPES = ['articles', 'books', 'images', 'topics', 'drafts', 'comments'] as const;
const PUBLIC_BUSINESS_TYPES = ['articles', 'books', 'images', 'topics'] as const;

type UserBusinessType = (typeof USER_BUSINESS_TYPES)[number];
type PublicBusinessType = (typeof PUBLIC_BUSINESS_TYPES)[number];
type StatsModel = Model<unknown>;
type UserBusinessCounts = Record<UserBusinessType, number>;
type PublicBusinessCounts = Record<PublicBusinessType, number>;

interface DailyAggregationItem {
  _id: string;
  count: number;
}

interface DateRange {
  startDate: string;
  endDate: string;
  startAt: Date;
  endExclusive: Date;
}

@Injectable()
export class UserBusinessStatsService {
  constructor(
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(BookDetail.name)
    private readonly bookDetailModel: Model<BookDetailDocument>,
    @InjectModel(ImagePackage.name)
    private readonly imagePackageModel: Model<ImagePackageDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
    @InjectModel(Draft.name)
    private readonly draftModel: Model<DraftDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
  ) {}

  async getUserBusinessStats(userId: string): Promise<unknown> {
    const ownerId = new Types.ObjectId(userId);
    const [articles, books, images, topics, drafts, comments] = await Promise.all([
      this.countByUser(this.articleModel as unknown as StatsModel, ownerId, { deleted_at: { $exists: false } }),
      this.countByUser(this.bookDetailModel as unknown as StatsModel, ownerId),
      this.countByUser(this.imagePackageModel as unknown as StatsModel, ownerId),
      this.countByUser(this.topicModel as unknown as StatsModel, ownerId),
      this.countByUser(this.draftModel as unknown as StatsModel, ownerId),
      this.countByUser(this.commentModel as unknown as StatsModel, ownerId),
    ]);

    const byType: UserBusinessCounts = {
      articles,
      books,
      images,
      topics,
      drafts,
      comments,
    };

    return {
      userId,
      byType,
      total: this.sumUserCounts(byType),
    };
  }

  async getUserDailyBusinessStats(userId: string, query: QueryUserBusinessDailyStatsDto): Promise<unknown> {
    const range = this.resolveDateRange(query);
    const { byType, items } = await this.buildUserDailyStats(range, new Types.ObjectId(userId));

    return {
      userId,
      range: this.toRangeSummary(range, items.length),
      byType,
      total: this.sumUserCounts(byType),
      items,
    };
  }

  async getPublicDailyBusinessStats(query: QueryUserBusinessDailyStatsDto): Promise<unknown> {
    const range = this.resolveDateRange(query);
    const { byType, items } = await this.buildPublicDailyStats(range);

    return {
      range: this.toRangeSummary(range, items.length),
      byType,
      total: this.sumPublicCounts(byType),
      items,
    };
  }

  private countByUser(
    model: StatsModel,
    userId: Types.ObjectId,
    extraMatch?: Record<string, unknown>,
  ): Promise<number> {
    return model.countDocuments({ user_id: userId, ...(extraMatch ?? {}) }).exec();
  }

  private aggregateDailyCounts(
    model: StatsModel,
    dateField: string,
    range: DateRange,
    userId?: Types.ObjectId,
    extraMatch?: Record<string, unknown>,
  ): Promise<DailyAggregationItem[]> {
    const match: Record<string, unknown> = {
      [dateField]: {
        $gte: range.startAt,
        $lt: range.endExclusive,
      },
    };

    if (userId) {
      match.user_id = userId;
    }

    if (extraMatch) {
      Object.assign(match, extraMatch);
    }

    return model
      .aggregate<DailyAggregationItem>([
        {
          $match: match,
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: `$${dateField}`,
                timezone: SHANGHAI_TIMEZONE,
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
  }

  private mergeDailyCounts<T extends Record<string, number>>(
    itemsByDate: Map<string, T>,
    businessType: keyof T,
    aggregations: DailyAggregationItem[],
  ): void {
    for (const item of aggregations) {
      const target = itemsByDate.get(item._id);
      if (target) {
        target[businessType] = item.count as T[keyof T];
      }
    }
  }

  private createEmptyUserCounts(): UserBusinessCounts {
    return {
      articles: 0,
      books: 0,
      images: 0,
      topics: 0,
      drafts: 0,
      comments: 0,
    };
  }

  private createEmptyPublicCounts(): PublicBusinessCounts {
    return {
      articles: 0,
      books: 0,
      images: 0,
      topics: 0,
    };
  }

  private sumUserCounts(counts: UserBusinessCounts): number {
    return USER_BUSINESS_TYPES.reduce((total, type) => total + counts[type], 0);
  }

  private sumPublicCounts(counts: PublicBusinessCounts): number {
    return PUBLIC_BUSINESS_TYPES.reduce((total, type) => total + counts[type], 0);
  }

  private async buildUserDailyStats(
    range: DateRange,
    userId: Types.ObjectId,
  ): Promise<{ byType: UserBusinessCounts; items: Array<{ date: string; total: number } & UserBusinessCounts> }> {
    const [articles, books, images, topics, drafts, comments] = await Promise.all([
      this.aggregateDailyCounts(this.articleModel as unknown as StatsModel, 'post_time', range, userId, {
        deleted_at: { $exists: false },
      }),
      this.aggregateDailyCounts(this.bookDetailModel as unknown as StatsModel, 'create_time', range, userId),
      this.aggregateDailyCounts(this.imagePackageModel as unknown as StatsModel, 'upload_time', range, userId),
      this.aggregateDailyCounts(this.topicModel as unknown as StatsModel, 'post_time', range, userId),
      this.aggregateDailyCounts(this.draftModel as unknown as StatsModel, 'create_time', range, userId),
      this.aggregateDailyCounts(this.commentModel as unknown as StatsModel, 'createdAt', range, userId),
    ]);

    const itemsByDate = new Map(
      this.buildDateSeries(range.startDate, range.endDate).map((date) => [date, this.createEmptyUserCounts()]),
    );

    this.mergeDailyCounts(itemsByDate, 'articles', articles);
    this.mergeDailyCounts(itemsByDate, 'books', books);
    this.mergeDailyCounts(itemsByDate, 'images', images);
    this.mergeDailyCounts(itemsByDate, 'topics', topics);
    this.mergeDailyCounts(itemsByDate, 'drafts', drafts);
    this.mergeDailyCounts(itemsByDate, 'comments', comments);

    const items = Array.from(itemsByDate.entries()).map(([date, byType]) => ({
      date,
      ...byType,
      total: this.sumUserCounts(byType),
    }));

    const byType = items.reduce<UserBusinessCounts>((accumulator, item) => {
      for (const type of USER_BUSINESS_TYPES) {
        accumulator[type] += item[type];
      }
      return accumulator;
    }, this.createEmptyUserCounts());

    return {
      byType,
      items,
    };
  }

  private async buildPublicDailyStats(
    range: DateRange,
  ): Promise<{ byType: PublicBusinessCounts; items: Array<{ date: string; total: number } & PublicBusinessCounts> }> {
    const articleFilter = buildPublicArticleFilter();
    const contentFilter = buildApprovedPublicFilter();

    const [articles, books, images, topics] = await Promise.all([
      this.aggregateDailyCounts(this.articleModel as unknown as StatsModel, 'post_time', range, undefined, articleFilter),
      this.aggregateDailyCounts(this.bookDetailModel as unknown as StatsModel, 'create_time', range, undefined, contentFilter),
      this.aggregateDailyCounts(this.imagePackageModel as unknown as StatsModel, 'upload_time', range, undefined, contentFilter),
      this.aggregateDailyCounts(this.topicModel as unknown as StatsModel, 'post_time', range, undefined, contentFilter),
    ]);

    const itemsByDate = new Map(
      this.buildDateSeries(range.startDate, range.endDate).map((date) => [date, this.createEmptyPublicCounts()]),
    );

    this.mergeDailyCounts(itemsByDate, 'articles', articles);
    this.mergeDailyCounts(itemsByDate, 'books', books);
    this.mergeDailyCounts(itemsByDate, 'images', images);
    this.mergeDailyCounts(itemsByDate, 'topics', topics);

    const items = Array.from(itemsByDate.entries()).map(([date, byType]) => ({
      date,
      ...byType,
      total: this.sumPublicCounts(byType),
    }));

    const byType = items.reduce<PublicBusinessCounts>((accumulator, item) => {
      for (const type of PUBLIC_BUSINESS_TYPES) {
        accumulator[type] += item[type];
      }
      return accumulator;
    }, this.createEmptyPublicCounts());

    return {
      byType,
      items,
    };
  }

  private toRangeSummary(range: DateRange, days: number) {
    return {
      startDate: range.startDate,
      endDate: range.endDate,
      days,
      timezone: SHANGHAI_TIMEZONE,
    };
  }

  private resolveDateRange(query: QueryUserBusinessDailyStatsDto): DateRange {
    const days = query.days ?? 30;
    const today = this.formatShanghaiDate(new Date());

    let startDate: string;
    let endDate: string;

    if (query.startDate && query.endDate) {
      startDate = this.assertValidDateString(query.startDate, 'startDate');
      endDate = this.assertValidDateString(query.endDate, 'endDate');
    } else if (query.startDate) {
      startDate = this.assertValidDateString(query.startDate, 'startDate');
      endDate = this.addDays(startDate, days - 1);
      if (endDate > today) {
        endDate = today;
      }
    } else if (query.endDate) {
      endDate = this.assertValidDateString(query.endDate, 'endDate');
      startDate = this.addDays(endDate, -(days - 1));
    } else {
      endDate = today;
      startDate = this.addDays(endDate, -(days - 1));
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate cannot be later than endDate');
    }

    const rangeDays = this.diffDays(startDate, endDate) + 1;
    if (rangeDays > 365) {
      throw new BadRequestException('Date range cannot exceed 365 days');
    }

    return {
      startDate,
      endDate,
      startAt: this.parseShanghaiDate(startDate),
      endExclusive: this.parseShanghaiDate(this.addDays(endDate, 1)),
    };
  }

  private buildDateSeries(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    let cursor = startDate;

    while (cursor <= endDate) {
      dates.push(cursor);
      cursor = this.addDays(cursor, 1);
    }

    return dates;
  }

  private assertValidDateString(value: string, fieldName: string): string {
    const parsed = this.parseShanghaiDate(value);
    if (Number.isNaN(parsed.getTime()) || this.formatShanghaiDate(parsed) !== value) {
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format`);
    }

    return value;
  }

  private parseShanghaiDate(value: string): Date {
    return new Date(`${value}T00:00:00.000${SHANGHAI_OFFSET}`);
  }

  private addDays(value: string, days: number): string {
    const date = this.parseShanghaiDate(value);
    date.setUTCDate(date.getUTCDate() + days);
    return this.formatShanghaiDate(date);
  }

  private diffDays(startDate: string, endDate: string): number {
    const start = this.parseShanghaiDate(startDate);
    const end = this.parseShanghaiDate(endDate);
    return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  }

  private formatShanghaiDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: SHANGHAI_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((item) => item.type === 'year')?.value ?? '0000';
    const month = parts.find((item) => item.type === 'month')?.value ?? '01';
    const day = parts.find((item) => item.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  }
}

