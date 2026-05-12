import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, DeleteResult, FilterQuery, Model } from 'mongoose';
import { TargetType } from '../../common/enums/target-type.enum';
import { Favorite, type FavoriteDocument } from '../schemas/favorite.schema';

@Injectable()
export class FavoritesRepository {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
  ) {}

  findOne(filter: FilterQuery<FavoriteDocument>): Promise<FavoriteDocument | null> {
    return this.favoriteModel.findOne(filter).exec();
  }

  async create(payload: Partial<Favorite>, session?: ClientSession): Promise<FavoriteDocument> {
    const document = new this.favoriteModel(payload);
    return document.save({ session });
  }

  findOneAndDelete(filter: FilterQuery<FavoriteDocument>, session?: ClientSession): Promise<FavoriteDocument | null> {
    return this.favoriteModel.findOneAndDelete(filter).session(session ?? null).exec();
  }

  countByTarget(targetType: Favorite['target_type'], targetId: string, session?: ClientSession): Promise<number> {
    return this.favoriteModel
      .countDocuments({ target_type: targetType, target_id: targetId })
      .session(session ?? null)
      .exec();
  }

  async list(
    filter: FilterQuery<FavoriteDocument>,
    page: number,
    limit: number,
  ): Promise<{ items: FavoriteDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.favoriteModel
        .find(filter)
        .sort({ create_time: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.favoriteModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  async deleteManyByTarget(targetType: TargetType, targetId: string, session?: ClientSession): Promise<number> {
    const result: DeleteResult = await this.favoriteModel.deleteMany({
      target_type: targetType,
      target_id: targetId,
    }).session(session ?? null).exec();

    return result.deletedCount ?? 0;
  }

  async deleteManyByIds(ids: string[], session?: ClientSession): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result: DeleteResult = await this.favoriteModel
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
