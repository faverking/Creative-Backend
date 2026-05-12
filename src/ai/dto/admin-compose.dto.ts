import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TOPIC_FEATURE_FLAG_IDS } from '../../common/constants/content-taxonomy.constants';
import { TargetType } from '../../common/enums/target-type.enum';
import { ADMIN_AI_TASKS, ADMIN_AI_TONES } from '../ai.types';

class AdminComposeChapterSnapshotDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  rule?: string;
}

export class AdminComposeSourceDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  selectionText?: string;

  @IsOptional()
  @IsString()
  selectionPrefix?: string;

  @IsOptional()
  @IsString()
  selectionSuffix?: string;

  @IsOptional()
  @IsString()
  cursorPrefix?: string;

  @IsOptional()
  @IsString()
  cursorSuffix?: string;

  @IsOptional()
  @IsInt()
  themeId?: number;

  @IsOptional()
  @IsInt()
  topicId?: number;

  @IsOptional()
  @IsInt()
  typeId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(TOPIC_FEATURE_FLAG_IDS, { each: true })
  featureFlags?: number[];

  @IsOptional()
  @IsString()
  @Length(1, 500)
  downloadUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  author?: string[];

  @IsOptional()
  @IsInt()
  part?: number;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  @IsInt()
  area?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AdminComposeChapterSnapshotDto)
  chapterList?: AdminComposeChapterSnapshotDto[];

  @IsOptional()
  @IsString()
  @Length(1, 120)
  source?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  imageCount?: number;
}

export class AdminComposeOptionsDto {
  @IsOptional()
  @IsIn(ADMIN_AI_TONES)
  tone?: (typeof ADMIN_AI_TONES)[number];

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(120)
  maxTitleLength?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(1000)
  maxSummaryLength?: number;

  @IsOptional()
  @IsBoolean()
  includeReasons?: boolean;
}

export class AdminComposeRequestDto {
  @IsIn(Object.values(TargetType))
  contentType!: TargetType;

  @IsIn(ADMIN_AI_TASKS)
  task!: (typeof ADMIN_AI_TASKS)[number];

  @ValidateNested()
  @Type(() => AdminComposeSourceDto)
  source!: AdminComposeSourceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminComposeOptionsDto)
  options?: AdminComposeOptionsDto;
}
