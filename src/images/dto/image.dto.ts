import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  MEDIA_VARIANTS,
  type ContentListSort,
  type MediaVariant,
} from '../../common/constants/content-query.constants';

export class CreateImagePackageDto {
  @IsString()
  @Length(1, 120)
  title!: string;

  @IsString()
  @Length(2, 1000)
  desc!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  images!: string[];

  @IsOptional()
  @IsInt()
  themeId?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  cover?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  source?: string;
}

export class UpdateImagePackageDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  desc?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsInt()
  themeId?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  cover?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  source?: string;
}

export class QueryImagePackagesDto {
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
  @Length(0, 120)
  keyword?: string;

  @IsOptional()
  @IsIn(CONTENT_LIST_SORTS)
  sort?: ContentListSort = 'latest';

  @IsOptional()
  @IsIn(MEDIA_VARIANTS)
  mediaVariant?: MediaVariant = 'download';
}

export class QueryMyImagePackagesDto {
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
  themeId?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}
