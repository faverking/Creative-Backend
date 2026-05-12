import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '../common/enums/user-status.enum';
import { sanitizeAvatarUrl } from '../common/utils/avatar-url.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersRepository } from './repositories/users.repository';
import type { OAuthAccount, User, UserDocument } from './schemas/user.schema';

export interface UserSafeProfile {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  roles: string[];
  avatarUrl: string;
  bio: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUserProfile {
  id: string;
  name: string;
  avatarUrl: string;
  bio: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string): Promise<UserDocument | null> {
    return this.usersRepository.findById(id);
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.usersRepository.findByEmail(email);
  }

  findByAccount(account: string): Promise<UserDocument | null> {
    return this.usersRepository.findByAccount(account);
  }

  findByOAuthAccount(provider: string, providerUserId: string): Promise<UserDocument | null> {
    return this.usersRepository.findByOAuthAccount(provider, providerUserId);
  }

  existsByEmailOrName(email: string, name: string): Promise<boolean> {
    return this.usersRepository.existsByEmailOrName(email, name);
  }

  create(payload: Partial<User>): Promise<UserDocument> {
    return this.usersRepository.create(payload);
  }

  async linkOAuthAccount(userId: string, account: OAuthAccount): Promise<UserDocument> {
    const current = await this.usersRepository.findById(userId);
    if (!current) {
      throw new NotFoundException('User not found');
    }

    const alreadyLinked = current.oauthAccounts.some(
      (item) => item.provider === account.provider && item.providerUserId === account.providerUserId,
    );

    if (!alreadyLinked) {
      await this.usersRepository.addOAuthAccount(userId, account);
    }

    const updated = await this.usersRepository.findById(userId);
    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return updated;
  }

  async getSafeProfileById(id: string): Promise<UserSafeProfile> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeProfile(user);
  }

  async getPublicProfileById(id: string): Promise<PublicUserProfile> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toPublicProfile(user);
  }

  async getSafeProfileMap(ids: string[]): Promise<Map<string, UserSafeProfile>> {
    const uniqueIds = Array.from(new Set(ids.filter((id) => id.trim().length > 0)));
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const users = await this.usersRepository.findByIds(uniqueIds);
    return new Map(users.map((user) => [user.id, this.toSafeProfile(user)]));
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserSafeProfile> {
    if (dto.name) {
      const existing = await this.usersRepository.findByName(dto.name);
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Username already exists');
      }
    }

    await this.usersRepository.updateOne({ _id: userId }, dto);
    const updated = await this.usersRepository.findById(userId);
    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeProfile(updated);
  }

  async reserveAvailableName(preferredName: string): Promise<string> {
    const normalized = this.normalizeName(preferredName);
    let suffix = 0;
    let candidate = normalized;

    while (await this.usersRepository.findByName(candidate)) {
      suffix += 1;
      candidate = this.withSuffix(normalized, suffix);
    }

    return candidate;
  }

  async setStatus(userId: string, status: UserStatus): Promise<UserSafeProfile> {
    await this.usersRepository.updateOne({ _id: userId }, { status });
    return this.getSafeProfileById(userId);
  }

  async updateLastLogin(userId: string, ip: string): Promise<void> {
    await this.usersRepository.updateOne(
      { _id: userId },
      {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    );
  }

  toSafeProfile(user: UserDocument): UserSafeProfile {
    return {
      ...this.toPublicProfile(user),
      email: user.email,
      status: user.status,
      roles: user.roles,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  toPublicProfile(user: UserDocument): PublicUserProfile {
    return {
      id: user.id,
      name: user.name,
      avatarUrl: sanitizeAvatarUrl(user.avatarUrl),
      bio: user.bio,
    };
  }

  private normalizeName(raw: string): string {
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    const base = trimmed.length >= 2 ? trimmed : 'user';
    return base.slice(0, 40);
  }

  private withSuffix(base: string, suffix: number): string {
    const suffixText = `_${suffix}`;
    const availableLength = Math.max(2, 40 - suffixText.length);
    return `${base.slice(0, availableLength)}${suffixText}`;
  }
}
