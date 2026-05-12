import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';
import { DEFAULT_FEATURED_RANK, DEFAULT_FEATURED_SCENE } from '../../common/constants/featured-content.constants';
import { TargetType } from '../../common/enums/target-type.enum';

@Schema({
  collection: 'featured_contents',
  versionKey: false,
  timestamps: { createdAt: 'create_time', updatedAt: 'update_time' },
})
export class FeaturedContent {
  @Prop({ required: true, default: DEFAULT_FEATURED_SCENE, index: true })
  scene!: string;

  @Prop({ enum: TargetType, required: true, index: true })
  target_type!: TargetType;

  @Prop({ required: true, index: true })
  target_id!: string;

  @Prop({ default: DEFAULT_FEATURED_RANK })
  rank!: number;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ required: true })
  start_at!: Date;

  @Prop({ required: true })
  end_at!: Date;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  operator_id!: Types.ObjectId;

  @Prop({ default: '' })
  note!: string;

  create_time!: Date;
  update_time!: Date;
}

export type FeaturedContentDocument = HydratedDocument<FeaturedContent>;
export const FeaturedContentSchema = SchemaFactory.createForClass(FeaturedContent);

FeaturedContentSchema.index({ scene: 1, target_type: 1, target_id: 1 }, { unique: true });
FeaturedContentSchema.index({ scene: 1, enabled: 1, rank: 1, update_time: -1 });
FeaturedContentSchema.index({ scene: 1, target_type: 1, enabled: 1, start_at: 1, end_at: 1, rank: 1, update_time: -1 });
FeaturedContentSchema.index({ target_type: 1, target_id: 1, update_time: -1 });
