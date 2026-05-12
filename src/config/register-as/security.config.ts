import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  throttleTtl: Number(process.env.THROTTLE_TTL ?? 60),
  throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 60),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '1mb',
}));
