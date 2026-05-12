import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { IDEMPOTENCY_TTL_KEY } from '../decorators/idempotency.decorator';
import { RedisService } from '../../infra/redis/redis.service';
import { JwtUser } from '../interfaces/jwt-user.interface';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ttl = this.reflector.getAllAndOverride<number>(IDEMPOTENCY_TTL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!ttl || ttl <= 0) {
      return next.handle();
    }

    if (!this.redisService.isEnabled()) {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; method: string; path: string; user?: JwtUser; ip?: string }>();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) {
      return next.handle();
    }

    const key = request.headers['idempotency-key'];
    if (!key) {
      throw new BadRequestException('Missing Idempotency-Key header');
    }

    const principal = request.user?.userId ?? request.ip ?? 'anonymous';
    const redisKey = `idempotency:${principal}:${request.method}:${request.path}:${key}`;

    return new Observable((subscriber) => {
      void (async () => {
        const cached = await this.redisService.get<string>(redisKey);
        if (cached) {
          subscriber.next(JSON.parse(cached));
          subscriber.complete();
          return;
        }

        next
          .handle()
          .pipe(
            tap((result) => {
              void this.redisService.set(redisKey, JSON.stringify(result), ttl);
            }),
          )
          .subscribe({
            next: (value) => subscriber.next(value),
            error: (error) => subscriber.error(error),
            complete: () => subscriber.complete(),
          });
      })().catch((error: unknown) => subscriber.error(error));
    });
  }
}
