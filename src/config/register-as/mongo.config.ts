import { registerAs } from '@nestjs/config';

export default registerAs('mongo', () => ({
  uri: process.env.MONGO_URI,
  dbName: process.env.MONGO_DB_NAME ?? 'mononest',
  syncIndexesOnBoot: process.env.MONGO_SYNC_INDEXES_ON_BOOT === 'true',
}));
