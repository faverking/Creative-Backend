import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, FilterQuery, Model } from 'mongoose';
import { Topic, TopicDocument } from '../schemas/topic.schema';

@Injectable()
export class TopicsRepository {
  constructor(
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
  ) {}

  create(payload: Partial<Topic>): Promise<TopicDocument> {
    return this.topicModel.create(payload);
  }

  async list(
    filter: FilterQuery<TopicDocument>,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { post_time: -1 },
  ): Promise<{ items: TopicDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.topicModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.topicModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  findById(id: string): Promise<TopicDocument | null> {
    return this.topicModel.findById(id).exec();
  }

  findOneAndIncrementViewCount(filter: FilterQuery<TopicDocument>): Promise<TopicDocument | null> {
    return this.topicModel.findOneAndUpdate(filter, { $inc: { view_count: 1 } }, { new: true }).exec();
  }

  updateById(id: string, payload: Partial<Topic>): Promise<TopicDocument | null> {
    return this.topicModel.findByIdAndUpdate(id, payload, { new: true }).exec();
  }

  async deleteById(id: string, session?: ClientSession): Promise<void> {
    await this.topicModel.deleteOne({ _id: id }).session(session ?? null).exec();
  }

  async findByIdAndIncrementViewCount(id: string): Promise<TopicDocument | null> {
    return this.topicModel.findByIdAndUpdate(id, { $inc: { view_count: 1 } }, { new: true }).exec();
  }
}


