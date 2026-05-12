import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '../../common/enums/user-status.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { UsersService } from '../../users/users.service';

interface AccessTokenPayload {
  sub: string;
  pv: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret', ''),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<JwtUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is blocked or deleted');
    }

    if (user.passwordVersion !== payload.pv) {
      throw new UnauthorizedException('Token expired due to password change');
    }

    return {
      userId: user.id,
      roles: user.roles,
      passwordVersion: user.passwordVersion,
      status: user.status,
      name: user.name,
    };
  }
}