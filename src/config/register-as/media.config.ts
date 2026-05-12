import { resolve } from 'node:path';
import { registerAs } from '@nestjs/config';

export default registerAs('media', () => ({
  storageRoot: resolve(process.cwd(), process.env.MEDIA_STORAGE_ROOT ?? '.storage/media'),
  imageMaxFileSize: Number(process.env.MEDIA_IMAGE_MAX_FILE_SIZE ?? 20 * 1024 * 1024),
  audioMaxFileSize: Number(process.env.MEDIA_AUDIO_MAX_FILE_SIZE ?? 50 * 1024 * 1024),
  batchUploadLimit: Number(process.env.MEDIA_BATCH_UPLOAD_LIMIT ?? 20),
  ioConcurrency: Number(process.env.MEDIA_IO_CONCURRENCY ?? 4),
  imagePreviewLongEdge: Number(process.env.MEDIA_IMAGE_PREVIEW_LONG_EDGE ?? 1280),
  imagePreviewShortEdge: Number(process.env.MEDIA_IMAGE_PREVIEW_SHORT_EDGE ?? 480),
  imagePreviewWebpQuality: Number(process.env.MEDIA_IMAGE_PREVIEW_WEBP_QUALITY ?? 80),
  imagePreviewConcurrency: Number(process.env.MEDIA_IMAGE_PREVIEW_CONCURRENCY ?? 2),
  imageMaxPixels: Number(process.env.MEDIA_IMAGE_MAX_PIXELS ?? 100_000_000),
  zipMaxFileSize: Number(process.env.MEDIA_ZIP_MAX_FILE_SIZE ?? 100 * 1024 * 1024),
  zipEntryLimit: Number(process.env.MEDIA_ZIP_ENTRY_LIMIT ?? 100),
  zipEntryMaxFileSize: Number(process.env.MEDIA_ZIP_ENTRY_MAX_FILE_SIZE ?? 50 * 1024 * 1024),
  zipDownloadMaxItems: Number(process.env.MEDIA_ZIP_DOWNLOAD_MAX_ITEMS ?? 100),
  zipDownloadMaxTotalSize: Number(process.env.MEDIA_ZIP_DOWNLOAD_MAX_TOTAL_SIZE ?? 250 * 1024 * 1024),
}));
