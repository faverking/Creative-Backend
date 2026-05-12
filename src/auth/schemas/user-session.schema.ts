import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'user_sessions', versionKey: false, timestamps: { createdAt: 'created_at', updatedAt: false } })
export class UserSession {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ required: true, index: true })
  device_id!: string;

  @Prop({ required: true })
  refresh_token_hash!: string;

  @Prop()
  ip?: string;

  @Prop()
  ua?: string;

  @Prop({ required: true })
  expire_at!: Date;

  @Prop()
  revoked_at?: Date;

  created_at!: Date;
}

export type UserSessionDocument = HydratedDocument<UserSession>;
export const UserSessionSchema = SchemaFactory.createForClass(UserSession);

UserSessionSchema.index({ user_id: 1, device_id: 1 });
UserSessionSchema.index({ expire_at: 1 }, { expireAfterSeconds: 0 });
