import { registerAs } from '@nestjs/config';

export default registerAs('oauth', () => ({
  enabled: `${process.env.AUTH_ENABLE_OAUTH ?? 'true'}`.toLowerCase() === 'true',
  google: {
    clientId: process.env.OAUTH_GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.OAUTH_GOOGLE_REDIRECT_URI ?? '',
  },
}));
