import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { catchError, isObservable, of, type Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
      const authorization = request.headers?.authorization;
      const bearerToken = Array.isArray(authorization) ? authorization[0] : authorization;
      const hasBearerToken = typeof bearerToken === 'string' && bearerToken.startsWith('Bearer ');

      if (!hasBearerToken) {
        return true;
      }

      const activation = super.canActivate(context);
      if (activation instanceof Promise) {
        return activation.catch(() => true);
      }

      if (isObservable(activation)) {
        return activation.pipe(catchError(() => of(true)));
      }

      return activation;
    }

    return super.canActivate(context) as boolean | Promise<boolean> | Observable<boolean>;
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser | undefined {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return err ? undefined : user;
    }

    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
