import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { TargetType } from '../../common/enums/target-type.enum';

export class ToggleFavoriteDto {
  @IsEnum(TargetType)
  targetType!: TargetType;

  @IsString()
  @Length(1, 64)
  targetId!: string;
}

export class QueryMyFavoritesDto {
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
  @IsEnum(TargetType)
  targetType?: TargetType;
}
