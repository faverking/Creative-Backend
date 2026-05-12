import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { DEFAULT_FEATURED_SCENE } from '../../common/constants/featured-content.constants';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { TargetType } from '../../common/enums/target-type.enum';
import { Visibility } from '../../common/enums/visibility.enum';
import { TOPIC_FEATURE_FLAG_IDS } from '../../common/constants/content-taxonomy.constants';
import { toBoolean, toNumberArray } from '../../common/utils/query-transform.util';

export const ADMIN_CONTENT_SORTS = ['latest', 'hot'] as const;
export type AdminContentSort = (typeof ADMIN_CONTENT_SORTS)[number];

export class QueryAdminContentSummaryDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  scene?: string = DEFAULT_FEATURED_SCENE;
}

export class QueryAdminContentsDto {
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
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  scene?: string = DEFAULT_FEATURED_SCENE;

  @IsEnum(TargetType)
  type!: TargetType;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  keyword?: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional()
  @IsEnum(ReviewStatus)
  reviewStatus?: ReviewStatus;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  deleted?: boolean = false;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  themeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  topicId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  typeId?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberArray(value))
  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(TOPIC_FEATURE_FLAG_IDS, { each: true })
  featureFlags?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  part?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  area?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bookStatus?: number;

  @IsOptional()
  @IsIn(ADMIN_CONTENT_SORTS)
  sort?: AdminContentSort = 'latest';
}

export class QueryAdminContentDetailDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  scene?: string = DEFAULT_FEATURED_SCENE;
}

export class DeleteAdminContentDto {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  cascadeMedia?: boolean = false;
}
