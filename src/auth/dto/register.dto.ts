import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 40)
  name!: string;

  @IsString()
  @MinLength(8)
  @Length(8, 72)
  password!: string;
}
