import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type ClientSession, type DeleteResult, type FilterQuery, type Model } from 'mongoose';
import { TargetType } from '../../common/enums/target-type.enum';
import { HistoryEntry, type HistoryEntryDocument } from '../schemas/history-entry.schema';

@Injectable()
export class HistoryRepository {
  constructor(
    @InjectModel(HistoryEntry.name)
    private readonly historyModel: Model<HistoryEntryDocument>,
  ) {}

  async upsertVisit(userId: string, targetType: TargetType, targetId: string, sourceLabel?: string): Promise<void> {
    await this.historyModel
      .updateOne(
        {
          user_id: new Types.ObjectId(userId),
          target_type: targetType,
          target_id: targetId,
        },
        {
          $set: {
            source_label: sourceLabel,
            visited_at: new Date(),
          },
          $setOnInsert: {
            user_id: new Types.ObjectId(userId),
            target_type: targetType,
            target_id: targetId,
          },
        },
        {
          upsert: true,
        },
      )
      .exec();
  }

  async list(
    filter: FilterQuery<HistoryEntryDocument>,
    page: number,
    limit: number,
  ): Promise<{ items: HistoryEntryDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.historyModel
        .find(filter)
        .sort({ visited_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.historyModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
    };
  }

  async clearByUser(userId: string): Promise<number> {
    const result: DeleteResult = await this.historyModel
      .deleteMany({
        user_id: new Types.ObjectId(userId),
      })
      .exec();

    return result.deletedCount ?? 0;
  }

  async pruneOverflowByUser(userId: string, keep: number): Promise<number> {
    if (keep <= 0) {
      return this.clearByUser(userId);
    }

    const overflowItems = await this.historyModel
      .find(
        {
          user_id: new Types.ObjectId(userId),
        },
        {
          _id: 1,
        },
      )
      .sort({ visited_at: -1 })
      .skip(keep)
      .exec();

    return this.deleteManyByIds(overflowItems.map((item) => item.id));
  }

  async deleteManyByTarget(targetType: TargetType, targetId: string, session?: ClientSession): Promise<number> {
    const result: DeleteResult = await this.historyModel
      .deleteMany({
        target_type: targetType,
        target_id: targetId,
      })
      .session(session ?? null)
      .exec();

    return result.deletedCount ?? 0;
  }

  async deleteManyByIds(ids: string[], session?: ClientSession): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result: DeleteResult = await this.historyModel
      .deleteMany({
        _id: {
          $in: ids,
        },
      })
      .session(session ?? null)
      .exec();

    return result.deletedCount ?? 0;
  }
}
