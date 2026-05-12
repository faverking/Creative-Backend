import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum NotificationKind {
  COMMENT = 'comment',
  REPLY = 'reply',
}

export class QueryNotificationsDto {
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
  @IsEnum(NotificationKind)
  kind?: NotificationKind;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unread?: boolean;
}
