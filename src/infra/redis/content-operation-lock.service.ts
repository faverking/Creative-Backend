import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { TargetType } from '../../common/enums/target-type.enum';
import { RedisService } from './redis.service';

@Injectable()
export class ContentOperationLockService {
  private readonly localLocks = new Map<string, string>();

  constructor(private readonly redisService: RedisService) {}

  runWithContentLock<T>(
    targetType: TargetType,
    targetId: string,
    handler: () => Promise<T>,
    ttlSeconds = 300,
  ): Promise<T> {
    return this.runWithLock(`content:${targetType}:${targetId}`, handler, ttlSeconds);
  }

  runWithMediaLock<T>(mediaId: string, handler: () => Promise<T>, ttlSeconds = 180): Promise<T> {
    return this.runWithLock(`media:image:${mediaId}`, handler, ttlSeconds);
  }

  private async runWithLock<T>(lockName: string, handler: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const token = randomUUID();
    const acquired = await this.acquire(lockName, token, ttlSeconds);
    if (!acquired) {
      throw new ConflictException('Resource operation is already in progress');
    }

    try {
      return await handler();
    } finally {
      await this.release(lockName, token);
    }
  }

  private async acquire(lockName: string, token: string, ttlSeconds: number): Promise<boolean> {
    if (this.redisService.isEnabled()) {
      return this.redisService.setIfAbsent(lockName, token, ttlSeconds);
    }

    if (this.localLocks.has(lockName)) {
      return false;
    }

    this.localLocks.set(lockName, token);
    return true;
  }

  private async release(lockName: string, token: string): Promise<void> {
    if (this.redisService.isEnabled()) {
      await this.redisService.releaseIfEquals(lockName, token);
      return;
    }

    if (this.localLocks.get(lockName) === token) {
      this.localLocks.delete(lockName);
    }
  }
}
