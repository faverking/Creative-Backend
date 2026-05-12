import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TOPIC_FEATURE_FLAG_LABELS } from '../common/constants/content-taxonomy.constants';
import { TargetType } from '../common/enums/target-type.enum';
import {
  type AdminComposeOptionsSnapshot,
  type AdminComposeSourceSnapshot,
  type PreparedAdminComposeRequest,
  type ContentRewriteResult,
  type RewriteTitleResult,
  type SummaryResult,
  type HighlightsResult,
  type OutlineResult,
  type FeatureFlagSuggestionResult,
} from './ai.types';
import type { AdminComposeRequestDto } from './dto/admin-compose.dto';

const ALLOWED_TASKS: Record<TargetType, string[]> = {
  [TargetType.ARTICLE]: [
    'rewrite-title',
    'generate-summary',
    'polish-summary',
    'extract-highlights',
    'structure-content',
    'rewrite-selection',
    'continue-content',
  ],
  [TargetType.TOPIC]: [
    'rewrite-title',
    'generate-summary',
    'polish-summary',
    'extract-highlights',
    'structure-content',
    'suggest-feature-flags',
  ],
  [TargetType.BOOK]: ['rewrite-title', 'polish-summary', 'extract-highlights'],
  [TargetType.IMAGE]: ['rewrite-title', 'polish-summary', 'extract-highlights'],
};

@Injectable()
export class AiPolicyService {
  constructor(private readonly configService: ConfigService) {}

  prepareRequest(dto: AdminComposeRequestDto): PreparedAdminComposeRequest {
    this.assertTaskAllowed(dto.contentType, dto.task);

    const source = this.normalizeSource(dto.source);
    const options = this.normalizeOptions(dto.options);

    this.assertSourceRequirements(dto.contentType, dto.task, source);

    const serialized = JSON.stringify({
      contentType: dto.contentType,
      task: dto.task,
      source,
      options,
    });
    const inputSize = serialized.length;
    const maxInputChars = this.configService.get<number>('ai.maxInputChars', 12000);
    if (inputSize > maxInputChars) {
      throw new BadRequestException(`AI input exceeds max length of ${maxInputChars} characters`);
    }

    return {
      contentType: dto.contentType,
      task: dto.task,
      source,
      options,
      inputSize,
    };
  }

