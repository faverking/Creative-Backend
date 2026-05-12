import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { TargetType } from '../../common/enums/target-type.enum';
import { NotificationKind } from '../dto/query-notifications.dto';

@Schema({ _id: false, versionKey: false })
export class NotificationActorSnapshot {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  avatarUrl!: string;
}

const NotificationActorSnapshotSchema = SchemaFactory.createForClass(NotificationActorSnapshot);

@Schema({
  collection: 'notifications',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class Notification {
  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ enum: NotificationKind, required: true })
  kind!: NotificationKind;

  @Prop({ type: NotificationActorSnapshotSchema, required: true })
  actor!: NotificationActorSnapshot;

  @Prop({ enum: TargetType, required: true })
  target_type!: TargetType;

  @Prop({ required: true })
  target_id!: string;

  @Prop({ type: SchemaTypes.ObjectId })
  comment_id?: Types.ObjectId;

  @Prop()
  reply_id?: string;

  @Prop({ required: true })
  excerpt!: string;

  @Prop()
  context?: string;

  @Prop({ default: true })
  unread!: boolean;

  @Prop()
  read_at?: Date;

  created_at!: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ user_id: 1, created_at: -1 });
NotificationSchema.index({ user_id: 1, unread: 1, created_at: -1 });
NotificationSchema.index({ user_id: 1, kind: 1, created_at: -1 });
