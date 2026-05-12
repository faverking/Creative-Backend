import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, DeleteResult, FilterQuery, Model, UpdateQuery } from 'mongoose';
import { FeaturedContent, type FeaturedContentDocument } from '../schemas/featured-content.schema';

@Injectable()
export class FeaturedContentsRepository {
  constructor(
    @InjectModel(FeaturedContent.name)
    private readonly featuredContentModel: Model<FeaturedContentDocument>,
  ) {}

  findOne(filter: FilterQuery<FeaturedContentDocument>): Promise<FeaturedContentDocument | null> {
    return this.featuredContentModel.findOne(filter).exec();
  }

  findMany(
    filter: FilterQuery<FeaturedContentDocument>,
    sort: Record<string, 1 | -1> = { rank: 1, update_time: -1 },
  ): Promise<FeaturedContentDocument[]> {
    return this.featuredContentModel.find(filter).sort(sort).exec();
  }

  upsertByTarget(
    filter: FilterQuery<FeaturedContentDocument>,
    payload: UpdateQuery<FeaturedContentDocument>,
  ): Promise<FeaturedContentDocument | null> {
    return this.featuredContentModel
      .findOneAndUpdate(filter, payload, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      })
      .exec();
  }

  updateByTarget(
    filter: FilterQuery<FeaturedContentDocument>,
    payload: UpdateQuery<FeaturedContentDocument>,
  ): Promise<FeaturedContentDocument | null> {
    return this.featuredContentModel.findOneAndUpdate(filter, payload, { new: true }).exec();
  }

  async list(
    filter: FilterQuery<FeaturedContentDocument>,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { enabled: -1, rank: 1, update_time: -1 },
  ): Promise<{ items: FeaturedContentDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.featuredContentModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.featuredContentModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  listActive(
    filter: FilterQuery<FeaturedContentDocument>,
    limit: number,
  ): Promise<FeaturedContentDocument[]> {
    return this.featuredContentModel
      .find(filter)
      .sort({ rank: 1, update_time: -1 })
      .limit(limit)
      .exec();
  }

  count(filter: FilterQuery<FeaturedContentDocument>): Promise<number> {
    return this.featuredContentModel.countDocuments(filter).exec();
  }

  async updateMany(
    filter: FilterQuery<FeaturedContentDocument>,
    payload: UpdateQuery<FeaturedContentDocument>,
    session?: ClientSession,
  ): Promise<number> {
    const result = await this.featuredContentModel.updateMany(filter, payload).session(session ?? null).exec();
    return result.modifiedCount ?? 0;
  }

  async deleteMany(filter: FilterQuery<FeaturedContentDocument>, session?: ClientSession): Promise<number> {
    const result: DeleteResult = await this.featuredContentModel.deleteMany(filter).session(session ?? null).exec();
    return result.deletedCount ?? 0;
  }
}
