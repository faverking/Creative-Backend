import type { MediaSummary } from '../../media/application/media.application';
import type { MediaVariant } from '../constants/content-query.constants';

export interface ResolvedMediaAsset {
  id: string;
  previewPath: string;
  downloadPath: string;
  attachmentPath: string;
}

export type ResolvedMediaAssetMode = 'compact' | 'full';

export function toResolvedMediaAsset(
  media?: MediaSummary | null,
  mode: ResolvedMediaAssetMode = 'full',
): ResolvedMediaAsset | undefined {
  if (!media) {
    return undefined;
  }

  if (mode === 'compact') {
    return {
      id: media.id,
      previewPath: media.previewPath,
      downloadPath: media.previewPath,
      attachmentPath: media.previewPath,
    };
  }

  return {
    id: media.id,
    previewPath: media.previewPath,
    downloadPath: media.downloadPath,
    attachmentPath: media.attachmentPath,
  };
}

export function pickMediaPath(
  media?: Pick<ResolvedMediaAsset, 'previewPath' | 'downloadPath'> | null,
  variant: MediaVariant = 'download',
): string | undefined {
  if (!media) {
    return undefined;
  }

  return variant === 'preview' ? media.previewPath : media.downloadPath;
}
