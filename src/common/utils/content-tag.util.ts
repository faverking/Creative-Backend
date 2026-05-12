import {
  ARTICLE_THEME_LABELS,
  BUSINESS_LABELS,
  BOOK_AREA_LABELS,
  BOOK_PART_LABELS,
  BOOK_STYLE_LABELS,
  IMAGE_THEME_LABELS,
  TOPIC_FEATURE_FLAG_LABELS,
  TOPIC_LABELS,
  TOPIC_TYPE_LABELS,
} from '../constants/content-taxonomy.constants';
import { TargetType } from '../enums/target-type.enum';

const TARGET_TYPE_TO_BUSINESS_ID: Record<TargetType, number> = {
  [TargetType.ARTICLE]: 1,
  [TargetType.TOPIC]: 2,
  [TargetType.IMAGE]: 3,
  [TargetType.BOOK]: 4,
};

function compactTags(tags: Array<string | undefined>): string[] {
  return tags.filter((tag): tag is string => Boolean(tag));
}

type BookStyleTagLike = {
  id?: number;
  name?: string;
};

type TopicFeatureFlagLike = number | { id?: number };

function readLabel(dictionary: Record<number, string>, value: number | undefined, fallbackPrefix: string): string | undefined {
  if (typeof value !== 'number') {
    return undefined;
  }

  return dictionary[value] ?? `${fallbackPrefix}${value}`;
}

export function buildArticleBusinessTags(themeId?: number): string[] {
  return compactTags([readLabel(ARTICLE_THEME_LABELS, themeId, '文章主题-')]);
}

export function buildBookBusinessTags(part?: number, area?: number): string[] {
  return compactTags([
    readLabel(BOOK_PART_LABELS, part, '书籍分区-'),
    readLabel(BOOK_AREA_LABELS, area, '地域分区-'),
  ]);
}

export function buildBookStyleTags(styles?: BookStyleTagLike[]): string[] {
  if (!Array.isArray(styles) || styles.length === 0) {
    return [];
  }

  return Array.from(
    new Set(
      styles
        .map((style) => (typeof style?.id === 'number' ? BOOK_STYLE_LABELS[style.id] : undefined))
        .filter((name): name is string => Boolean(name && name.length > 0)),
    ),
  );
}

export function buildBookCompositeTags(
  part?: number,
  area?: number,
  styles?: BookStyleTagLike[],
  limit?: number,
): string[] {
  const tags = Array.from(new Set([...buildBookBusinessTags(part, area), ...buildBookStyleTags(styles)]));
  return typeof limit === 'number' ? tags.slice(0, limit) : tags;
}

export function buildTopicBusinessTags(topicId?: number, typeId?: number): string[] {
  return compactTags([
    readLabel(TOPIC_LABELS, topicId, '专栏主题-'),
    readLabel(TOPIC_TYPE_LABELS, typeId, '专栏类型-'),
  ]);
}

export function buildTopicFeatureFlagTags(featureFlags?: TopicFeatureFlagLike[]): string[] {
  if (!Array.isArray(featureFlags) || featureFlags.length === 0) {
    return [];
  }

  return Array.from(
    new Set(
      featureFlags
        .map((featureFlag) =>
          typeof featureFlag === 'number'
            ? TOPIC_FEATURE_FLAG_LABELS[featureFlag]
            : typeof featureFlag?.id === 'number'
              ? TOPIC_FEATURE_FLAG_LABELS[featureFlag.id]
              : undefined,
        )
        .filter((name): name is string => Boolean(name && name.length > 0)),
    ),
  );
}

export function buildTopicCompositeTags(
  topicId?: number,
  typeId?: number,
  featureFlags?: TopicFeatureFlagLike[],
  limit?: number,
): string[] {
  const tags = Array.from(new Set([...buildTopicBusinessTags(topicId, typeId), ...buildTopicFeatureFlagTags(featureFlags)]));
  return typeof limit === 'number' ? tags.slice(0, limit) : tags;
}

export function buildImageBusinessTags(themeId?: number): string[] {
  return compactTags([readLabel(IMAGE_THEME_LABELS, themeId, '图包主题-')]);
}

export function readBusinessLabel(targetType: TargetType): string {
  return BUSINESS_LABELS[TARGET_TYPE_TO_BUSINESS_ID[targetType]] ?? targetType;
}
