import type { ArticleDocument } from '../articles/schemas/article.schema';
import type { BookDetailDocument } from '../books/schemas/book.schema';
import type { FeaturedRecommendSource } from '../common/constants/featured-content.constants';
import type { CoverView } from '../common/utils/cover-view.util';
import type { FeaturedContentDocument } from '../featured-contents/schemas/featured-content.schema';
import type { ImagePackageDocument } from '../images/schemas/image.schema';
import type { TopicDocument } from '../topics/schemas/topic.schema';
import type { FeaturedContentType } from './dto/search.dto';

export type SearchContentDocument =
  | ArticleDocument
  | BookDetailDocument
  | ImagePackageDocument
  | TopicDocument;

export type SearchFeaturedPayload = Record<string, unknown>;

export interface FeaturedCandidate {
  type: FeaturedContentType;
  score: number;
  sortTime: Date;
  userId?: string;
  item: SearchFeaturedPayload;
}

export interface FeaturedCardAuthor {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface FeaturedCardStats {
  viewCount: number;
  favorCount: number;
  replyCount: number;
}

export interface FeaturedTypeCounts {
  articles: number;
  books: number;
  images: number;
  topics: number;
}

export interface FeaturedSourceCounts {
  admin: number;
  hot: number;
}

export interface FeaturedEditorialEntry {
  config: FeaturedContentDocument;
  type: FeaturedContentType;
  document: SearchContentDocument;
}

export interface FeaturedCardItem {
  id: string;
  type: FeaturedContentType;
  businessLabel: string;
  title: string;
  summary: string;
  cover: CoverView | null;
  badge: string;
  kicker: string;
  tags: string[];
  author?: FeaturedCardAuthor;
  stats: FeaturedCardStats;
  recommendSource: FeaturedRecommendSource;
  recommendLabel: string;
  featuredRank?: number;
  heatScore?: number;
  publishTime: string;
}

export interface RelatedContentItem {
  id: string;
  type: FeaturedContentType;
  businessLabel: string;
  title: string;
  summary: string;
  cover: CoverView | null;
  tags: string[];
  author?: FeaturedCardAuthor;
  viewCount: number;
  favorCount: number;
  replyCount: number;
  publishTime: string;
}
