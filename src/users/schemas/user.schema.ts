import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { ROLE_USER } from '../../common/constants/roles';
import { UserStatus } from '../../common/enums/user-status.enum';

export const OAUTH_PROVIDERS = ['google'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

@Schema({ _id: false, versionKey: false })
export class OAuthAccount {
  @Prop({ required: true, enum: OAUTH_PROVIDERS })
  provider!: OAuthProvider;

  @Prop({ required: true })
  providerUserId!: string;

  @Prop()
  email?: string;

  @Prop({ required: true })
  linkedAt!: Date;
}

const OAuthAccountSchema = SchemaFactory.createForClass(OAuthAccount);

@Schema({
  collection: 'users',
  versionKey: false,
  timestamps: true,
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, unique: true, trim: true })
  name!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ default: 1 })
  passwordVersion!: number;

  @Prop({ enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Prop({ type: [String], default: [ROLE_USER] })
  roles!: string[];

  @Prop({ type: [OAuthAccountSchema], default: [] })
  oauthAccounts!: OAuthAccount[];

  @Prop({ default: '' })
  avatarUrl!: string;

  @Prop({ default: '' })
  bio!: string;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  lastLoginIp?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ status: 1, createdAt: -1 });
UserSchema.index({ 'oauthAccounts.provider': 1, 'oauthAccounts.providerUserId': 1 });
