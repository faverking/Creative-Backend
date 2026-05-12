import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private enabled = false;
  private hasReportedConnectionError = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.enabled = this.configService.get<boolean>('redis.enabled', false);
    const url = this.configService.get<string>('redis.url', '');

    if (!this.enabled || !url) {
      this.logger.log('Redis disabled by config');
      return;
    }

    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

    client.on('error', (error) => {
      this.reportConnectionError(`Redis error: ${(error as Error).message}`);
    });

    this.client = client;

    try {
      await client.connect();
      this.logger.log('Redis connected');
    } catch (error) {
      this.reportConnectionError(`Redis unavailable, continue without cache: ${(error as Error).message}`);
      client.disconnect(false);
      this.client = null;
      this.enabled = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    this.client.removeAllListeners('error');

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect(false);
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    const reply = await this.client.ping();
    return reply === 'PONG';
  }

  async get<T = string>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    const value = await this.client.get(key);
    return value as T | null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) {
      return;
    }

    if (!ttlSeconds || ttlSeconds <= 0) {
      await this.client.set(key, value);
      return;
    }

    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    const reply = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return reply === 'OK';
  }

  async del(key: string): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.del(key);
  }

  async releaseIfEquals(key: string, expectedValue: string): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
      1,
      key,
      expectedValue,
    );
  }

  private reportConnectionError(message: string): void {
    if (this.hasReportedConnectionError) {
      return;
    }

    this.hasReportedConnectionError = true;
    this.logger.warn(message);
  }
}
