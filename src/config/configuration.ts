import aiConfig from './register-as/ai.config';
import appConfig from './register-as/app.config';
import jwtConfig from './register-as/jwt.config';
import mediaConfig from './register-as/media.config';
import mongoConfig from './register-as/mongo.config';
import oauthConfig from './register-as/oauth.config';
import redisConfig from './register-as/redis.config';
import securityConfig from './register-as/security.config';

export const configurationLoaders = [
  aiConfig,
  appConfig,
  mongoConfig,
  redisConfig,
  jwtConfig,
  oauthConfig,
  securityConfig,
  mediaConfig,
];
