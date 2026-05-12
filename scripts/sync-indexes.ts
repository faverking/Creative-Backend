import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseIndexesService } from '../src/infra/database/database-indexes.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const indexesService = app.get(DatabaseIndexesService);
    const results = await indexesService.syncIndexes('script');
    for (const result of results) {
      console.log(`[sync-indexes] ${result.model}: ${JSON.stringify(result.indexes)}`);
    }
  } finally {
    await app.close();
  }
}

void main();
