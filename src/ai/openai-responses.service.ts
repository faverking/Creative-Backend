import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AdminComposePromptDefinition,
  AdminComposeUsage,
  OpenAiStructuredResponse,
  OpenAiStructuredStreamEvent,
} from './ai.types';

type OpenAiUsagePayload = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

type OpenAiResponsePayload = {
  model?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  usage?: OpenAiUsagePayload;
};

type OpenAiStreamEvent =
  | { type: 'response.output_text.delta'; delta?: string }
  | { type: 'response.output_text.done'; text?: string }
  | { type: 'response.refusal.delta'; delta?: string }
  | { type: 'response.refusal.done'; refusal?: string }
  | { type: 'response.completed'; response?: OpenAiResponsePayload }
  | { type: 'response.failed'; response?: { error?: { message?: string } } }
  | { type: 'response.error'; error?: { message?: string } }
  | { type: 'error'; error?: { message?: string } }
  | { type: string; [key: string]: unknown };

@Injectable()
export class OpenAiResponsesService {
  private readonly logger = new Logger(OpenAiResponsesService.name);

  constructor(private readonly configService: ConfigService) {}

  async createStructuredResponse<T>(
    prompt: AdminComposePromptDefinition,
    traceId?: string,
  ): Promise<OpenAiStructuredResponse<T>> {
    const response = await this.fetchResponsesApi(prompt, false, traceId);
    const body = (await this.parseJson(response)) as OpenAiResponsePayload & {
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new BadGatewayException(body.error?.message ?? 'AI provider request failed');
    }

    const outputText = this.extractOutputText(body);
    if (!outputText) {
      throw new BadGatewayException('AI provider returned empty structured output');
    }

    return {
      model: body.model ?? prompt.model,
      output: this.parseStructuredOutput<T>(outputText),
      usage: this.toUsage(body.usage),
    };
  }

  async *createStructuredResponseStream<T>(
    prompt: AdminComposePromptDefinition,
    traceId?: string,
  ): AsyncGenerator<OpenAiStructuredStreamEvent<T>> {
    const response = await this.fetchResponsesApi(prompt, true, traceId);
    if (!response.ok) {
      const body = (await this.parseJson(response)) as { error?: { message?: string } };
      throw new BadGatewayException(body.error?.message ?? 'AI provider request failed');
    }

    if (!response.body) {
      throw new BadGatewayException('AI provider did not return a stream body');
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    let accumulatedText = '';
    let finalizedText = '';
    let refusalText = '';
    let completed = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';

      for (const rawChunk of chunks) {
        const event = this.parseSseEvent(rawChunk);
        if (!event) {
          continue;
        }

        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          accumulatedText += event.delta;
          yield {
            type: 'delta',
            text: event.delta,
          };
          continue;
        }

        if (event.type === 'response.output_text.done' && typeof event.text === 'string') {
          finalizedText = event.text;
          continue;
        }

        if (event.type === 'response.refusal.delta' && typeof event.delta === 'string') {
          refusalText += event.delta;
          continue;
        }

        if (event.type === 'response.refusal.done' && typeof event.refusal === 'string') {
          refusalText = event.refusal;
          continue;
        }

        if (event.type === 'response.failed') {
          const responsePayload = (event as { response?: { error?: { message?: string } } }).response;
          throw new BadGatewayException(responsePayload?.error?.message ?? 'AI provider stream failed');
        }

        if (event.type === 'response.error' || event.type === 'error') {
          const errorPayload = (event as { error?: { message?: string } }).error;
          throw new BadGatewayException(errorPayload?.message ?? 'AI provider stream error');
        }

        if (event.type === 'response.completed') {
          const responsePayload = (event as { response?: OpenAiResponsePayload }).response;
          const outputText = finalizedText || accumulatedText || this.extractOutputText(responsePayload);
          if (!outputText) {
            if (refusalText) {
              throw new BadGatewayException('AI provider refused the request');
            }

            throw new BadGatewayException('AI provider returned empty structured output');
          }

          yield {
            type: 'completed',
            response: {
              model: responsePayload?.model ?? prompt.model,
              output: this.parseStructuredOutput<T>(outputText),
              usage: this.toUsage(responsePayload?.usage),
            },
          };
          completed = true;
        }
      }
    }

