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
  ValidateNested,
} from 'class-validator';
import {
  CONTENT_LIST_SORTS,
  MEDIA_VARIANTS,
  type ContentListSort,
  type MediaVariant,
} from '../../common/constants/content-query.constants';
import { BOOK_STYLE_IDS } from '../../common/constants/content-taxonomy.constants';

class BookStyleDto {
  @IsInt()
  @IsIn(BOOK_STYLE_IDS)
  id!: number;

  @IsString()
  @Length(1, 40)
  name!: string;
}

class ChapterItemDto {
  @IsInt()
  id!: number;

  @IsInt()
  @Min(1)
  order!: number;

  @IsInt()
  @Min(0)
  size!: number;

  @IsString()
  @Length(1, 120)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  rule?: string;
}

export class CreateBookDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  author?: string[];

  @IsOptional()
  @IsInt()
  part?: 1 | 2 | 3;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookStyleDto)
  style?: BookStyleDto[];

  @IsOptional()
  @IsInt()
  status?: 1 | 2;

  @IsOptional()
  @IsInt()
  area?: 1 | 2 | 3;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @Length(1, 500)
  cover!: string;

  @IsString()
  @Length(2, 1000)
  desc!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  releaseTime?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ChapterItemDto)
  chapterList?: ChapterItemDto[];
}

export class UpdateBookDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  author?: string[];

  @IsOptional()
  @IsInt()
  part?: 1 | 2 | 3;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookStyleDto)
  style?: BookStyleDto[];

  @IsOptional()
  @IsInt()
  status?: 1 | 2;

  @IsOptional()
  @IsInt()
  area?: 1 | 2 | 3;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  cover?: string;

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  desc?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  releaseTime?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ChapterItemDto)
  chapterList?: ChapterItemDto[];
}

export class UpsertBookChaptersDto {
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ChapterItemDto)
  chapterList!: ChapterItemDto[];

  @IsOptional()
  @IsString()
  @Length(0, 200)
  origin?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  comicId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  novelId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  otherId?: string;
}

export class QueryBooksDto {
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
  part?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  area?: number;

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

export class QueryMyBooksDto {
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}
