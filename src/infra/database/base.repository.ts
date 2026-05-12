import type { FilterQuery, Model, Types, UpdateQuery } from 'mongoose';

export abstract class BaseRepository<TDocument extends { _id: Types.ObjectId }> {
  protected constructor(protected readonly model: Model<TDocument>) {}

  create(payload: Partial<TDocument>): Promise<TDocument> {
    return this.model.create(payload);
  }

  findOne(filter: FilterQuery<TDocument>): Promise<TDocument | null> {
    return this.model.findOne(filter).exec();
  }

  findById(id: string): Promise<TDocument | null> {
    return this.model.findById(id).exec();
  }

  updateOne(filter: FilterQuery<TDocument>, update: UpdateQuery<TDocument>): Promise<void> {
    return this.model.updateOne(filter, update).exec().then(() => undefined);
  }

  deleteOne(filter: FilterQuery<TDocument>): Promise<void> {
    return this.model.deleteOne(filter).exec().then(() => undefined);
  }
}
