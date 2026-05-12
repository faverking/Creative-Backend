import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_TTL_KEY = 'idempotencyTtl';
export const Idempotent = (ttlSeconds = 60): MethodDecorator & ClassDecorator =>
  SetMetadata(IDEMPOTENCY_TTL_KEY, ttlSeconds);
