import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type ClientSession, type FilterQuery, type Model } from 'mongoose';
import { TargetType } from '../../common/enums/target-type.enum';
import { Notification, type NotificationDocument } from '../schemas/notification.schema';

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  create(payload: Partial<Notification>, session?: ClientSession): Promise<NotificationDocument> {
    const document = new this.notificationModel(payload);
    return document.save({ session });
  }

  async list(
    filter: FilterQuery<NotificationDocument>,
    page: number,
    limit: number,
  ): Promise<{ items: NotificationDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
    };
  }

  countUnreadByUser(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({
        user_id: new Types.ObjectId(userId),
        unread: true,
      })
      .exec();
  }

  markRead(id: string, userId: string): Promise<NotificationDocument | null> {
    return this.notificationModel
      .findOneAndUpdate(
        {
          _id: id,
          user_id: new Types.ObjectId(userId),
        },
        {
          $set: {
            unread: false,
            read_at: new Date(),
          },
        },
        {
          new: true,
        },
      )
      .exec();
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.notificationModel
      .updateMany(
        {
          user_id: new Types.ObjectId(userId),
          unread: true,
        },
        {
          $set: {
            unread: false,
            read_at: new Date(),
          },
        },
      )
      .exec();

    return result.modifiedCount ?? 0;
  }

  async deleteManyByTarget(targetType: TargetType, targetId: string, session?: ClientSession): Promise<number> {
    const result = await this.notificationModel
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

    const result = await this.notificationModel
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
