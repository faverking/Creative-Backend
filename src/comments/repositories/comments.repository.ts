import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type ClientSession, type DeleteResult, type Model } from 'mongoose';
import { TargetType } from '../../common/enums/target-type.enum';
import { Comment, type CommentDocument, type CommentReply } from '../schemas/comment.schema';

@Injectable()
export class CommentsRepository {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
  ) {}

  async createMainComment(payload: Partial<Comment>, session?: ClientSession): Promise<CommentDocument> {
    const document = new this.commentModel(payload);
    return document.save({ session });
  }

  async listByTarget(
    targetType: TargetType,
    targetId: string,
    page: number,
    limit: number,
    replyLimit: number,
  ): Promise<{ items: CommentDocument[]; total: number }> {
    const condition = {
      target_type: targetType,
      target_id: new Types.ObjectId(targetId),
    };

    const [items, total] = await Promise.all([
      this.commentModel
        .find(condition, { replies: { $slice: -replyLimit } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.commentModel.countDocuments(condition).exec(),
    ]);

    return { items, total };
  }

  findById(id: string, session?: ClientSession): Promise<CommentDocument | null> {
    return this.commentModel.findById(id).session(session ?? null).exec();
  }

  appendReply(commentId: string, reply: CommentReply, session?: ClientSession): Promise<CommentDocument | null> {
    return this.commentModel
      .findByIdAndUpdate(
        commentId,
        {
          $push: { replies: reply },
          $inc: { reply_count: 1 },
        },
        {
          new: true,
          select: { replies: { $slice: -1 }, target_type: 1, target_id: 1, reply_count: 1 },
        },
      )
      .session(session ?? null)
      .exec();
  }

  async findReplies(commentId: string, limit: number): Promise<CommentReply[]> {
    const document = await this.commentModel.findById(commentId, { replies: { $slice: -limit } }).exec();
    return document?.replies ?? [];
  }

  async deleteByTarget(targetType: TargetType, targetId: string, session?: ClientSession): Promise<number> {
    const result: DeleteResult = await this.commentModel.deleteMany({
      target_type: targetType,
      target_id: new Types.ObjectId(targetId),
    }).session(session ?? null).exec();

    return result.deletedCount ?? 0;
  }
}
