import 'reflect-metadata';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists critical audit logs synchronously', async () => {
    const auditLogModel = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuditService(auditLogModel as never);

    await service.recordCritical({
      action: 'book.create',
      resourceType: 'book',
      resourceId: 'resource-1',
    });

    expect(auditLogModel.create).toHaveBeenCalledTimes(1);
  });

  it('dispatches eventual audit logs asynchronously', async () => {
    jest.useFakeTimers();

    const auditLogModel = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuditService(auditLogModel as never);

    service.recordEventually({
      action: 'favorite.create',
      resourceType: 'article',
      resourceId: 'resource-1',
    });

    expect(auditLogModel.create).not.toHaveBeenCalled();

    await jest.runAllTimersAsync();

    expect(auditLogModel.create).toHaveBeenCalledTimes(1);
  });
});
