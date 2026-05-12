import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { FilterQuery, Model, Types } from 'mongoose';
import { type MediaType } from '../dto/media.dto';
import { MediaAsset, type MediaAssetDocument } from '../schemas/media-asset.schema';

@Injectable()
export class MediaRepository {
  constructor(
    @InjectModel(MediaAsset.name)
    private readonly mediaAssetModel: Model<MediaAssetDocument>,
  ) {}

  create(payload: Partial<MediaAsset> & { _id?: Types.ObjectId }): Promise<MediaAssetDocument> {
    return this.mediaAssetModel.create(payload);
  }

  findById(id: string): Promise<MediaAssetDocument | null> {
    return this.mediaAssetModel.findById(id).exec();
  }

  async findByIds(ids: string[]): Promise<MediaAssetDocument[]> {
    return this.mediaAssetModel.find({ _id: { $in: ids } }).sort({ createdAt: -1 }).exec();
  }

  async findExistingByHashes(mediaType: MediaType, hashes: string[]): Promise<MediaAssetDocument[]> {
    return this.mediaAssetModel.find({ mediaType, sha256: { $in: hashes } }).sort({ createdAt: -1 }).exec();
  }

  async list(
    filter: FilterQuery<MediaAssetDocument>,
    page: number,
    limit: number,
  ): Promise<{ items: MediaAssetDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.mediaAssetModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.mediaAssetModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  async deleteById(id: string): Promise<void> {
    await this.mediaAssetModel.deleteOne({ _id: id }).exec();
  }
}

