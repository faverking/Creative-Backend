import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseIndexesService } from './database-indexes.service';
import { MongoTransactionService } from './mongo-transaction.service';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongo.uri', ''),
        dbName: configService.get<string>('mongo.dbName', 'mononest'),
      }),
    }),
  ],
  providers: [DatabaseIndexesService, MongoTransactionService],
  exports: [MongooseModule, DatabaseIndexesService, MongoTransactionService],
})
export class MongoModule {}
