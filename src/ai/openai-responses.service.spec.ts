import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OpenAiResponsesService } from './openai-responses.service';

function createConfigService(): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        'ai.openAiApiKey': 'test-key',
        'ai.openAiBaseUrl': 'https://api.openai.com/v1',
        'ai.openAiTimeoutMs': 30000,
        'ai.openAiMaxOutputTokens': 1200,
      };

      return key in values ? values[key] : defaultValue;
    }),
  } as unknown as ConfigService;
}

describe('OpenAiResponsesService', () => {
  const prompt = {
    instructions: 'system prompt',
    input: 'user prompt',
    model: 'gpt-5.4-mini',
    promptVersion: 'v1',
    schemaName: 'article_rewrite_title',
    schema: {
      type: 'object',
    },
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps structured response payloads into parsed output', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'gpt-5.4-mini',
          output_text: '{"title":"新的标题"}',
          usage: {
            input_tokens: 12,
            output_tokens: 8,
            total_tokens: 20,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const service = new OpenAiResponsesService(createConfigService());
    const result = await service.createStructuredResponse<{ title: string }>(prompt, 'trace-1');

    expect(result).toEqual({
      model: 'gpt-5.4-mini',
      output: {
        title: '新的标题',
      },
      usage: {
        inputTokens: 12,
        outputTokens: 8,
        totalTokens: 20,
      },
    });
  });

  it('maps streaming responses into delta and completed events', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"type":"response.output_text.delta","delta":"{\\"title\\":\\""}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"response.output_text.delta","delta":"流式标题\\"}"}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"response.output_text.done","text":"{\\"title\\":\\"流式标题\\"}"}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"response.completed","response":{"model":"gpt-5.4-mini","usage":{"input_tokens":10,"output_tokens":6,"total_tokens":16}}}\n\n',
          ),
        );
        controller.close();
      },
    });

    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }),
    );

    const service = new OpenAiResponsesService(createConfigService());
    const events: Array<{ type: string; text?: string; response?: unknown }> = [];

    for await (const event of service.createStructuredResponseStream<{ title: string }>(prompt, 'trace-2')) {
      events.push(event as { type: string; text?: string; response?: unknown });
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({
      type: 'delta',
      text: '{"title":"',
    });
    expect(events[1]).toEqual({
      type: 'delta',
      text: '流式标题"}',
    });
    expect(events[2]).toEqual({
      type: 'completed',
      response: {
        model: 'gpt-5.4-mini',
        output: {
          title: '流式标题',
        },
        usage: {
          inputTokens: 10,
          outputTokens: 6,
          totalTokens: 16,
        },
      },
    });
  });

  it('raises a provider error for non-200 responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: 'provider failed',
          },
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const service = new OpenAiResponsesService(createConfigService());

    await expect(service.createStructuredResponse(prompt, 'trace-3')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
