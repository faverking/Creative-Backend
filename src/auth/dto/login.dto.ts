import { IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(2, 120)
  account!: string;

  @IsString()
  @MinLength(8)
  @Length(8, 72)
  password!: string;
}
