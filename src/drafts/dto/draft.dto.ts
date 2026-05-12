import { Type } from 'class-transformer';
import { IsByteLength, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CONTENT_BYTE_LIMITS } from '../../common/constants/content-limits';

export class CreateDraftDto {
  @IsInt()
  themeId!: number;

  @IsString()
  @Length(1, 120)
  title!: string;

  @IsString()
  @IsByteLength(CONTENT_BYTE_LIMITS.draft.min, CONTENT_BYTE_LIMITS.draft.max)
  content!: string;
}

export class UpdateDraftDto {
  @IsOptional()
  @IsInt()
  themeId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @IsString()
  @IsByteLength(CONTENT_BYTE_LIMITS.draft.min, CONTENT_BYTE_LIMITS.draft.max)
  content?: string;
}

export class QueryMyDraftsDto {
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
}
