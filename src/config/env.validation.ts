import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGINS: Joi.string().allow('').default(''),

  MONGO_URI: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().default('mongodb://localhost:27017/mononest'),
  }),
  MONGO_DB_NAME: Joi.string().default('mononest'),
  MONGO_SYNC_INDEXES_ON_BOOT: Joi.boolean().truthy('true').falsy('false').default(false),

  REDIS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  REDIS_URL: Joi.string().allow('').default(''),

  JWT_ACCESS_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().min(16).default('dev_access_secret_please_change_12345'),
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),

  JWT_REFRESH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().min(16).default('dev_refresh_secret_please_change_12345'),
  }),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  AUTH_ENABLE_OAUTH: Joi.boolean().truthy('true').falsy('false').default(true),
  OAUTH_GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  OAUTH_GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  OAUTH_GOOGLE_REDIRECT_URI: Joi.string().uri().allow('').default(''),

  THROTTLE_TTL: Joi.number().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().min(1).default(60),
  REQUEST_BODY_LIMIT: Joi.string().default('1mb'),

  OPENAI_API_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  OPENAI_BASE_URL: Joi.string().uri().default('https://api.openai.com/v1'),
  OPENAI_MODEL_ADMIN_COMPOSE: Joi.string().default('gpt-5.4-mini'),
  OPENAI_TIMEOUT_MS: Joi.number().min(1000).max(120000).default(30000),
  OPENAI_MAX_INPUT_CHARS: Joi.number().min(1000).max(200000).default(12000),
  OPENAI_MAX_OUTPUT_TOKENS: Joi.number().min(64).max(8192).default(1200),
  AI_ADMIN_STREAM_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),

  MEDIA_STORAGE_ROOT: Joi.string().default('.storage/media'),
  MEDIA_IMAGE_MAX_FILE_SIZE: Joi.number().min(1024).default(20 * 1024 * 1024),
  MEDIA_AUDIO_MAX_FILE_SIZE: Joi.number().min(1024).default(50 * 1024 * 1024),
  MEDIA_BATCH_UPLOAD_LIMIT: Joi.number().min(1).max(50).default(20),
  MEDIA_IO_CONCURRENCY: Joi.number().min(1).max(16).default(4),
  MEDIA_IMAGE_PREVIEW_LONG_EDGE: Joi.number().min(256).max(4096).default(1280),
  MEDIA_IMAGE_PREVIEW_SHORT_EDGE: Joi.number().min(128).max(2048).default(480),
  MEDIA_IMAGE_PREVIEW_WEBP_QUALITY: Joi.number().min(1).max(100).default(80),
  MEDIA_IMAGE_PREVIEW_CONCURRENCY: Joi.number().min(1).max(8).default(2),
  MEDIA_IMAGE_MAX_PIXELS: Joi.number().min(1_000_000).max(1_000_000_000).default(100_000_000),
  MEDIA_ZIP_MAX_FILE_SIZE: Joi.number().min(1024).default(100 * 1024 * 1024),
  MEDIA_ZIP_ENTRY_LIMIT: Joi.number().min(1).max(500).default(100),
  MEDIA_ZIP_ENTRY_MAX_FILE_SIZE: Joi.number().min(1024).default(50 * 1024 * 1024),
  MEDIA_ZIP_DOWNLOAD_MAX_ITEMS: Joi.number().min(1).max(500).default(100),
  MEDIA_ZIP_DOWNLOAD_MAX_TOTAL_SIZE: Joi.number().min(1024).default(250 * 1024 * 1024),
});