    if (!completed) {
      throw new BadGatewayException('AI provider stream ended before completion');
    }
  }

  private async fetchResponsesApi(
    prompt: AdminComposePromptDefinition,
    stream: boolean,
    traceId?: string,
  ): Promise<Response> {
    const apiKey = this.configService.get<string>('ai.openAiApiKey', '');
    if (!apiKey) {
      throw new ServiceUnavailableException('AI service is not configured');
    }

    const baseUrl = this.configService.get<string>('ai.openAiBaseUrl', 'https://api.openai.com/v1');
    const timeoutMs = this.configService.get<number>('ai.openAiTimeoutMs', 30000);
    const maxOutputTokens = this.configService.get<number>('ai.openAiMaxOutputTokens', 1200);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(`${baseUrl.replace(/\/$/, '')}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(traceId ? { 'x-trace-id': traceId } : {}),
        },
        body: JSON.stringify({
          model: prompt.model,
          input: [
            {
              role: 'system',
              content: prompt.instructions,
            },
            {
              role: 'user',
              content: prompt.input,
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: prompt.schemaName,
              schema: prompt.schema,
              strict: true,
            },
          },
          max_output_tokens: maxOutputTokens,
          stream,
          store: false,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException('AI provider request timed out');
      }

      if (this.isConnectTimeoutError(error)) {
        this.logger.warn(
          `AI provider connection timed out: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        throw new ServiceUnavailableException('AI provider connection timed out');
      }

      this.logger.warn(
        `AI provider request failed: ${this.getErrorMessage(error)}`,
      );
      throw new BadGatewayException(`AI provider request failed: ${this.getErrorMessage(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private isConnectTimeoutError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const cause = 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
    if (!cause || typeof cause !== 'object') {
      return false;
    }

    return 'code' in cause && (cause as { code?: unknown }).code === 'UND_ERR_CONNECT_TIMEOUT';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && typeof error.message === 'string' && error.message.length > 0) {
      return error.message;
    }

    if (error && typeof error === 'object' && 'cause' in error) {
      const cause = (error as { cause?: unknown }).cause;
      if (cause instanceof Error && cause.message) {
        return cause.message;
      }

      if (cause && typeof cause === 'object' && 'message' in cause) {
        const message = (cause as { message?: unknown }).message;
        if (typeof message === 'string' && message.length > 0) {
          return message;
        }
      }
    }

    return 'unknown error';
  }

  private async parseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  private extractOutputText(payload?: OpenAiResponsePayload): string {
    if (!payload) {
      return '';
    }

    if (typeof payload.output_text === 'string' && payload.output_text.length > 0) {
      return payload.output_text;
    }

    for (const outputItem of payload.output ?? []) {
      for (const content of outputItem.content ?? []) {
        if (content.type === 'output_text' && typeof content.text === 'string' && content.text.length > 0) {
          return content.text;
        }
      }
    }

    return '';
  }

  private parseStructuredOutput<T>(outputText: string): T {
    try {
      return JSON.parse(outputText) as T;
    } catch {
      throw new BadGatewayException('AI provider returned invalid structured output');
    }
  }

  private toUsage(usage?: OpenAiUsagePayload): AdminComposeUsage | undefined {
    if (!usage) {
      return undefined;
    }

    return {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    };
  }

  private parseSseEvent(chunk: string): OpenAiStreamEvent | null {
    const lines = chunk
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const dataLine = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');

    if (!dataLine || dataLine === '[DONE]') {
      return null;
    }

    try {
      return JSON.parse(dataLine) as OpenAiStreamEvent;
    } catch {
      throw new BadGatewayException('AI provider stream payload is invalid');
    }
  }
}
