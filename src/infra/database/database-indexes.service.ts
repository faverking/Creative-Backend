import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';

interface IndexSyncResult {
  model: string;
  indexes: unknown;
}

@Injectable()
export class DatabaseIndexesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseIndexesService.name);
  private syncPromise?: Promise<IndexSyncResult[]>;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.configService.get<boolean>('mongo.syncIndexesOnBoot', false)) {
      return;
    }

    await this.syncIndexes('boot');
  }

  syncIndexes(trigger: 'boot' | 'script' = 'script'): Promise<IndexSyncResult[]> {
    if (!this.syncPromise) {
      this.syncPromise = this.runSync(trigger).finally(() => {
        this.syncPromise = undefined;
      });
    }

    return this.syncPromise;
  }

  private async runSync(trigger: 'boot' | 'script'): Promise<IndexSyncResult[]> {
    const models = Object.values(this.connection.models) as Array<Model<unknown>>;
    this.logger.log(`Starting MongoDB index sync (${trigger}), models=${models.length}`);

    const results: IndexSyncResult[] = [];
    for (const model of models) {
      const indexes = await model.syncIndexes();
      results.push({
        model: model.modelName,
        indexes,
      });
      this.logger.log(`Synced indexes for model ${model.modelName}`);
    }

    this.logger.log(`MongoDB index sync finished (${trigger})`);
    return results;
  }
}
