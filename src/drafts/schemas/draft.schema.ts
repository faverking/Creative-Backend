import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';

@Schema({
  collection: 'drafts',
  versionKey: false,
  timestamps: { createdAt: 'create_time', updatedAt: 'update_time' },
})
export class Draft {
  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ enum: [1, 2, 3], default: 1 })
  theme_id!: number;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ default: 1 })
  version!: number;

  create_time!: Date;
  update_time!: Date;
}

export type DraftDocument = HydratedDocument<Draft>;
export const DraftSchema = SchemaFactory.createForClass(Draft);

DraftSchema.index({ user_id: 1, update_time: -1 });
DraftSchema.index({ user_id: 1, create_time: -1 });
DraftSchema.index({ title: 'text', content: 'text' });
