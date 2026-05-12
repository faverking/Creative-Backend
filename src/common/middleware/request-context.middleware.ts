import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function attachTraceId(req: Request, res: Response, next: NextFunction): void {
  // 优先复用上游 traceId，便于前后端和网关日志串联；缺失时由服务端兜底生成。
  const traceId = req.header('x-trace-id')?.trim() || randomUUID();
  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);
  next();
}
