import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { TargetType } from '../common/enums/target-type.enum';
import { AiPolicyService } from './ai-policy.service';
import type { AdminComposeRequestDto } from './dto/admin-compose.dto';

function createConfigService(maxInputChars = 12000): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'ai.maxInputChars') {
        return maxInputChars;
      }

      return defaultValue;
    }),
  } as unknown as ConfigService;
}

describe('AiPolicyService', () => {
  it('rejects tasks that are not allowed for the content type', () => {
    const service = new AiPolicyService(createConfigService());

    expect(() =>
      service.prepareRequest({
        contentType: TargetType.ARTICLE,
        task: 'suggest-feature-flags',
        source: {
          title: 'test',
        },
      } as AdminComposeRequestDto),
    ).toThrow(BadRequestException);
  });

  it('rejects extract-highlights when content is missing', () => {
    const service = new AiPolicyService(createConfigService());

    expect(() =>
      service.prepareRequest({
        contentType: TargetType.ARTICLE,
        task: 'extract-highlights',
        source: {
          title: 'only title',
        },
      } as AdminComposeRequestDto),
    ).toThrow(BadRequestException);
  });

  it('rejects rewrite-selection when selection text is missing', () => {
    const service = new AiPolicyService(createConfigService());

    expect(() =>
      service.prepareRequest({
        contentType: TargetType.ARTICLE,
        task: 'rewrite-selection',
        source: {
          selectionPrefix: '前文',
        },
      } as AdminComposeRequestDto),
    ).toThrow(BadRequestException);
  });

  it('rejects continue-content for non-article content types', () => {
    const service = new AiPolicyService(createConfigService());

    expect(() =>
      service.prepareRequest({
        contentType: TargetType.TOPIC,
        task: 'continue-content',
        source: {
          cursorPrefix: '已有正文',
        },
      } as AdminComposeRequestDto),
    ).toThrow(BadRequestException);
  });

  it('normalizes valid topic feature flag suggestion requests', () => {
    const service = new AiPolicyService(createConfigService());

    const prepared = service.prepareRequest({
      contentType: TargetType.TOPIC,
      task: 'suggest-feature-flags',
      source: {
        title: '游戏标题',
        featureFlags: [1, 1, 3],
      },
      options: {
        includeReasons: true,
      },
    } as AdminComposeRequestDto);

    expect(prepared.source.featureFlags).toEqual([1, 3]);
    expect(prepared.options.includeReasons).toBe(true);
  });

  it('rejects requests that exceed the configured input limit', () => {
    const service = new AiPolicyService(createConfigService(20));

    expect(() =>
      service.prepareRequest({
        contentType: TargetType.ARTICLE,
        task: 'rewrite-title',
        source: {
          content: 'this content is definitely longer than twenty characters',
        },
      } as AdminComposeRequestDto),
    ).toThrow(BadRequestException);
  });

  it('rejects provider results with unsupported feature flag labels', () => {
    const service = new AiPolicyService(createConfigService());

    expect(() =>
      service.assertStructuredResult(TargetType.TOPIC, 'suggest-feature-flags', {
        featureFlagSuggestions: [
          {
            id: 1,
            label: '错误标签',
            reason: '原因',
          },
        ],
      }),
    ).toThrow(BadGatewayException);
  });

  it('accepts content rewrite results for rewrite-selection', () => {
    const service = new AiPolicyService(createConfigService());

    expect(() =>
      service.assertStructuredResult(TargetType.ARTICLE, 'rewrite-selection', {
        content: '改写后的正文片段',
      }),
    ).not.toThrow();
  });
});
