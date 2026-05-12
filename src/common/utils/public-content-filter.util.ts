import { ContentStatus } from '../enums/content-status.enum';
import { ReviewStatus } from '../enums/review-status.enum';
import { Visibility } from '../enums/visibility.enum';

export function buildApprovedPublicFilter(): Record<string, unknown> {
  return {
    review_status: ReviewStatus.APPROVED,
    visibility: Visibility.PUBLIC,
  };
}

export function buildPublicArticleFilter(): Record<string, unknown> {
  return {
    deleted_at: { $exists: false },
    status: ContentStatus.PUBLISHED,
    ...buildApprovedPublicFilter(),
  };
}
