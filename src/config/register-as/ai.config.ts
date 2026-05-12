import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  openAiApiKey: process.env.OPENAI_API_KEY ?? '',
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  openAiModelAdminCompose: process.env.OPENAI_MODEL_ADMIN_COMPOSE ?? 'gpt-5.4-mini',
  openAiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 30000),
  maxInputChars: Number(process.env.OPENAI_MAX_INPUT_CHARS ?? 12000),
  openAiMaxOutputTokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 1200),
  adminStreamEnabled:
    process.env.AI_ADMIN_STREAM_ENABLED === undefined
      ? true
      : process.env.AI_ADMIN_STREAM_ENABLED === 'true',
}));
