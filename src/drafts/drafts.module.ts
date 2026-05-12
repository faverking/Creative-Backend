import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DraftsApplicationService } from './application/drafts.application';
import { DraftsController } from './drafts.controller';
import { DraftsRepository } from './repositories/drafts.repository';
import { Draft, DraftSchema } from './schemas/draft.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Draft.name,
        schema: DraftSchema,
      },
    ]),
  ],
  controllers: [DraftsController],
  providers: [DraftsApplicationService, DraftsRepository],
  exports: [DraftsApplicationService],
})
export class DraftsModule {}
