import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditPayload {
  operatorId?: string;
  operatorRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  ua?: string;
  traceId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async recordCritical(payload: AuditPayload): Promise<void> {
    await this.persist(payload);
  }

  recordEventually(payload: AuditPayload): void {
    setImmediate(() => {
      void this.persist(payload).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown audit persistence error';
        this.logger.warn(
          `Failed to persist audit log: action=${payload.action}, resourceType=${payload.resourceType}, resourceId=${payload.resourceId ?? ''}, reason=${message}`,
        );
      });
    });
  }

  private async persist(payload: AuditPayload): Promise<void> {
    await this.auditLogModel.create({
      operator_id: payload.operatorId,
      operator_role: payload.operatorRole,
      action: payload.action,
      resource_type: payload.resourceType,
      resource_id: payload.resourceId,
      before: payload.before,
      after: payload.after,
      ip: payload.ip,
      ua: payload.ua,
      trace_id: payload.traceId,
      created_at: new Date(),
    });
  }
}
