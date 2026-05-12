import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { DEFAULT_FEATURED_RANK, DEFAULT_FEATURED_SCENE } from '../../common/constants/featured-content.constants';
import { TargetType } from '../../common/enums/target-type.enum';
import { toBoolean } from '../../common/utils/query-transform.util';

export class UpsertFeaturedContentDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  scene?: string = DEFAULT_FEATURED_SCENE;

  @IsEnum(TargetType)
  targetType!: TargetType;

  @IsMongoId()
  targetId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999)
  rank?: number = DEFAULT_FEATURED_RANK;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  enabled?: boolean = true;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  note?: string;
}

export class CancelFeaturedContentDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  scene?: string = DEFAULT_FEATURED_SCENE;

  @IsEnum(TargetType)
  targetType!: TargetType;

  @IsMongoId()
  targetId!: string;
}

export class QueryFeaturedContentsDto {
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

  @IsOptional()
  @IsEnum(TargetType)
  targetType?: TargetType;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  activeOnly?: boolean = false;
}
