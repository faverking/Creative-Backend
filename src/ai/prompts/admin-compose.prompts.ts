import { TOPIC_FEATURE_FLAG_LABELS } from '../../common/constants/content-taxonomy.constants';
import { TargetType } from '../../common/enums/target-type.enum';
import type {
  AdminComposePromptDefinition,
  AdminComposeResult,
  AdminAiTask,
  PreparedAdminComposeRequest,
} from '../ai.types';

const PROMPT_VERSION = 'admin-compose.v1';

const CONTENT_TYPE_LABELS: Record<TargetType, string> = {
  [TargetType.ARTICLE]: '情报',
  [TargetType.TOPIC]: '游戏',
  [TargetType.BOOK]: '书库',
  [TargetType.IMAGE]: '图包',
};

const TASK_LABELS: Record<AdminAiTask, string> = {
  'rewrite-title': '标题改写',
  'generate-summary': '摘要生成',
  'polish-summary': '摘要润色',
  'extract-highlights': '要点提炼',
  'structure-content': '结构编排',
  'suggest-feature-flags': '标签建议',
  'rewrite-selection': '选区改写',
  'continue-content': '正文续写',
};

function buildCommonInstructions(request: PreparedAdminComposeRequest): string {
  const extraRules: string[] = [
    '你是 MonoNest 管理端的内容编辑辅助助手。',
    '只能根据提供的编辑快照生成建议，不能编造未提供的人名、资源、下载信息、版本信息或事实。',
    '输出必须严格符合 JSON Schema，不能输出 Markdown、解释性前缀或额外文本。',
    '如果输入信息不足，也要基于已有内容给出尽量保守的建议，不要编造事实。',
  ];

  if (request.options.maxTitleLength) {
    extraRules.push(`标题建议必须尽量控制在 ${request.options.maxTitleLength} 个字符以内。`);
  }

  if (request.options.maxSummaryLength) {
    extraRules.push(`摘要建议必须尽量控制在 ${request.options.maxSummaryLength} 个字符以内。`);
  }

  if (!request.options.includeReasons) {
    extraRules.push('除非确有必要，不要填充 reasons 字段。');
  }

  return extraRules.join('\n');
}

function buildTaskInstructions(request: PreparedAdminComposeRequest): string {
  switch (request.task) {
    case 'rewrite-title':
      return '任务是改写标题。标题要清晰、自然、适合后台编辑后人工采纳，避免标题党和虚构信息。';
    case 'generate-summary':
      return '任务是生成摘要。摘要应适合列表卡片、精选位和运营简介，优先提炼核心信息，不重复堆砌标题。';
    case 'polish-summary':
      return '任务是润色摘要。保留原始语义，提升清晰度、节奏感和可读性，不要引入新事实。';
    case 'extract-highlights':
      return '任务是提炼内容要点。返回的 highlights 应简洁、可读，适合后台编辑快速浏览。';
    case 'structure-content':
      return '任务是给出内容结构建议。返回的 outline 应该是后台编辑可直接参考的小标题或段落结构。';
    case 'suggest-feature-flags':
      return `任务是建议游戏标签。只能从以下标签中选择：${JSON.stringify(
        Object.entries(TOPIC_FEATURE_FLAG_LABELS).map(([id, label]) => ({
          id: Number(id),
          label,
        })),
      )}。不要返回字典外标签。`;
    case 'rewrite-selection':
      return '任务是改写正文选区。只改写选中的纯文本片段，保持原意和上下文衔接自然。返回的 content 只能是用于替换选区的最终文本，不能带解释、引号或前后缀说明。';
    case 'continue-content':
      return '任务是基于当前光标位置续写正文。结合 cursorPrefix 和 cursorSuffix，让续写内容自然接在光标处。返回的 content 只能是用于插入光标处的最终文本，不能重复已有上下文，不能带解释。';
  }
}

function buildPromptInput(request: PreparedAdminComposeRequest): string {
  return [
    `内容类型：${CONTENT_TYPE_LABELS[request.contentType]}`,
    `任务：${TASK_LABELS[request.task]}`,
    `语气：${request.options.tone}`,
    '编辑快照(JSON)：',
    JSON.stringify(request.source, null, 2),
  ].join('\n');
}

function buildRewriteTitleSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      reasons: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 4,
      },
    },
    required: ['title'],
    additionalProperties: false,
  };
}

function buildSummarySchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      reasons: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 4,
      },
    },
    required: ['summary'],
    additionalProperties: false,
  };
}

function buildHighlightsSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      highlights: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 6,
      },
      reasons: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 4,
      },
    },
    required: ['highlights'],
    additionalProperties: false,
  };
}

function buildOutlineSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      outline: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 8,
      },
      reasons: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 4,
      },
    },
    required: ['outline'],
    additionalProperties: false,
  };
}

function buildFeatureFlagSuggestionSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      featureFlagSuggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            label: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['id', 'label', 'reason'],
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: 5,
      },
    },
    required: ['featureFlagSuggestions'],
    additionalProperties: false,
  };
}

function buildContentRewriteSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      content: { type: 'string' },
    },
    required: ['content'],
    additionalProperties: false,
  };
}

function buildSchema(task: AdminAiTask): Record<string, unknown> {
  switch (task) {
    case 'rewrite-title':
      return buildRewriteTitleSchema();
    case 'generate-summary':
    case 'polish-summary':
      return buildSummarySchema();
    case 'extract-highlights':
      return buildHighlightsSchema();
    case 'structure-content':
      return buildOutlineSchema();
    case 'suggest-feature-flags':
      return buildFeatureFlagSuggestionSchema();
    case 'rewrite-selection':
    case 'continue-content':
      return buildContentRewriteSchema();
  }
}

export function buildAdminComposePrompt(
  request: PreparedAdminComposeRequest,
  model: string,
): AdminComposePromptDefinition {
  return {
    instructions: [buildCommonInstructions(request), buildTaskInstructions(request)].join('\n\n'),
    input: buildPromptInput(request),
    model,
    promptVersion: PROMPT_VERSION,
    schemaName: `${request.contentType}_${request.task}`.replace(/-/g, '_'),
    schema: buildSchema(request.task),
  };
}

export function stripOptionalReasons<T extends AdminComposeResult>(
  result: T,
  includeReasons: boolean,
): T {
  if (includeReasons) {
    return result;
  }

  if ('reasons' in result) {
    const nextResult = { ...result } as T & { reasons?: string[] };
    delete nextResult.reasons;
    return nextResult;
  }

  return result;
}
