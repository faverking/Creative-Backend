import {
  ARTICLE_THEME_LABELS,
  BOOK_AREA_LABELS,
  BOOK_PART_LABELS,
  BOOK_STYLE_LABELS,
  BUSINESS_LABELS,
  IMAGE_THEME_LABELS,
  TOPIC_FEATURE_FLAG_LABELS,
  TOPIC_LABELS,
  TOPIC_TYPE_LABELS,
} from '../constants/content-taxonomy.constants';
import { TargetType } from '../enums/target-type.enum';
import {
  buildArticleBusinessTags,
  buildBookBusinessTags,
  buildBookCompositeTags,
  buildBookStyleTags,
  buildImageBusinessTags,
  buildTopicCompositeTags,
  buildTopicFeatureFlagTags,
  buildTopicBusinessTags,
  readBusinessLabel,
} from './content-tag.util';

describe('content-tag.util', () => {
  it('reads the finalized first-level business labels by target type', () => {
    expect(readBusinessLabel(TargetType.ARTICLE)).toBe(BUSINESS_LABELS[1]);
    expect(readBusinessLabel(TargetType.TOPIC)).toBe(BUSINESS_LABELS[2]);
    expect(readBusinessLabel(TargetType.IMAGE)).toBe(BUSINESS_LABELS[3]);
    expect(readBusinessLabel(TargetType.BOOK)).toBe(BUSINESS_LABELS[4]);
  });

  it('builds tags from the updated taxonomy dictionaries', () => {
    expect(buildArticleBusinessTags(1)).toEqual([ARTICLE_THEME_LABELS[1]]);
    expect(buildTopicBusinessTags(1, 2)).toEqual([TOPIC_LABELS[1], TOPIC_TYPE_LABELS[2]]);
    expect(buildImageBusinessTags(3)).toEqual([IMAGE_THEME_LABELS[3]]);
    expect(buildBookBusinessTags(2, 1)).toEqual([BOOK_PART_LABELS[2], BOOK_AREA_LABELS[1]]);
  });

  it('builds book style tags strictly from the finalized style dictionary ids', () => {
    expect(
      buildBookStyleTags([
        { id: 101, name: 'old-campus-name' },
        { id: 105, name: 'old-romance-name' },
        { id: 999, name: 'removed-fallback-name' },
      ]),
    ).toEqual([BOOK_STYLE_LABELS[101], BOOK_STYLE_LABELS[105]]);
  });

  it('combines part area and style tags using the new taxonomy only', () => {
    expect(
      buildBookCompositeTags(1, 2, [
        { id: 102, name: 'old-fantasy-name' },
        { id: 103, name: 'old-adventure-name' },
      ]),
    ).toEqual([BOOK_PART_LABELS[1], BOOK_AREA_LABELS[2], BOOK_STYLE_LABELS[102], BOOK_STYLE_LABELS[103]]);
  });

  it('builds topic feature flag tags and composes them with topic taxonomy', () => {
    expect(buildTopicFeatureFlagTags([1, 3, 7])).toEqual([
      TOPIC_FEATURE_FLAG_LABELS[1],
      TOPIC_FEATURE_FLAG_LABELS[3],
      TOPIC_FEATURE_FLAG_LABELS[7],
    ]);
    expect(buildTopicCompositeTags(1, 2, [1, 3, 7])).toEqual([
      TOPIC_LABELS[1],
      TOPIC_TYPE_LABELS[2],
      TOPIC_FEATURE_FLAG_LABELS[1],
      TOPIC_FEATURE_FLAG_LABELS[3],
      TOPIC_FEATURE_FLAG_LABELS[7],
    ]);
  });
});
