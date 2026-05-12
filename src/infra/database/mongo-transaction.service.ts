import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { ClientSession, Connection } from 'mongoose';

@Injectable()
export class MongoTransactionService implements OnModuleInit {
  private readonly logger = new Logger(MongoTransactionService.name);
  private transactionSupportResolved = false;
  private transactionSupported = false;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit(): Promise<void> {
    await this.resolveTransactionSupport();
  }

  async runInTransaction<T>(handler: (session?: ClientSession) => Promise<T>): Promise<T> {
    if (!(await this.resolveTransactionSupport())) {
      return handler(undefined);
    }

    const session = await this.connection.startSession();

    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await handler(session);
      });

      return result;
    } catch (error) {
      if (this.isTransactionUnsupportedError(error)) {
        this.transactionSupportResolved = true;
        this.transactionSupported = false;
        this.logger.warn('Mongo transaction is not supported by the current deployment, fallback to non-transactional execution.');
        return handler(undefined);
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async resolveTransactionSupport(): Promise<boolean> {
    if (this.transactionSupportResolved) {
      return this.transactionSupported;
    }

    try {
      const database = this.connection.db;
      if (!database) {
        this.transactionSupported = false;
        return this.transactionSupported;
      }

      const hello = await database.admin().command({ hello: 1 });
      this.transactionSupported = hello?.msg === 'isdbgrid' || typeof hello?.setName === 'string';
    } catch (error) {
      this.transactionSupported = false;
      this.logger.warn(
        `Failed to detect Mongo transaction capability, fallback to non-transactional execution: ${this.formatError(error)}`,
      );
    }

    this.transactionSupportResolved = true;
    return this.transactionSupported;
  }

  private isTransactionUnsupportedError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.includes('Transaction numbers are only allowed on a replica set member or mongos');
  }

  private formatError(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return 'unknown error';
  }
}
