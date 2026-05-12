import { IsEnum } from 'class-validator';
import { UserStatus } from '../../common/enums/user-status.enum';

export class SetUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
