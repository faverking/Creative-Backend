import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, type HydratedDocument } from 'mongoose';
import { TargetType } from '../../common/enums/target-type.enum';

@Schema({ _id: false, versionKey: false })
export class CommentAuthor {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  avatarUrl!: string;
}

const CommentAuthorSchema = SchemaFactory.createForClass(CommentAuthor);

@Schema({ _id: false, versionKey: false })
export class CommentMention {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;
}

const CommentMentionSchema = SchemaFactory.createForClass(CommentMention);

@Schema({ _id: false, versionKey: false })
export class CommentReply {
  @Prop({ required: true, default: () => new Types.ObjectId().toString() })
  replyId!: string;

  @Prop({ type: CommentAuthorSchema, required: true })
  author!: CommentAuthor;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: CommentMentionSchema })
  mentionedUser?: CommentMention;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

const CommentReplySchema = SchemaFactory.createForClass(CommentReply);

@Schema({
  collection: 'comments',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: false },
})
export class Comment {
  @Prop({ required: true, enum: TargetType, index: true })
  target_type!: TargetType;

  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  target_id!: Types.ObjectId;

  @Prop({ type: CommentAuthorSchema, required: true })
  author!: CommentAuthor;

  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ required: true })
  content!: string;

  @Prop({ default: 0 })
  likeCount!: number;

  @Prop({ default: 0 })
  reply_count!: number;

  @Prop({ type: [CommentReplySchema], default: [] })
  replies!: CommentReply[];

  createdAt!: Date;
}

export type CommentDocument = HydratedDocument<Comment>;
export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ target_type: 1, target_id: 1, createdAt: -1 });
CommentSchema.index({ user_id: 1, createdAt: -1 });
CommentSchema.index({ 'author.userId': 1, createdAt: -1 });
CommentSchema.index({ content: 'text', 'author.name': 'text' });