  assertStructuredResult(
    contentType: TargetType,
    task: string,
    result: unknown,
  ): asserts result is
    | RewriteTitleResult
    | SummaryResult
    | HighlightsResult
    | OutlineResult
    | FeatureFlagSuggestionResult
    | ContentRewriteResult {
    if (typeof result !== 'object' || result === null) {
      throw new BadGatewayException('AI result is empty');
    }

    if (task === 'rewrite-title') {
      if (!('title' in result) || typeof (result as { title?: unknown }).title !== 'string') {
        throw new BadGatewayException('AI result is missing title');
      }
      return;
    }

    if (task === 'generate-summary' || task === 'polish-summary') {
      if (!('summary' in result) || typeof (result as { summary?: unknown }).summary !== 'string') {
        throw new BadGatewayException('AI result is missing summary');
      }
      return;
    }

    if (task === 'extract-highlights') {
      if (
        !('highlights' in result) ||
        !Array.isArray((result as { highlights?: unknown }).highlights) ||
        (result as { highlights: unknown[] }).highlights.some((item) => typeof item !== 'string')
      ) {
        throw new BadGatewayException('AI result is missing highlights');
      }
      return;
    }

    if (task === 'structure-content') {
      if (
        !('outline' in result) ||
        !Array.isArray((result as { outline?: unknown }).outline) ||
        (result as { outline: unknown[] }).outline.some((item) => typeof item !== 'string')
      ) {
        throw new BadGatewayException('AI result is missing outline');
      }
      return;
    }

    if (task === 'rewrite-selection' || task === 'continue-content') {
      if (!('content' in result) || typeof (result as { content?: unknown }).content !== 'string') {
        throw new BadGatewayException('AI result is missing content');
      }
      return;
    }

    if (task === 'suggest-feature-flags') {
      const suggestions = (result as { featureFlagSuggestions?: unknown }).featureFlagSuggestions;
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new BadGatewayException('AI result is missing feature flag suggestions');
      }

      for (const item of suggestions) {
        if (
          typeof item !== 'object' ||
          item === null ||
          typeof (item as { id?: unknown }).id !== 'number' ||
          typeof (item as { label?: unknown }).label !== 'string' ||
          typeof (item as { reason?: unknown }).reason !== 'string'
        ) {
          throw new BadGatewayException('AI result contains invalid feature flag suggestion');
        }

        const id = (item as { id: number }).id;
        const label = (item as { label: string }).label;
        if (TOPIC_FEATURE_FLAG_LABELS[id] !== label) {
          throw new BadGatewayException('AI result contains unsupported feature flag suggestion');
        }
      }

      if (contentType !== TargetType.TOPIC) {
        throw new BadGatewayException('Feature flag suggestions are only supported for topics');
      }
    }
  }

  private assertTaskAllowed(contentType: TargetType, task: string): void {
    if (!ALLOWED_TASKS[contentType].includes(task)) {
      throw new BadRequestException(`Task "${task}" is not allowed for content type "${contentType}"`);
    }
  }

  private assertSourceRequirements(
    contentType: TargetType,
    task: string,
    source: AdminComposeSourceSnapshot,
  ): void {
    if (task === 'rewrite-title') {
      this.assertHasAnyText(source, ['title', 'summary', 'content']);
      return;
    }

    if (task === 'generate-summary') {
      this.assertHasAnyText(source, ['title', 'content']);
      return;
    }

    if (task === 'polish-summary') {
      this.assertHasAnyText(source, ['summary', 'content']);
      return;
    }

    if (task === 'extract-highlights' || task === 'structure-content') {
      this.assertHasAnyText(source, ['content']);
      return;
    }

    if (task === 'rewrite-selection') {
      if (contentType !== TargetType.ARTICLE) {
        throw new BadRequestException('Selection rewrite is only supported for articles');
      }

      this.assertHasAnyText(source, ['selectionText']);
      return;
    }

    if (task === 'continue-content') {
      if (contentType !== TargetType.ARTICLE) {
        throw new BadRequestException('Content continuation is only supported for articles');
      }

      this.assertHasAnyText(source, ['cursorPrefix']);
      return;
    }

    if (task === 'suggest-feature-flags') {
      if (contentType !== TargetType.TOPIC) {
        throw new BadRequestException('Feature flag suggestions are only supported for topics');
      }

      this.assertHasAnyText(source, ['title', 'summary', 'content']);
    }
  }

  private assertHasAnyText(
    source: AdminComposeSourceSnapshot,
    fields: Array<
      'title' | 'summary' | 'content' | 'selectionText' | 'selectionPrefix' | 'selectionSuffix' | 'cursorPrefix' | 'cursorSuffix'
    >,
  ): void {
    if (!fields.some((field) => typeof source[field] === 'string' && source[field]!.trim().length > 0)) {
      throw new BadRequestException(`AI source is missing required fields: ${fields.join(', ')}`);
    }
  }

  private normalizeSource(source: AdminComposeRequestDto['source']): AdminComposeSourceSnapshot {
    return {
      title: this.normalizeOptionalString(source.title),
      summary: this.normalizeOptionalString(source.summary),
      content: this.normalizeOptionalString(source.content),
      selectionText: this.normalizeOptionalString(source.selectionText),
      selectionPrefix: this.normalizeOptionalString(source.selectionPrefix),
      selectionSuffix: this.normalizeOptionalString(source.selectionSuffix),
      cursorPrefix: this.normalizeOptionalString(source.cursorPrefix),
      cursorSuffix: this.normalizeOptionalString(source.cursorSuffix),
      themeId: source.themeId,
      topicId: source.topicId,
      typeId: source.typeId,
      featureFlags: Array.from(new Set(source.featureFlags ?? [])),
      downloadUrl: this.normalizeOptionalString(source.downloadUrl),
      author: (source.author ?? []).map((item) => item.trim()).filter((item) => item.length > 0),
      part: source.part,
      status: source.status,
      area: source.area,
      chapterList: source.chapterList?.map((item) => ({
        id: item.id,
        order: item.order,
        size: item.size,
        title: this.normalizeOptionalString(item.title),
        rule: this.normalizeOptionalString(item.rule),
      })),
      source: this.normalizeOptionalString(source.source),
      imageCount: source.imageCount,
    };
  }

  private normalizeOptions(options?: AdminComposeRequestDto['options']): AdminComposeOptionsSnapshot {
    return {
      tone: options?.tone ?? 'neutral',
      maxTitleLength: options?.maxTitleLength,
      maxSummaryLength: options?.maxSummaryLength,
      includeReasons: options?.includeReasons === true,
    };
  }

  private normalizeOptionalString(value?: string): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
