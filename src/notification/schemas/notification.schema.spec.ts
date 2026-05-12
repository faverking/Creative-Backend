import 'reflect-metadata';
import { Types, deleteModel, model } from 'mongoose';
import { NotificationKind } from '../dto/query-notifications.dto';
import { Notification, NotificationSchema } from './notification.schema';

describe('NotificationSchema', () => {
  it('allows actor snapshots without avatar urls', () => {
    deleteModel(/Notification/);
    const NotificationModel = model(Notification.name, NotificationSchema);
    const document = new NotificationModel({
      user_id: new Types.ObjectId('507f1f77bcf86cd799439021'),
      kind: NotificationKind.COMMENT,
      actor: {
        userId: new Types.ObjectId('507f1f77bcf86cd799439022'),
        name: 'Mono',
      },
      target_type: 'article',
      target_id: '507f1f77bcf86cd799439011',
      excerpt: 'Comment excerpt',
      unread: true,
    });

    expect(document.validateSync()).toBeUndefined();
    expect(document.actor.avatarUrl).toBe('');

    deleteModel(/Notification/);
  });
});
