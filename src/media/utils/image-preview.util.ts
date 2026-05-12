import sharp = require('sharp');
import type { StoredImageMeta } from './image-quality.util';

export interface GenerateWebpPreviewOptions {
  maxLongEdge: number;
  minShortEdge: number;
  quality: number;
  maxInputPixels: number;
}

export interface GeneratedImagePreview {
  buffer: Buffer;
  mimeType: 'image/webp';
  extension: '.webp';
  imageMeta: StoredImageMeta;
}

let configuredSharpConcurrency: number | undefined;

export function configureImagePreviewConcurrency(concurrency?: number): void {
  if (typeof concurrency !== 'number' || concurrency <= 0) {
    return;
  }

  const normalizedConcurrency = Math.max(1, Math.trunc(concurrency));
  if (configuredSharpConcurrency === normalizedConcurrency) {
    return;
  }

  sharp.concurrency(normalizedConcurrency);
  configuredSharpConcurrency = normalizedConcurrency;
}

export async function generateWebpPreview(
  buffer: Buffer,
  sourceMeta: StoredImageMeta,
  sourceMimeType: string,
  options: GenerateWebpPreviewOptions,
): Promise<GeneratedImagePreview> {
  const maxLongEdge = Math.max(256, Math.trunc(options.maxLongEdge));
  const minShortEdge = Math.max(128, Math.min(maxLongEdge, Math.trunc(options.minShortEdge)));
  const quality = Math.max(1, Math.min(100, Math.trunc(options.quality)));
  const maxInputPixels = Math.max(1_000_000, Math.trunc(options.maxInputPixels));
  const processor = sharp(buffer, {
    animated: sourceMimeType === 'image/gif' || sourceMimeType === 'image/webp',
    limitInputPixels: maxInputPixels,
  });

  const isLandscape = sourceMeta.width >= sourceMeta.height;
  const shortEdgeRatio = Math.min(sourceMeta.width, sourceMeta.height) / Math.max(sourceMeta.width, sourceMeta.height);
  const requiredShortEdgeRatio = minShortEdge / maxLongEdge;

  const transformed = shortEdgeRatio < requiredShortEdgeRatio
    ? processor.resize(isLandscape ? maxLongEdge : minShortEdge, isLandscape ? minShortEdge : maxLongEdge, {
        fit: 'cover',
        position: 'centre',
      })
    : processor.resize({
        width: isLandscape ? maxLongEdge : undefined,
        height: isLandscape ? undefined : maxLongEdge,
        fit: 'inside',
      });

  const { data, info } = await transformed.webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    mimeType: 'image/webp',
    extension: '.webp',
    imageMeta: {
      width: info.width,
      height: info.height,
    },
  };
}
