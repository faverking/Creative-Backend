import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { toBoolean, toStringArray } from '../../common/utils/query-transform.util';

export const SEARCH_SCOPES = ['all', 'articles', 'books', 'images', 'topics'] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

export const FEATURED_CONTENT_TYPES = ['article', 'topic', 'book', 'image'] as const;
export type FeaturedContentType = (typeof FEATURED_CONTENT_TYPES)[number];

export class FullTextSearchDto {
  @IsString()
  @Length(1, 120)
  q!: string;

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
  @IsEnum(SEARCH_SCOPES)
  scope?: SearchScope = 'all';
}

export class QuickSearchDto {
  @IsString()
  @Length(1, 120)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 8;
}

export class RelatedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 6;
}

export class FeaturedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  limit?: number = 8;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsEnum(FEATURED_CONTENT_TYPES, { each: true })
  types?: FeaturedContentType[];

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  groupByType?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  perTypeLimit?: number;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  includeAuthor?: boolean = false;
}
