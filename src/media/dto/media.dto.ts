import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const MEDIA_TYPES = ['image', 'audio', 'zip'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const ZIP_UPLOAD_MODES = ['extract', 'direct'] as const;
export type ZipUploadMode = (typeof ZIP_UPLOAD_MODES)[number];

export const ZIP_DOWNLOAD_MODES = ['package', 'direct'] as const;
export type ZipDownloadMode = (typeof ZIP_DOWNLOAD_MODES)[number];

export class QueryMediaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsIn(MEDIA_TYPES)
  type?: MediaType;
}

export class UploadZipQueryDto {
  @IsOptional()
  @IsIn(ZIP_UPLOAD_MODES)
  mode?: ZipUploadMode = 'extract';
}

export class ResolveMediaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  mediaIds!: string[];
}

export class BatchImageDownloadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  mediaIds!: string[];
}

export class ZipMediaDownloadDto {
  @IsOptional()
  @IsIn(ZIP_DOWNLOAD_MODES)
  mode?: ZipDownloadMode = 'package';

  @ValidateIf((value: ZipMediaDownloadDto) => (value.mode ?? 'package') === 'package')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  mediaIds?: string[];

  @ValidateIf((value: ZipMediaDownloadDto) => (value.mode ?? 'package') === 'direct')
  @IsMongoId()
  mediaId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class DownloadMediaQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['inline', 'attachment'])
  disposition?: 'inline' | 'attachment';
}
