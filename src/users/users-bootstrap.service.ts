import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserStatus } from '../common/enums/user-status.enum';
import { UsersRepository } from './repositories/users.repository';
import { SYSTEM_SUPER_ADMIN } from './constants/system-users.constants';

@Injectable()
export class UsersBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersBootstrapService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureSystemSuperAdmin();
  }

  private async ensureSystemSuperAdmin(): Promise<void> {
    const email = SYSTEM_SUPER_ADMIN.email.toLowerCase();
    const existingByEmail = await this.usersRepository.findByEmail(email);

    if (!existingByEmail) {
      await this.createSystemSuperAdmin(email);
      return;
    }

    const updates: Record<string, unknown> = {};

    if (existingByEmail.name !== SYSTEM_SUPER_ADMIN.name) {
      updates.name = SYSTEM_SUPER_ADMIN.name;
    }

    if (existingByEmail.status !== UserStatus.ACTIVE) {
      updates.status = UserStatus.ACTIVE;
    }

    if (!this.hasSameRoles(existingByEmail.roles, SYSTEM_SUPER_ADMIN.roles)) {
      updates.roles = [...SYSTEM_SUPER_ADMIN.roles];
    }

    const passwordMatched = await argon2.verify(existingByEmail.passwordHash, SYSTEM_SUPER_ADMIN.password);
    if (!passwordMatched) {
      updates.passwordHash = await this.hashSystemSuperAdminPassword();
      updates.passwordVersion = Math.max(existingByEmail.passwordVersion ?? 1, 1) + 1;
    }

    if (Object.keys(updates).length === 0) {
      this.logger.log(`System super admin is ready: ${email}`);
      return;
    }

    await this.usersRepository.updateOne({ _id: existingByEmail._id }, updates);
    this.logger.log(`System super admin synchronized: ${email}`);
  }

  private async createSystemSuperAdmin(email: string): Promise<void> {
    const conflictingNameUser = await this.usersRepository.findByName(SYSTEM_SUPER_ADMIN.name);
    if (conflictingNameUser) {
      throw new Error(
        `Cannot create system super admin because username "${SYSTEM_SUPER_ADMIN.name}" is already used by ${conflictingNameUser.email}`,
      );
    }

    await this.usersRepository.create({
      email,
      name: SYSTEM_SUPER_ADMIN.name,
      passwordHash: await this.hashSystemSuperAdminPassword(),
      passwordVersion: 1,
      status: UserStatus.ACTIVE,
      roles: [...SYSTEM_SUPER_ADMIN.roles],
      oauthAccounts: [],
    });

    this.logger.log(`System super admin created: ${email}`);
  }

  private hasSameRoles(currentRoles: string[], expectedRoles: readonly string[]): boolean {
    if (currentRoles.length !== expectedRoles.length) {
      return false;
    }

    return expectedRoles.every((role) => currentRoles.includes(role));
  }

  private hashSystemSuperAdminPassword(): Promise<string> {
    return argon2.hash(SYSTEM_SUPER_ADMIN.password, { type: argon2.argon2id });
  }
}
