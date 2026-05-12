import { Global, Module } from '@nestjs/common';
import { ContentOperationLockService } from './content-operation-lock.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, ContentOperationLockService],
  exports: [RedisService, ContentOperationLockService],
})
export class RedisModule {}
