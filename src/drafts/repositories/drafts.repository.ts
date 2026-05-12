import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Draft, DraftDocument } from '../schemas/draft.schema';

@Injectable()
export class DraftsRepository {
  constructor(
    @InjectModel(Draft.name)
    private readonly draftModel: Model<DraftDocument>,
  ) {}

  create(payload: Partial<Draft>): Promise<DraftDocument> {
    return this.draftModel.create(payload);
  }

  async listByUser(userId: string, page: number, limit: number): Promise<{ items: DraftDocument[]; total: number }> {
    const filter = { user_id: userId };
    const [items, total] = await Promise.all([
      this.draftModel
        .find(filter)
        .sort({ update_time: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.draftModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  findById(id: string): Promise<DraftDocument | null> {
    return this.draftModel.findById(id).exec();
  }

  updateById(id: string, payload: Partial<Draft>): Promise<DraftDocument | null> {
    return this.draftModel
      .findByIdAndUpdate(
        id,
        {
          ...payload,
          $inc: { version: 1 },
        },
        { new: true },
      )
      .exec();
  }

  async deleteById(id: string): Promise<void> {
    await this.draftModel.deleteOne({ _id: id }).exec();
  }
}
