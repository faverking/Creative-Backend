import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InteractionsModule } from '../interactions/interactions.module';
import { FeaturedContentsController } from './featured-contents.controller';
import { FeaturedContentsRepository } from './repositories/featured-contents.repository';
import { FeaturedContent, FeaturedContentSchema } from './schemas/featured-content.schema';
import { FeaturedContentsService } from './featured-contents.service';

@Module({
  imports: [
    InteractionsModule,
    MongooseModule.forFeature([
      {
        name: FeaturedContent.name,
        schema: FeaturedContentSchema,
      },
    ]),
  ],
  controllers: [FeaturedContentsController],
  providers: [FeaturedContentsService, FeaturedContentsRepository],
  exports: [FeaturedContentsService],
})
export class FeaturedContentsModule {}
