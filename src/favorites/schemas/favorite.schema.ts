import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TargetType } from '../../common/enums/target-type.enum';

@Schema({
  collection: 'favorites',
  versionKey: false,
  timestamps: { createdAt: 'create_time', updatedAt: false },
})
export class Favorite {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ enum: TargetType, required: true })
  target_type!: TargetType;

  @Prop({ required: true })
  target_id!: string;

  create_time!: Date;
}

export type FavoriteDocument = HydratedDocument<Favorite>;
export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

FavoriteSchema.index({ user_id: 1, target_type: 1, target_id: 1 }, { unique: true });
FavoriteSchema.index({ user_id: 1, create_time: -1 });
