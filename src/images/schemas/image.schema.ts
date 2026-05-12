import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { Visibility } from '../../common/enums/visibility.enum';

@Schema({
  collection: 'images',
  versionKey: false,
  timestamps: { createdAt: 'upload_time', updatedAt: false },
})
export class ImagePackage {
  @Prop({ required: true, index: true })
  title!: string;

  @Prop({ type: [String], default: [] })
  search_terms!: string[];

  @Prop({ required: true })
  desc!: string;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ default: 0 })
  total!: number;

  @Prop({ enum: [1, 2, 3, 4], default: 1 })
  theme_id!: 1 | 2 | 3 | 4;

  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ default: 0 })
  view_count!: number;

  @Prop({ default: 0 })
  favor_count!: number;

  @Prop({ default: 0 })
  reply_count!: number;

  @Prop()
  cover?: string;

  @Prop()
  source?: string;

  @Prop({ enum: ReviewStatus, default: ReviewStatus.APPROVED })
  review_status!: ReviewStatus;

  @Prop({ enum: Visibility, default: Visibility.PUBLIC })
  visibility!: Visibility;

  upload_time!: Date;
}

export type ImagePackageDocument = HydratedDocument<ImagePackage>;
export const ImagePackageSchema = SchemaFactory.createForClass(ImagePackage);

const PUBLIC_IMAGE_PARTIAL_FILTER = {
  review_status: ReviewStatus.APPROVED,
  visibility: Visibility.PUBLIC,
} as const;

ImagePackageSchema.index({ user_id: 1, upload_time: -1 });
ImagePackageSchema.index({ upload_time: -1 }, { partialFilterExpression: PUBLIC_IMAGE_PARTIAL_FILTER });
ImagePackageSchema.index(
  { theme_id: 1, upload_time: -1 },
  { partialFilterExpression: PUBLIC_IMAGE_PARTIAL_FILTER },
);
ImagePackageSchema.index(
  { favor_count: -1, reply_count: -1, view_count: -1, total: -1, upload_time: -1 },
  { partialFilterExpression: PUBLIC_IMAGE_PARTIAL_FILTER },
);
ImagePackageSchema.index({ search_terms: 1 });
ImagePackageSchema.index({ title: 'text', desc: 'text' });
