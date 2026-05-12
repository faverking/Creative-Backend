import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { Visibility } from '../../common/enums/visibility.enum';

@Schema({
  collection: 'topics',
  versionKey: false,
  timestamps: { createdAt: 'post_time', updatedAt: 'update_time' },
})
export class Topic {
  @Prop({ required: true })
  topic_id!: number;

  @Prop({ required: true })
  type_id!: number;

  @Prop({ required: true, index: true })
  title!: string;

  @Prop({ type: [String], default: [] })
  search_terms!: string[];

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ required: true })
  content!: string;

  @Prop({ required: true })
  desc!: string;

  @Prop({ required: true })
  download_url!: string;

  @Prop({ type: [Number], required: true, default: [] })
  feature_flags!: number[];

  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ default: 0 })
  view_count!: number;

  @Prop({ default: 0 })
  reply_count!: number;

  @Prop({ default: 0 })
  favor_count!: number;

  @Prop({ enum: ReviewStatus, default: ReviewStatus.APPROVED })
  review_status!: ReviewStatus;

  @Prop({ enum: Visibility, default: Visibility.PUBLIC })
  visibility!: Visibility;

  post_time!: Date;
  update_time!: Date;
}

export type TopicDocument = HydratedDocument<Topic>;
export const TopicSchema = SchemaFactory.createForClass(Topic);

const PUBLIC_TOPIC_PARTIAL_FILTER = {
  review_status: ReviewStatus.APPROVED,
  visibility: Visibility.PUBLIC,
} as const;

TopicSchema.index({ user_id: 1, post_time: -1 });
TopicSchema.index({ post_time: -1 }, { partialFilterExpression: PUBLIC_TOPIC_PARTIAL_FILTER });
TopicSchema.index(
  { topic_id: 1, type_id: 1, post_time: -1 },
  { partialFilterExpression: PUBLIC_TOPIC_PARTIAL_FILTER },
);
TopicSchema.index(
  { feature_flags: 1, post_time: -1 },
  { partialFilterExpression: PUBLIC_TOPIC_PARTIAL_FILTER },
);
TopicSchema.index(
  { favor_count: -1, reply_count: -1, view_count: -1, post_time: -1 },
  { partialFilterExpression: PUBLIC_TOPIC_PARTIAL_FILTER },
);
TopicSchema.index(
  { favor_count: -1, reply_count: -1, view_count: -1, update_time: -1 },
  { partialFilterExpression: PUBLIC_TOPIC_PARTIAL_FILTER },
);
TopicSchema.index({ search_terms: 1 });
TopicSchema.index({ title: 'text', content: 'text', desc: 'text' });
