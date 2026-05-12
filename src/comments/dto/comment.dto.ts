import { Type } from 'class-transformer';
import { IsByteLength, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';
import { CONTENT_BYTE_LIMITS } from '../../common/constants/content-limits';

export class CreateCommentDto {
  @IsString()
  @IsByteLength(CONTENT_BYTE_LIMITS.comment.min, CONTENT_BYTE_LIMITS.comment.max)
  content!: string;
}

export class ReplyCommentDto {
  @IsString()
  @IsByteLength(CONTENT_BYTE_LIMITS.comment.min, CONTENT_BYTE_LIMITS.comment.max)
  content!: string;

  @IsOptional()
  @IsMongoId()
  mentionUserId?: string;
}

export class QueryCommentsDto {
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
  @Min(1)
  @Max(50)
  replyLimit?: number = 10;
}

export class QueryRepliesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
