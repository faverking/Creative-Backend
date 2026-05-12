import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { Visibility } from '../../common/enums/visibility.enum';

@Schema({ _id: false, versionKey: false })
export class BookStyle {
  @Prop({ required: true })
  id!: number;

  @Prop({ required: true })
  name!: string;
}

const BookStyleSchema = SchemaFactory.createForClass(BookStyle);

@Schema({
  collection: 'books',
  versionKey: false,
  timestamps: { createdAt: 'create_time', updatedAt: 'update_time' },
})
export class BookDetail {
  @Prop({ type: [String], default: [] })
  author!: string[];

  @Prop({ enum: [1, 2, 3], default: 1 })
  part!: 1 | 2 | 3;

  @Prop({ type: [BookStyleSchema], default: [] })
  style!: BookStyle[];

  @Prop({ enum: [1, 2], default: 1 })
  status!: 1 | 2;

  @Prop({ enum: [1, 2, 3], default: 2 })
  area!: 1 | 2 | 3;

  @Prop({ default: 0 })
  total!: number;

  @Prop({ required: true, index: true })
  name!: string;

  @Prop({ type: [String], default: [] })
  search_terms!: string[];

  @Prop({ required: true })
  cover!: string;

  @Prop({ required: true })
  desc!: string;

  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ default: 0 })
  favor_count!: number;

  @Prop({ default: 0 })
  view_count!: number;

  @Prop({ default: 0 })
  reply_count!: number;

  @Prop({ enum: ReviewStatus, default: ReviewStatus.APPROVED })
  review_status!: ReviewStatus;

  @Prop({ enum: Visibility, default: Visibility.PUBLIC })
  visibility!: Visibility;

  @Prop()
  release_time?: number;

  create_time!: Date;
  update_time!: Date;
}

@Schema({ collection: 'book_chapters', versionKey: false })
export class BookChapter {
  @Prop({ required: true })
  book_id!: Types.ObjectId;

  @Prop({
    type: [
      {
        _id: false,
        id: Number,
        order: Number,
        size: Number,
        title: String,
        rule: String,
      },
    ],
    default: [],
  })
  chapter_list!: Array<{
    id: number;
    order: number;
    size: number;
    title: string;
    rule?: string;
  }>;

  @Prop()
  origin?: string;

  @Prop({ default: '' })
  comic_id!: string;

  @Prop({ default: '' })
  novel_id!: string;

  @Prop({ default: '' })
  other_id!: string;
}

export type BookDetailDocument = HydratedDocument<BookDetail>;
export type BookChapterDocument = HydratedDocument<BookChapter>;

export const BookDetailSchema = SchemaFactory.createForClass(BookDetail);
export const BookChapterSchema = SchemaFactory.createForClass(BookChapter);

const PUBLIC_BOOK_PARTIAL_FILTER = {
  review_status: ReviewStatus.APPROVED,
  visibility: Visibility.PUBLIC,
} as const;

BookDetailSchema.index({ user_id: 1, create_time: -1 });
BookDetailSchema.index({ update_time: -1 }, { partialFilterExpression: PUBLIC_BOOK_PARTIAL_FILTER });
BookDetailSchema.index(
  { part: 1, area: 1, status: 1, update_time: -1 },
  { partialFilterExpression: PUBLIC_BOOK_PARTIAL_FILTER },
);
BookDetailSchema.index(
  { favor_count: -1, reply_count: -1, view_count: -1, update_time: -1 },
  { partialFilterExpression: PUBLIC_BOOK_PARTIAL_FILTER },
);
BookDetailSchema.index(
  { favor_count: -1, reply_count: -1, view_count: -1, total: -1, update_time: -1 },
  { partialFilterExpression: PUBLIC_BOOK_PARTIAL_FILTER },
);
BookDetailSchema.index({ search_terms: 1 });
BookDetailSchema.index({ name: 'text', desc: 'text', author: 'text' });
BookChapterSchema.index({ book_id: 1 }, { unique: true });
