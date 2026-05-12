import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'audit_logs', versionKey: false })
export class AuditLog {
  @Prop()
  operator_id?: string;

  @Prop()
  operator_role?: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  resource_type!: string;

  @Prop()
  resource_id?: string;

  @Prop({ type: Object })
  before?: Record<string, unknown>;

  @Prop({ type: Object })
  after?: Record<string, unknown>;

  @Prop()
  ip?: string;

  @Prop()
  ua?: string;

  @Prop()
  trace_id?: string;

  @Prop({ required: true })
  created_at!: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
