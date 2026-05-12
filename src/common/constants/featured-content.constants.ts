export const DEFAULT_FEATURED_SCENE = 'home_featured';
export const DEFAULT_FEATURED_RANK = 100;
export const ADMIN_FEATURED_SCORE_BASE = 1_000_000_000;
export const DEFAULT_FEATURED_DURATION_DAYS = 7;
export const DEFAULT_FEATURED_DURATION_MS = DEFAULT_FEATURED_DURATION_DAYS * 24 * 60 * 60 * 1000;

export const FEATURED_RECOMMEND_SOURCES = ['admin', 'hot'] as const;
export type FeaturedRecommendSource = (typeof FEATURED_RECOMMEND_SOURCES)[number];

export const FEATURED_RECOMMEND_LABELS: Record<FeaturedRecommendSource, string> = {
  admin: '编辑精选',
  hot: '热门推荐',
};
