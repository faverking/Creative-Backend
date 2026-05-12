import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TargetType } from '../../common/enums/target-type.enum';

const HISTORY_RETENTION_DAYS = 180;
const HISTORY_RETENTION_SECONDS = HISTORY_RETENTION_DAYS * 24 * 60 * 60;

@Schema({
  collection: 'history_entries',
  versionKey: false,
  timestamps: false,
})
export class HistoryEntry {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ enum: TargetType, required: true })
  target_type!: TargetType;

  @Prop({ required: true })
  target_id!: string;

  @Prop()
  source_label?: string;

  @Prop({ required: true, default: Date.now })
  visited_at!: Date;
}

export type HistoryEntryDocument = HydratedDocument<HistoryEntry>;
export const HistoryEntrySchema = SchemaFactory.createForClass(HistoryEntry);

HistoryEntrySchema.index({ user_id: 1, visited_at: -1 });
HistoryEntrySchema.index({ user_id: 1, target_type: 1, visited_at: -1 });
HistoryEntrySchema.index({ user_id: 1, target_type: 1, target_id: 1 }, { unique: true });
HistoryEntrySchema.index({ visited_at: 1 }, { expireAfterSeconds: HISTORY_RETENTION_SECONDS });
