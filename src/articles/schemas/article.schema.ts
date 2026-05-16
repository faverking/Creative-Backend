import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { Visibility } from '../../common/enums/visibility.enum';

@Schema({
  collection: 'articles',
  versionKey: false,
  timestamps: { createdAt: 'post_time', updatedAt: 'update_time' },
})
export class Article {
  @Prop({ required: true, index: true })
  title!: string;

  @Prop({ required: true })
  desc!: string;

  @Prop({ type: [String], default: [] })
  search_terms!: string[];

  @Prop({ required: true })
  content!: string;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ required: true, enum: [1, 2, 3, 4], default: 1 })
  theme_id!: number;

  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ default: 0 })
  view_count!: number;

  @Prop({ default: 0 })
  reply_count!: number;

  @Prop({ default: 0 })
  favor_count!: number;

  @Prop({ enum: ContentStatus, default: ContentStatus.PUBLISHED })
  status!: ContentStatus;

  @Prop({ enum: ReviewStatus, default: ReviewStatus.APPROVED })
  review_status!: ReviewStatus;

  @Prop({ enum: Visibility, default: Visibility.PUBLIC })
  visibility!: Visibility;

  @Prop()
  deleted_at?: Date;

  post_time!: Date;
  update_time!: Date;
}

export type ArticleDocument = HydratedDocument<Article>;
export const ArticleSchema = SchemaFactory.createForClass(Article);

const PUBLIC_ARTICLE_PARTIAL_FILTER = {
  status: ContentStatus.PUBLISHED,
  review_status: ReviewStatus.APPROVED,
  visibility: Visibility.PUBLIC,
} as const;

ArticleSchema.index({ user_id: 1, post_time: -1 });
ArticleSchema.index({ post_time: -1 }, { partialFilterExpression: PUBLIC_ARTICLE_PARTIAL_FILTER });
ArticleSchema.index({ theme_id: 1, post_time: -1 }, { partialFilterExpression: PUBLIC_ARTICLE_PARTIAL_FILTER });
ArticleSchema.index(
  { favor_count: -1, reply_count: -1, view_count: -1, post_time: -1 },
  { partialFilterExpression: PUBLIC_ARTICLE_PARTIAL_FILTER },
);
ArticleSchema.index(
  { favor_count: -1, reply_count: -1, view_count: -1, update_time: -1 },
  { partialFilterExpression: PUBLIC_ARTICLE_PARTIAL_FILTER },
);
ArticleSchema.index({ search_terms: 1 });
ArticleSchema.index({ title: 'text', desc: 'text', content: 'text' });
