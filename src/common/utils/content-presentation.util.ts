import type { MediaSummary } from '../../media/application/media.application';
import {
  extractMediaReferenceId,
  normalizeMediaReferenceIds,
  pickFirstMediaReferenceId,
  type MediaReferenceInput,
} from './media-reference.util';
import { toResolvedMediaAsset, type ResolvedMediaAsset, type ResolvedMediaAssetMode } from './media-summary.util';

export interface CompactUserIdentity {
  id: string;
  name: string;
  avatarUrl: string;
}

interface MediaSummaryCarrier {
  summary: MediaSummary;
}

type ContentMediaReference = MediaSummary | MediaSummaryCarrier;

export interface ImagePackageCoverReference {
  cover?: MediaReferenceInput;
  images?: MediaReferenceInput[];
}

export function toCompactUserIdentity(
  profile?: Pick<CompactUserIdentity, 'id' | 'name' | 'avatarUrl'> | null,
): CompactUserIdentity | undefined {
  if (!profile) {
    return undefined;
  }

  return {
    id: profile.id,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
  };
}

export function mapReferencedMediaAssets<TMedia extends ContentMediaReference>(
  mediaIds: MediaReferenceInput[],
  mediaMap: Map<string, TMedia>,
  mode: ResolvedMediaAssetMode = 'full',
): ResolvedMediaAsset[] {
  return normalizeMediaReferenceIds(mediaIds)
    .map((mediaId) => mapSingleReferencedMediaAsset(mediaId, mediaMap, mode))
    .filter((media): media is ResolvedMediaAsset => Boolean(media));
}

export function mapPrimaryReferencedMediaAsset<TMedia extends ContentMediaReference>(
  mediaIds: MediaReferenceInput[],
  mediaMap: Map<string, TMedia>,
  mode: ResolvedMediaAssetMode = 'full',
): ResolvedMediaAsset | undefined {
  const primaryMediaId = pickFirstMediaReferenceId(mediaIds);
  return mapSingleReferencedMediaAsset(primaryMediaId, mediaMap, mode);
}

export function mapSingleReferencedMediaAsset<TMedia extends ContentMediaReference>(
  mediaId: MediaReferenceInput,
  mediaMap: Map<string, TMedia>,
  mode: ResolvedMediaAssetMode = 'full',
): ResolvedMediaAsset | undefined {
  const normalizedMediaId = extractMediaReferenceId(mediaId);
  return normalizedMediaId ? toResolvedMediaAsset(resolveMediaSummary(mediaMap.get(normalizedMediaId)), mode) : undefined;
}

export function resolveImagePackageCoverMediaId(item: ImagePackageCoverReference): string | undefined {
  return extractMediaReferenceId(item.cover) ?? pickFirstMediaReferenceId(item.images ?? []);
}

function resolveMediaSummary<TMedia extends ContentMediaReference>(media?: TMedia | null): MediaSummary | undefined {
  if (!media) {
    return undefined;
  }

  return 'summary' in media ? media.summary : media;
}
