import { IsArray, IsOptional, IsString, Length } from 'class-validator';

export class AuthorizeDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  anyRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  allRoles?: string[];
}
