import type { Request } from 'express';

export function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function getUserAgent(req: Request): string {
  return req.header('user-agent') ?? 'unknown';
}

export function getDeviceId(req: Request): string {
  return req.header('x-device-id') ?? 'web-default';
}
