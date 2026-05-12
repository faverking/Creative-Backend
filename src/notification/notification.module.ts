import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspaceModule } from '../workspace/workspace.module';
import { NotificationController } from './notification.controller';
import { NotificationRepository } from './repositories/notification.repository';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    WorkspaceModule,
    MongooseModule.forFeature([
      {
        name: Notification.name,
        schema: NotificationSchema,
      },
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository],
  exports: [NotificationService, NotificationRepository],
})
export class NotificationModule {}
