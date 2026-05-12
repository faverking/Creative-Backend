import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspaceModule } from '../workspace/workspace.module';
import { HistoryController } from './history.controller';
import { HistoryRepository } from './repositories/history.repository';
import { HistoryEntry, HistoryEntrySchema } from './schemas/history-entry.schema';
import { HistoryService } from './history.service';

@Module({
  imports: [
    WorkspaceModule,
    MongooseModule.forFeature([
      {
        name: HistoryEntry.name,
        schema: HistoryEntrySchema,
      },
    ]),
  ],
  controllers: [HistoryController],
  providers: [HistoryService, HistoryRepository],
  exports: [HistoryService, HistoryRepository],
})
export class HistoryModule {}
