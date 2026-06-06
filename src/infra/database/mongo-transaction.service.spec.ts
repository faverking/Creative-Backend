import { Logger } from '@nestjs/common';
import { MongoTransactionService } from './mongo-transaction.service';

function createConfigService(requireTransactions: boolean) {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key === 'mongo.requireTransactions' ? requireTransactions : defaultValue,
    ),
  };
}

function createConnection(helloResponse: Record<string, unknown>) {
  return {
    db: {
      admin: jest.fn().mockReturnValue({
        command: jest.fn().mockResolvedValue(helloResponse),
      }),
    },
    startSession: jest.fn(),
  };
}

describe('MongoTransactionService', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('falls back to non-transactional execution when transactions are not required', async () => {
    const connection = createConnection({ ok: 1 });
    const service = new MongoTransactionService(
      connection as never,
      createConfigService(false) as never,
    );
    const handler = jest.fn().mockResolvedValue('ok');

    await expect(service.runInTransaction(handler)).resolves.toBe('ok');

    expect(handler).toHaveBeenCalledWith(undefined);
    expect(connection.startSession).not.toHaveBeenCalled();
  });

  it('fails startup when transactions are required but unavailable', async () => {
    const service = new MongoTransactionService(
      createConnection({ ok: 1 }) as never,
      createConfigService(true) as never,
    );

    await expect(service.onModuleInit()).rejects.toThrow('Mongo transactions are required but unavailable');
  });

  it('fails instead of falling back if a required transaction becomes unsupported at runtime', async () => {
    const unsupportedError = new Error('Transaction numbers are only allowed on a replica set member or mongos');
    const session = {
      withTransaction: jest.fn().mockRejectedValue(unsupportedError),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = createConnection({ setName: 'rs0' });
    connection.startSession.mockReturnValue(session);
    const service = new MongoTransactionService(
      connection as never,
      createConfigService(true) as never,
    );

    await expect(service.runInTransaction(jest.fn())).rejects.toThrow(
      'Mongo transactions are required but unavailable',
    );

    expect(session.endSession).toHaveBeenCalled();
  });
});
