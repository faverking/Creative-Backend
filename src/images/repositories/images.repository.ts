import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, FilterQuery, Model } from 'mongoose';
import { ImagePackage, ImagePackageDocument } from '../schemas/image.schema';

@Injectable()
export class ImagesRepository {
  constructor(
    @InjectModel(ImagePackage.name)
    private readonly imagePackageModel: Model<ImagePackageDocument>,
  ) {}

  create(payload: Partial<ImagePackage>): Promise<ImagePackageDocument> {
    return this.imagePackageModel.create(payload);
  }

  async list(
    filter: FilterQuery<ImagePackageDocument>,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { upload_time: -1 },
  ): Promise<{ items: ImagePackageDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.imagePackageModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.imagePackageModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  findById(id: string): Promise<ImagePackageDocument | null> {
    return this.imagePackageModel.findById(id).exec();
  }

  findOneAndIncrementViewCount(filter: FilterQuery<ImagePackageDocument>): Promise<ImagePackageDocument | null> {
    return this.imagePackageModel.findOneAndUpdate(filter, { $inc: { view_count: 1 } }, { new: true }).exec();
  }

  updateById(id: string, payload: Partial<ImagePackage>): Promise<ImagePackageDocument | null> {
    return this.imagePackageModel.findByIdAndUpdate(id, payload, { new: true }).exec();
  }

  async deleteById(id: string, session?: ClientSession): Promise<void> {
    await this.imagePackageModel.deleteOne({ _id: id }).session(session ?? null).exec();
  }

  findByIdAndIncrementViewCount(id: string): Promise<ImagePackageDocument | null> {
    return this.imagePackageModel.findByIdAndUpdate(id, { $inc: { view_count: 1 } }, { new: true }).exec();
  }
}


