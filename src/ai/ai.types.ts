import type { TargetType } from '../common/enums/target-type.enum';

export const ADMIN_AI_TASKS = [
  'rewrite-title',
  'generate-summary',
  'polish-summary',
  'extract-highlights',
  'structure-content',
  'suggest-feature-flags',
  'rewrite-selection',
  'continue-content',
] as const;

export type AdminAiTask = (typeof ADMIN_AI_TASKS)[number];

export const ADMIN_AI_TONES = ['neutral', 'official', 'community', 'promo'] as const;
export type AdminAiTone = (typeof ADMIN_AI_TONES)[number];

export interface AdminComposeChapterSnapshot {
  id?: number;
  order?: number;
  size?: number;
  title?: string;
  rule?: string;
}

export interface AdminComposeSourceSnapshot {
  title?: string;
  summary?: string;
  content?: string;
  selectionText?: string;
  selectionPrefix?: string;
  selectionSuffix?: string;
  cursorPrefix?: string;
  cursorSuffix?: string;
  themeId?: number;
  topicId?: number;
  typeId?: number;
  featureFlags?: number[];
  downloadUrl?: string;
  author?: string[];
  part?: number;
  status?: number;
  area?: number;
  chapterList?: AdminComposeChapterSnapshot[];
  source?: string;
  imageCount?: number;
}

export interface AdminComposeOptionsSnapshot {
  tone: AdminAiTone;
  maxTitleLength?: number;
  maxSummaryLength?: number;
  includeReasons: boolean;
}

export interface PreparedAdminComposeRequest {
  contentType: TargetType;
  task: AdminAiTask;
  source: AdminComposeSourceSnapshot;
  options: AdminComposeOptionsSnapshot;
  inputSize: number;
}

export interface AdminComposeUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface RewriteTitleResult {
  title: string;
  reasons?: string[];
}

export interface SummaryResult {
  summary: string;
  reasons?: string[];
}

export interface HighlightsResult {
  highlights: string[];
  reasons?: string[];
}

export interface OutlineResult {
  outline: string[];
  reasons?: string[];
}

export interface FeatureFlagSuggestion {
  id: number;
  label: string;
  reason: string;
}

export interface FeatureFlagSuggestionResult {
  featureFlagSuggestions: FeatureFlagSuggestion[];
}

export interface ContentRewriteResult {
  content: string;
}

export type AdminComposeResult =
  | RewriteTitleResult
  | SummaryResult
  | HighlightsResult
  | OutlineResult
  | FeatureFlagSuggestionResult
  | ContentRewriteResult;

export interface AdminComposeResponse {
  task: AdminAiTask;
  contentType: TargetType;
  model: string;
  promptVersion: string;
  traceId: string;
  result: AdminComposeResult;
  usage?: AdminComposeUsage;
}

export interface AdminAiStreamDeltaEvent {
  event: 'delta';
  data: {
    text: string;
  };
}

export interface AdminAiStreamCompletedEvent {
  event: 'completed';
  data: AdminComposeResponse;
}

export interface AdminAiStreamErrorEvent {
  event: 'error';
  data: {
    message: string;
    traceId: string;
  };
}

export type AdminAiStreamEvent =
  | AdminAiStreamDeltaEvent
  | AdminAiStreamCompletedEvent
  | AdminAiStreamErrorEvent;

export interface AdminComposePromptDefinition {
  instructions: string;
  input: string;
  model: string;
  promptVersion: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

export interface OpenAiStructuredResponse<T> {
  model: string;
  output: T;
  usage?: AdminComposeUsage;
}

export interface OpenAiStructuredStreamDeltaEvent {
  type: 'delta';
  text: string;
}

export interface OpenAiStructuredStreamCompletedEvent<T> {
  type: 'completed';
  response: OpenAiStructuredResponse<T>;
}

export type OpenAiStructuredStreamEvent<T> =
  | OpenAiStructuredStreamDeltaEvent
  | OpenAiStructuredStreamCompletedEvent<T>;
