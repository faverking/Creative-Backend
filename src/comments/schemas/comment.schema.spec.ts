import 'reflect-metadata';
import { Types, deleteModel, model } from 'mongoose';
import { Comment, CommentSchema } from './comment.schema';

describe('CommentSchema', () => {
  it('allows author snapshots without avatar urls', () => {
    deleteModel(/Comment/);
    const CommentModel = model(Comment.name, CommentSchema);
    const document = new CommentModel({
      target_type: 'article',
      target_id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      author: {
        userId: new Types.ObjectId('507f1f77bcf86cd799439021'),
        name: 'Mono',
      },
      user_id: new Types.ObjectId('507f1f77bcf86cd799439021'),
      content: 'Comment content',
    });

    expect(document.validateSync()).toBeUndefined();
    expect(document.author.avatarUrl).toBe('');

    deleteModel(/Comment/);
  });
});
