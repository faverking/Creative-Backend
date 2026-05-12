import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtUser } from '../interfaces/jwt-user.interface';

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUser | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    return request.user;
  },
);
