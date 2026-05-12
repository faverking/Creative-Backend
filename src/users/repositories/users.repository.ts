import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { BaseRepository } from '../../infra/database/base.repository';
import { User, type OAuthAccount, type UserDocument } from '../schemas/user.schema';

@Injectable()
export class UsersRepository extends BaseRepository<UserDocument> {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {
    super(userModel);
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findByIds(ids: string[]): Promise<UserDocument[]> {
    return this.userModel.find({ _id: { $in: ids } }).exec();
  }

  findByName(name: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ name }).exec();
  }

  findByAccount(account: string): Promise<UserDocument | null> {
    const condition: FilterQuery<UserDocument> = {
      $or: [{ email: account.toLowerCase() }, { name: account }],
    };

    return this.userModel.findOne(condition).exec();
  }

  findByOAuthAccount(provider: string, providerUserId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        oauthAccounts: {
          $elemMatch: {
            provider,
            providerUserId,
          },
        },
      })
      .exec();
  }

  existsByEmailOrName(email: string, name: string): Promise<boolean> {
    return this.userModel
      .exists({
        $or: [{ email: email.toLowerCase() }, { name }],
      })
      .then((result) => Boolean(result));
  }

  async addOAuthAccount(userId: string, account: OAuthAccount): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $push: { oauthAccounts: account } }).exec();
  }
}
