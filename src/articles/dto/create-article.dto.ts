import { IsArray, IsByteLength, IsEnum, IsInt, IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { CONTENT_BYTE_LIMITS } from '../../common/constants/content-limits';
import { ContentStatus } from '../../common/enums/content-status.enum';

export class CreateArticleDto {
  @IsString()
  @Length(2, 120)
  title!: string;

  @IsString()
  @Length(2, 500)
  desc!: string;

  @IsString()
  @IsByteLength(CONTENT_BYTE_LIMITS.article.min, CONTENT_BYTE_LIMITS.article.max)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  images?: string[];

  @IsInt()
  themeId!: number;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  desc?: string;

  @IsOptional()
  @IsString()
  @IsByteLength(CONTENT_BYTE_LIMITS.article.min, CONTENT_BYTE_LIMITS.article.max)
  content?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  images?: string[];

  @IsOptional()
  @IsInt()
  themeId?: number;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}
