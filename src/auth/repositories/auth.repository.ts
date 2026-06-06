import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserSession, type UserSessionDocument } from '../schemas/user-session.schema';

interface UpdateSessionPayload {
  refresh_token_hash?: string;
  expire_at?: Date;
  ip?: string;
  ua?: string;
  revoked_at?: Date;
}

@Injectable()
export class AuthRepository {
  constructor(
    @InjectModel(UserSession.name)
    private readonly userSessionModel: Model<UserSessionDocument>,
  ) {}

  createSession(payload: Partial<UserSession>): Promise<UserSessionDocument> {
    return this.userSessionModel.create(payload);
  }

  findSessionById(id: string): Promise<UserSessionDocument | null> {
    return this.userSessionModel.findById(id).exec();
  }

  async updateSession(id: string, payload: UpdateSessionPayload): Promise<void> {
    await this.userSessionModel.updateOne({ _id: id }, payload).exec();
  }

  async updateActiveSessionIfRefreshTokenHashMatches(
    id: string,
    expectedRefreshTokenHash: string,
    payload: UpdateSessionPayload,
  ): Promise<boolean> {
    const result = await this.userSessionModel
      .updateOne(
        {
          _id: id,
          refresh_token_hash: expectedRefreshTokenHash,
          revoked_at: { $exists: false },
          expire_at: { $gt: new Date() },
        },
        payload,
      )
      .exec();

    return result.matchedCount > 0;
  }

  async listUserSessions(userId: string): Promise<UserSessionDocument[]> {
    return this.userSessionModel
      .find({ user_id: new Types.ObjectId(userId) })
      .sort({ created_at: -1 })
      .exec();
  }
}
