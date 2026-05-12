import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';
import { MEDIA_TYPES, type MediaType } from '../dto/media.dto';

@Schema({ _id: false, versionKey: false })
export class MediaImageMeta {
  @Prop({ required: true })
  width!: number;

  @Prop({ required: true })
  height!: number;
}

const MediaImageMetaSchema = SchemaFactory.createForClass(MediaImageMeta);

@Schema({ _id: false, versionKey: false })
export class MediaImageVariant {
  @Prop({ required: true })
  fileName!: string;

  @Prop({ required: true })
  extension!: string;

  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true })
  size!: number;

  @Prop({ required: true })
  storageKey!: string;

  @Prop({ type: MediaImageMetaSchema, required: true })
  imageMeta!: MediaImageMeta;
}

const MediaImageVariantSchema = SchemaFactory.createForClass(MediaImageVariant);

@Schema({
  collection: 'media_assets',
  versionKey: false,
  timestamps: true,
})
export class MediaAsset {
  @Prop({ type: String, enum: MEDIA_TYPES, required: true, index: true })
  mediaType!: MediaType;

  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ required: true })
  originalName!: string;

  @Prop({ required: true })
  fileName!: string;

  @Prop({ required: true })
  extension!: string;

  @Prop({ required: true, index: true })
  mimeType!: string;

  @Prop({ required: true })
  size!: number;

  @Prop({ required: true, index: true })
  sha256!: string;

  @Prop({ required: true })
  storageProvider!: 'local';

  @Prop({ required: true })
  storageKey!: string;

  @Prop({ type: MediaImageMetaSchema })
  imageMeta?: MediaImageMeta;

  @Prop({ type: MediaImageVariantSchema })
  imagePreview?: MediaImageVariant;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MediaAssetDocument = HydratedDocument<MediaAsset>;
export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);

MediaAssetSchema.index({ mediaType: 1, createdAt: -1 });
MediaAssetSchema.index({ ownerId: 1, createdAt: -1 });
MediaAssetSchema.index({ mediaType: 1, sha256: 1 });
