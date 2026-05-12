import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsByteLength,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  CONTENT_LIST_SORTS,
  type ContentListSort,
} from '../../common/constants/content-query.constants';
import { CONTENT_BYTE_LIMITS } from '../../common/constants/content-limits';
import { TOPIC_FEATURE_FLAG_IDS } from '../../common/constants/content-taxonomy.constants';
import { toBoolean, toNumberArray } from '../../common/utils/query-transform.util';

export class CreateTopicDto {
  @IsInt()
  topicId!: number;

  @IsInt()
  typeId!: number;

  @IsString()
  @Length(1, 120)
  title!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  images?: string[];

  @IsString()
  @IsByteLength(CONTENT_BYTE_LIMITS.topic.min, CONTENT_BYTE_LIMITS.topic.max)
  content!: string;

  @IsString()
  @Length(2, 1000)
  desc!: string;

  @IsString()
  @Length(1, 500)
  downloadUrl!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(TOPIC_FEATURE_FLAG_IDS, { each: true })
  featureFlags!: number[];
}

export class UpdateTopicDto {
  @IsOptional()
  @IsInt()
  topicId?: number;

  @IsOptional()
  @IsInt()
  typeId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  @IsByteLength(CONTENT_BYTE_LIMITS.topic.min, CONTENT_BYTE_LIMITS.topic.max)
  content?: string;

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  desc?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  downloadUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(TOPIC_FEATURE_FLAG_IDS, { each: true })
  featureFlags?: number[];
}

export class QueryTopicsDto {
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
  @Type(() => Number)
  @IsInt()
  topicId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  typeId?: number;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  keyword?: string;

  @IsOptional()
  @IsIn(CONTENT_LIST_SORTS)
  sort?: ContentListSort = 'latest';

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  includeAuthor?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => toNumberArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(TOPIC_FEATURE_FLAG_IDS, { each: true })
  featureFlags?: number[];
}

export class QueryMyTopicsDto {
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
  @Length(0, 120)
  title?: string;

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
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(TOPIC_FEATURE_FLAG_IDS, { each: true })
  featureFlags?: number[];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}


