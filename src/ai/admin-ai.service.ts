import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { buildAdminComposePrompt, stripOptionalReasons } from './prompts/admin-compose.prompts';
import { AiPolicyService } from './ai-policy.service';
import type {
  AdminAiStreamEvent,
  AdminComposeResponse,
  AdminComposeResult,
} from './ai.types';
import type { AdminComposeRequestDto } from './dto/admin-compose.dto';
import { OpenAiResponsesService } from './openai-responses.service';

@Injectable()
export class AdminAiService {
  private readonly logger = new Logger(AdminAiService.name);

  constructor(
    private readonly aiPolicyService: AiPolicyService,
    private readonly openAiResponsesService: OpenAiResponsesService,
    private readonly configService: ConfigService,
  ) {}

  async composeForAdmin(
    user: JwtUser,
    dto: AdminComposeRequestDto,
    traceId = '',
  ): Promise<AdminComposeResponse> {
    const startedAt = Date.now();
    const model = this.configService.get<string>('ai.openAiModelAdminCompose', 'gpt-5.4-mini');
    let promptVersion = 'admin-compose.v1';

    try {
      const prepared = this.aiPolicyService.prepareRequest(dto);
      const prompt = buildAdminComposePrompt(prepared, model);
      promptVersion = prompt.promptVersion;
      const providerResponse =
        await this.openAiResponsesService.createStructuredResponse<AdminComposeResult>(prompt, traceId);
      const result = stripOptionalReasons(providerResponse.output, prepared.options.includeReasons);

      this.aiPolicyService.assertStructuredResult(prepared.contentType, prepared.task, result);

      const response: AdminComposeResponse = {
        task: prepared.task,
        contentType: prepared.contentType,
        model: providerResponse.model,
        promptVersion: prompt.promptVersion,
        traceId,
        result,
        usage: providerResponse.usage,
      };

      this.logSuccess(user, response, Date.now() - startedAt);
      return response;
    } catch (error) {
      this.logFailure(user, dto.contentType, dto.task, model, promptVersion, traceId, startedAt, error);
      throw error;
    }
  }

  async composeForAdminStream(
    user: JwtUser,
    dto: AdminComposeRequestDto,
    traceId = '',
  ): Promise<AsyncGenerator<AdminAiStreamEvent>> {
    const enabled = this.configService.get<boolean>('ai.adminStreamEnabled', true);
    if (!enabled) {
      throw new ServiceUnavailableException('AI streaming is disabled');
    }

    const model = this.configService.get<string>('ai.openAiModelAdminCompose', 'gpt-5.4-mini');
    const startedAt = Date.now();
    try {
      const prepared = this.aiPolicyService.prepareRequest(dto);
      const prompt = buildAdminComposePrompt(prepared, model);

      return this.streamCompose(
        user,
        prepared.contentType,
        prepared.task,
        prompt.promptVersion,
        traceId,
        startedAt,
        model,
        prompt,
        prepared.options.includeReasons,
      );
    } catch (error) {
      this.logFailure(user, dto.contentType, dto.task, model, 'admin-compose.v1', traceId, startedAt, error);
      throw error;
    }
  }

  private async *streamCompose(
    user: JwtUser,
    contentType: AdminComposeResponse['contentType'],
    task: AdminComposeResponse['task'],
    promptVersion: string,
    traceId: string,
    startedAt: number,
    model: string,
    prompt: ReturnType<typeof buildAdminComposePrompt>,
    includeReasons: boolean,
  ): AsyncGenerator<AdminAiStreamEvent> {
    try {
      for await (const event of this.openAiResponsesService.createStructuredResponseStream<AdminComposeResult>(
        prompt,
        traceId,
      )) {
        if (event.type === 'delta') {
          yield {
            event: 'delta',
            data: {
              text: event.text,
            },
          };
          continue;
        }

        const result = stripOptionalReasons(event.response.output, includeReasons);
        this.aiPolicyService.assertStructuredResult(contentType, task, result);

        const completedEvent: AdminAiStreamEvent = {
          event: 'completed',
          data: {
            task,
            contentType,
            model: event.response.model,
            promptVersion,
            traceId,
            result,
            usage: event.response.usage,
          },
        };

        this.logSuccess(user, completedEvent.data, Date.now() - startedAt);
        yield completedEvent;
      }
    } catch (error) {
      this.logFailure(user, contentType, task, model, promptVersion, traceId, startedAt, error);
      yield {
        event: 'error',
        data: {
          message: error instanceof Error ? error.message : 'AI stream failed',
          traceId,
        },
      };
    }
  }

  private logSuccess(user: JwtUser, response: AdminComposeResponse, durationMs: number): void {
    this.logger.log(
      JSON.stringify({
        event: 'ai.compose.success',
        userId: user.userId,
        role: user.roles[0] ?? 'unknown',
        contentType: response.contentType,
        task: response.task,
        model: response.model,
        promptVersion: response.promptVersion,
        durationMs,
        usage: response.usage,
        traceId: response.traceId,
      }),
    );
  }

  private logFailure(
    user: JwtUser,
    contentType: AdminComposeResponse['contentType'],
    task: AdminComposeResponse['task'],
    model: string,
    promptVersion: string,
    traceId: string,
    startedAt: number,
    error: unknown,
  ): void {
    this.logger.warn(
      JSON.stringify({
        event: 'ai.compose.failure',
        userId: user.userId,
        role: user.roles[0] ?? 'unknown',
        contentType,
        task,
        model,
        promptVersion,
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'unknown error',
        traceId,
      }),
    );
  }
}
