import { Module } from '@nestjs/common';
import { AdminAiController } from './admin-ai.controller';
import { AdminAiService } from './admin-ai.service';
import { AiPolicyService } from './ai-policy.service';
import { OpenAiResponsesService } from './openai-responses.service';

@Module({
  controllers: [AdminAiController],
  providers: [AdminAiService, AiPolicyService, OpenAiResponsesService],
})
export class AiModule {}
