import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  enabled: `${process.env.REDIS_ENABLED ?? 'false'}`.toLowerCase() === 'true',
  url: process.env.REDIS_URL ?? '',
}));


