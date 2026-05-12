import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import {
  CONTENT_LIST_SORTS,
  type ContentListSort,
} from '../../common/constants/content-query.constants';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { toBoolean } from '../../common/utils/query-transform.util';

export class QueryArticlesDto {
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
  themeId?: number;

  @IsOptional()
  @IsString()
  userId?: string;

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

}

export class QueryMyArticlesDto {
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
  @Matches(/^.{0,120}$/)
  title?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

