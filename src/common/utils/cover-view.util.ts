export interface CoverView {
  previewPath: string;
  downloadPath: string;
}

export function toCoverView(
  media?: { previewPath?: string; downloadPath?: string } | null,
): CoverView | null {
  if (!media) {
    return null;
  }

  const previewPath = typeof media.previewPath === 'string' ? media.previewPath : '';
  const downloadPath = typeof media.downloadPath === 'string' ? media.downloadPath : '';

  if (!previewPath && !downloadPath) {
    return null;
  }

  return {
    previewPath,
    downloadPath,
  };
}
