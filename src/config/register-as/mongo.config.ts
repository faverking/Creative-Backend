import { registerAs } from '@nestjs/config';

function resolveBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

export default registerAs('mongo', () => ({
  uri: process.env.MONGO_URI,
  dbName: process.env.MONGO_DB_NAME ?? 'mononest',
  syncIndexesOnBoot: process.env.MONGO_SYNC_INDEXES_ON_BOOT === 'true',
  requireTransactions: resolveBoolean(
    process.env.MONGO_REQUIRE_TRANSACTIONS,
    process.env.NODE_ENV === 'production',
  ),
}));
