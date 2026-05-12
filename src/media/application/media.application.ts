import { basename, extname } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types, type Model } from 'mongoose';
import AdmZip = require('adm-zip');
import archiver = require('archiver');
import { Article, type ArticleDocument } from '../../articles/schemas/article.schema';
import { BookDetail, type BookDetailDocument } from '../../books/schemas/book.schema';
import { mapWithConcurrency } from '../../common/utils/concurrency.util';
import { AuditService } from '../../infra/audit/audit.service';
import { MetricsService } from '../../infra/metrics/metrics.service';
import { ContentOperationLockService } from '../../infra/redis/content-operation-lock.service';
import { StorageService } from '../../infra/storage/storage.service';
import { ImagePackage, type ImagePackageDocument } from '../../images/schemas/image.schema';
import { Topic, type TopicDocument } from '../../topics/schemas/topic.schema';
import { type UploadedBinaryFile } from '../interfaces/uploaded-binary-file.interface';
import {
  BatchImageDownloadDto,
  QueryMediaDto,
  ResolveMediaDto,
  ZipMediaDownloadDto,
  type MediaType,
  type ZipUploadMode,
} from '../dto/media.dto';
import { MediaRepository } from '../repositories/media.repository';
import {
  configureImagePreviewConcurrency,
  generateWebpPreview,
  type GeneratedImagePreview,
} from '../utils/image-preview.util';
import { parseImageBuffer, toImageQualityView, type ImageQualityView } from '../utils/image-quality.util';
import { normalizeMediaFileName } from '../utils/media-filename.util';
import { isMediaUploadDebugEnabled, maybeBreakMediaUpload } from '../utils/upload-debug.util';
import type { MediaAssetDocument } from '../schemas/media-asset.schema';

export interface MediaSummary {
  id: string;
  type: MediaType;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  cacheKey: string;
  createdAt: Date;
  detailPath: string;
  previewPath: string;
  downloadPath: string;
  attachmentPath: string;
}

export interface ImageMediaPresentation {
  summary: MediaSummary;
  quality?: ImageQualityView;
}

export interface PreparedMediaDownload {
  media: MediaAssetDocument;
  size: number;
}

export interface PreparedMediaZipDownload {
  archive: archiver.Archiver;
  fileName: string;
  total: number;
}

interface ArchiveUploadCandidate {
  mediaType: MediaType;
  file: UploadedBinaryFile;
}

interface ArchiveUploadSkip {
  entryName: string;
  reason: string;
}

interface ArchiveEntryResolution {
  mediaType: MediaType;
  mimeType: string;
}

interface PreparedPersistedFile {
  file: UploadedBinaryFile;
  extension: string;
  imageMeta?: {
    width: number;
    height: number;
  };
  imagePreview?: GeneratedImagePreview;
}

interface ImagePixelMeta {
  width: number;
  height: number;
}

const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
  'application/octet-stream',
]);

const ARCHIVE_MEDIA_TYPES: Record<string, ArchiveEntryResolution> = {
  '.jpg': { mediaType: 'image', mimeType: 'image/jpeg' },
  '.jpeg': { mediaType: 'image', mimeType: 'image/jpeg' },
  '.png': { mediaType: 'image', mimeType: 'image/png' },
  '.webp': { mediaType: 'image', mimeType: 'image/webp' },
  '.gif': { mediaType: 'image', mimeType: 'image/gif' },
  '.mp3': { mediaType: 'audio', mimeType: 'audio/mpeg' },
  '.wav': { mediaType: 'audio', mimeType: 'audio/wav' },
  '.ogg': { mediaType: 'audio', mimeType: 'audio/ogg' },
  '.m4a': { mediaType: 'audio', mimeType: 'audio/mp4' },
  '.aac': { mediaType: 'audio', mimeType: 'audio/aac' },
  '.flac': { mediaType: 'audio', mimeType: 'audio/flac' },
};

@Injectable()
export class MediaApplicationService {
  private readonly logger = new Logger(MediaApplicationService.name);

  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService,
    private readonly contentOperationLockService: ContentOperationLockService,
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(BookDetail.name)
    private readonly bookDetailModel: Model<BookDetailDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
    @InjectModel(ImagePackage.name)
    private readonly imagePackageModel: Model<ImagePackageDocument>,
  ) {
    configureImagePreviewConcurrency(this.configService.get<number>('media.imagePreviewConcurrency', 2));
  }

  async uploadImages(files: UploadedBinaryFile[], ownerId: string, traceId?: string): Promise<unknown> {
    this.debugUpload('upload-images-start', {
      traceId,
      ownerId,
      count: files.length,
      sizes: files.map((file) => file.size),
      mimeTypes: files.map((file) => file.mimetype),
    });

    if (files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }

    const items = await this.persistMediaFiles('image', files, ownerId, traceId);
    return {
      items,
      total: items.length,
    };
  }

  async uploadAudio(file: UploadedBinaryFile | undefined, ownerId: string, traceId?: string): Promise<unknown> {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    const [item] = await this.persistMediaFiles('audio', [file], ownerId, traceId);
    return item;
  }

  async uploadZip(
    file: UploadedBinaryFile | undefined,
    ownerId: string,
    mode: ZipUploadMode = 'extract',
    traceId?: string,
  ): Promise<unknown> {
    const archiveFile = this.validateZipUpload(file);

    // direct 模式把 ZIP 本体当作媒体存储；extract 模式会把压缩包里的条目拆成独立媒体。
    if (mode === 'direct') {
      const [item] = await this.persistMediaFiles('zip', [archiveFile], ownerId, traceId);
      return item;
    }

    const zip = new AdmZip(archiveFile.buffer);
    const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
    const entryLimit = this.configService.get<number>('media.zipEntryLimit', 100);

    if (entries.length === 0) {
      throw new BadRequestException('ZIP archive is empty');
    }

    if (entries.length > entryLimit) {
      throw new BadRequestException(`ZIP entry limit exceeded: ${entryLimit}`);
    }

    const entryMaxFileSize = this.configService.get<number>('media.zipEntryMaxFileSize', 50 * 1024 * 1024);
    const imageMaxSize = this.configService.get<number>('media.imageMaxFileSize', 10 * 1024 * 1024);
    const audioMaxSize = this.configService.get<number>('media.audioMaxFileSize', 50 * 1024 * 1024);
    const accepted: ArchiveUploadCandidate[] = [];
    const skipped: ArchiveUploadSkip[] = [];

    // 逐条校验 ZIP 内容，避免把不支持格式或超限文件直接落库。
    for (const entry of entries) {
      const entryName = this.normalizeArchiveEntryName(entry.entryName);
      const resolved = this.resolveArchiveEntry(entryName);
      if (!resolved) {
        skipped.push({
          entryName,
          reason: 'Unsupported file type in ZIP archive',
        });
        continue;
      }

      const maxAllowedSize = Math.min(
        entryMaxFileSize,
        resolved.mediaType === 'image' ? imageMaxSize : audioMaxSize,
      );

      if (entry.header.size > maxAllowedSize) {
        skipped.push({
          entryName,
          reason: `File exceeds size limit: ${maxAllowedSize} bytes`,
        });
        continue;
      }

      let data: Buffer;
      try {
        data = entry.getData();
      } catch {
        skipped.push({
          entryName,
          reason: 'Unable to read ZIP entry',
        });
        continue;
      }

      if (data.length === 0) {
        skipped.push({
          entryName,
          reason: 'ZIP entry is empty',
        });
        continue;
      }

      if (data.length > maxAllowedSize) {
        skipped.push({
          entryName,
          reason: `Expanded file exceeds size limit: ${maxAllowedSize} bytes`,
        });
        continue;
      }

      accepted.push({
        mediaType: resolved.mediaType,
        file: {
          originalname: entryName,
          mimetype: resolved.mimeType,
          size: data.length,
          buffer: data,
        },
      });
    }

    if (accepted.length === 0) {
      throw new BadRequestException('ZIP archive does not contain supported image or audio files');
    }

    const items = await this.persistMixedMediaFiles(accepted, ownerId, traceId);

    this.auditService.recordEventually({
      operatorId: ownerId,
      action: 'media.zip.upload',
      resourceType: 'media_archive',
      after: {
        accepted: items.length,
        skipped: skipped.length,
      },
      traceId,
    });

    this.metricsService.increment('media.upload.zip');
    return {
      items,
      total: items.length,
      skipped,
    };
  }

  async listMedia(query: QueryMediaDto): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};

    if (query.type) {
      filter.mediaType = query.type;
    }

    const { items, total } = await this.mediaRepository.list(filter, page, limit);
    return {
      items: items.map((item) => this.toMediaSummary(item)),
      page,
      limit,
      total,
    };
  }

  async getMediaDetail(id: string): Promise<unknown> {
    const media = await this.mediaRepository.findById(id);
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return this.toMediaSummary(media);
  }

  async resolveMedia(dto: ResolveMediaDto): Promise<unknown> {
    const medias = await this.mediaRepository.findByIds(dto.mediaIds);
    const ordered = this.sortByInputOrder(medias, dto.mediaIds);
    return {
      items: ordered.map((item) => this.toMediaSummary(item)),
      total: ordered.length,
    };
  }

  async getMediaSummaryMap(mediaIds: string[]): Promise<Map<string, MediaSummary>> {
    const uniqueIds = Array.from(new Set(mediaIds.filter((id) => id && Types.ObjectId.isValid(id))));
    if (uniqueIds.length === 0) {
      return new Map();
    }

    // 内容模块会频繁按 mediaId 批量换取下载地址，这里统一做去重和映射。
    const medias = await this.mediaRepository.findByIds(uniqueIds);
    return new Map(medias.map((item) => [item.id, this.toMediaSummary(item)]));
  }

  async getImagePresentationMap(mediaIds: string[]): Promise<Map<string, ImageMediaPresentation>> {
    const uniqueIds = Array.from(new Set(mediaIds.filter((id) => id && Types.ObjectId.isValid(id))));
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const medias = await this.mediaRepository.findByIds(uniqueIds);
    return new Map(medias.map((item) => [item.id, this.toImagePresentation(item)]));
  }

  async prepareBatchImageDownload(dto: BatchImageDownloadDto): Promise<unknown> {
    await this.assertMediaIdsExist(dto.mediaIds, 'image');
    const medias = await this.mediaRepository.findByIds(dto.mediaIds);
    const ordered = this.sortByInputOrder(medias, dto.mediaIds);
    return {
      items: ordered.map((item) => this.toMediaSummary(item)),
      total: ordered.length,
    };
  }

  async prepareZipDownload(dto: ZipMediaDownloadDto): Promise<PreparedMediaZipDownload> {
    const maxItems = this.configService.get<number>('media.zipDownloadMaxItems', 100);
    const mediaIds = dto.mediaIds ?? [];
    if (mediaIds.length > maxItems) {
      throw new BadRequestException(`ZIP download item limit exceeded: ${maxItems}`);
    }

    const medias = await this.mediaRepository.findByIds(mediaIds);
    const ordered = this.sortByInputOrder(medias, mediaIds);
    const existingIds = new Set(ordered.map((item) => item.id));
    const missing = mediaIds.filter((id) => !existingIds.has(id));

    if (missing.length > 0) {
      throw new BadRequestException(`Media not found: ${missing.join(', ')}`);
    }

    const ioConcurrency = this.configService.get<number>('media.ioConcurrency', 4);
    const sizes = await mapWithConcurrency(ordered, ioConcurrency, async (item) => {
      const stat = await this.storageService.stat(item.storageKey);
      if (!stat) {
        throw new NotFoundException(`Media file missing: ${item.id}`);
      }

      return stat.size;
    });

    const totalSize = sizes.reduce((sum, size) => sum + size, 0);
    const maxTotalSize = this.configService.get<number>('media.zipDownloadMaxTotalSize', 250 * 1024 * 1024);
    if (totalSize > maxTotalSize) {
      throw new BadRequestException(`ZIP download total size exceeds limit: ${maxTotalSize} bytes`);
    }

    // 下载阶段只流式读取文件并打包，避免把所有媒体内容一次性载入内存。
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    archive.on('warning', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') {
        archive.emit('error', error);
      }
    });

    const usedNames = new Set<string>();
    for (const item of ordered) {
      archive.append(this.storageService.createReadStream(item.storageKey), {
        name: this.buildUniqueArchiveFileName(normalizeMediaFileName(item.originalName), item.id, usedNames),
        date: item.createdAt,
      });
    }

    this.metricsService.increment('media.download.zip');
    return {
      archive,
      fileName: this.normalizeArchiveDownloadName(dto.fileName),
      total: ordered.length,
    };
  }

  async prepareDirectZipDownload(id: string): Promise<PreparedMediaDownload> {
    await this.assertMediaIdsExist([id], 'zip');
    return this.prepareDownload(id);
  }

  async prepareDownload(id: string): Promise<PreparedMediaDownload> {
    const media = await this.mediaRepository.findById(id);
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    const stat = await this.storageService.stat(media.storageKey);
    if (!stat) {
      throw new NotFoundException('Media file missing');
    }

    this.metricsService.increment(`media.download.${media.mediaType}`);
    return {
      media,
      size: stat.size,
    };
  }

  async preparePreview(id: string): Promise<PreparedMediaDownload & { mimeType: string; eTag: string }> {
    const media = await this.mediaRepository.findById(id);
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    const previewStorageKey = media.imagePreview?.storageKey ?? media.storageKey;
    const previewMimeType = media.imagePreview?.mimeType ?? media.mimeType;
    const previewStat = await this.storageService.stat(previewStorageKey);
    if (!previewStat) {
      throw new NotFoundException('Media preview missing');
    }

    return {
      media,
      size: previewStat.size,
      mimeType: previewMimeType,
      eTag: media.imagePreview ? `"${media.sha256}-preview"` : `"${media.sha256}"`,
    };
  }

  async deleteOwnedImagesIfUnreferenced(
    mediaIds: string[],
    ownerId: string,
    traceId?: string,
  ): Promise<{ deletedIds: string[]; skipped: Array<{ id: string; reason: string }> }> {
    const uniqueIds = Array.from(new Set(mediaIds.filter((id) => id && Types.ObjectId.isValid(id))));
    if (uniqueIds.length === 0) {
      return {
        deletedIds: [],
        skipped: [],
      };
    }
    const deletedIds: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    // 联删只处理当前用户拥有且已无业务引用的图片，避免误删公共资源。
    for (const mediaId of uniqueIds) {
      try {
        await this.contentOperationLockService.runWithMediaLock(mediaId, async () => {
          const media = await this.mediaRepository.findById(mediaId);
          if (!media) {
            skipped.push({ id: mediaId, reason: 'Media not found' });
            return;
          }

          if (media.mediaType !== 'image') {
            skipped.push({ id: mediaId, reason: 'Only image media can be cascade deleted' });
            return;
          }

          if (media.ownerId.toString() !== ownerId) {
            skipped.push({ id: mediaId, reason: 'Media owner mismatch' });
            return;
          }

          const isReferenced = await this.isImageStillReferenced(mediaId);
          if (isReferenced) {
            skipped.push({ id: mediaId, reason: 'Media is still referenced by other content' });
            return;
          }

          await Promise.all(this.listMediaStorageKeys(media).map((storageKey) => this.storageService.delete(storageKey)));
          await this.mediaRepository.deleteById(mediaId);
          this.auditService.recordEventually({
            operatorId: ownerId,
            action: 'media.image.delete',
            resourceType: 'media',
            resourceId: mediaId,
            traceId,
          });

          deletedIds.push(mediaId);
          this.metricsService.increment('media.delete.image');
        });
      } catch (error) {
        if (error instanceof ConflictException) {
          skipped.push({ id: mediaId, reason: 'Media cleanup is already in progress' });
          continue;
        }

        skipped.push({
          id: mediaId,
          reason: error instanceof Error && error.message.trim().length > 0 ? error.message : 'Media cleanup failed',
        });
      }
    }
    return {
      deletedIds,
      skipped,
    };
  }

  async assertMediaIdsExist(mediaIds: string[], expectedType?: MediaType): Promise<void> {
    if (mediaIds.length === 0) {
      return;
    }

    const medias = await this.mediaRepository.findByIds(mediaIds);
    const ids = new Set(medias.map((item) => item.id));
    const missing = mediaIds.filter((id) => !ids.has(id));

    if (missing.length > 0) {
      throw new BadRequestException(`Media not found: ${missing.join(', ')}`);
    }

    if (expectedType) {
      const invalid = medias.filter((item) => item.mediaType !== expectedType).map((item) => item.id);
      if (invalid.length > 0) {
        throw new BadRequestException(`Media type mismatch: ${invalid.join(', ')}`);
      }
    }
  }

  createReadStream(storageKey: string, start?: number, end?: number) {
    return this.storageService.createReadStream(storageKey, start, end);
  }

  private async isImageStillReferenced(mediaId: string): Promise<boolean> {
    const [articleCount, bookCount, topicCount, imagePackageCount] = await Promise.all([
      this.articleModel.countDocuments({ images: mediaId, deleted_at: { $exists: false } }).exec(),
      this.bookDetailModel.countDocuments({ cover: mediaId }).exec(),
      this.topicModel.countDocuments({ images: mediaId }).exec(),
      this.imagePackageModel.countDocuments({ images: mediaId }).exec(),
    ]);

    return articleCount + bookCount + topicCount + imagePackageCount > 0;
  }

  private async persistMixedMediaFiles(
    items: ArchiveUploadCandidate[],
    ownerId: string,
    traceId?: string,
  ): Promise<MediaSummary[]> {
    const imageFiles: UploadedBinaryFile[] = [];
    const audioFiles: UploadedBinaryFile[] = [];
    const order: Array<{ mediaType: MediaType; index: number }> = [];

    // 先按媒体类型分桶上传，最后再按 ZIP 原始顺序重新拼回结果。
    for (const item of items) {
      if (item.mediaType === 'image') {
        order.push({ mediaType: 'image', index: imageFiles.length });
        imageFiles.push(item.file);
        continue;
      }

      order.push({ mediaType: 'audio', index: audioFiles.length });
      audioFiles.push(item.file);
    }

    const [imageResults, audioResults] = await Promise.all([
      imageFiles.length > 0 ? this.persistMediaFiles('image', imageFiles, ownerId, traceId) : Promise.resolve([]),
      audioFiles.length > 0 ? this.persistMediaFiles('audio', audioFiles, ownerId, traceId) : Promise.resolve([]),
    ]);

    return order.map((item) =>
      item.mediaType === 'image' ? imageResults[item.index] : audioResults[item.index],
    );
  }

  private async persistMediaFiles(
    mediaType: MediaType,
    files: UploadedBinaryFile[],
    ownerId: string,
    traceId?: string,
  ): Promise<MediaSummary[]> {
    this.debugUpload('persist-start', {
      traceId,
      ownerId,
      mediaType,
      count: files.length,
      sizes: files.map((file) => file.size),
      mimeTypes: files.map((file) => file.mimetype),
    });

    const normalizedFiles = files.map((file) => ({
      ...file,
      originalname: normalizeMediaFileName(file.originalname),
    }));
    const validatedFiles = normalizedFiles.map((file) => this.validateUploadedFile(mediaType, file));
    const hashedFiles = validatedFiles.map((file) => ({
      file,
      sha256: this.storageService.createSha256(file.buffer),
    }));

    const existingByHash = new Map(
      (
        await this.mediaRepository.findExistingByHashes(
          mediaType,
          Array.from(new Set(hashedFiles.map((item) => item.sha256))),
        )
      ).map((item) => [item.sha256, item]),
    );

    const ioConcurrency = this.configService.get<number>('media.ioConcurrency', 4);
    const requestCache = new Map<string, MediaSummary>();

    return mapWithConcurrency(hashedFiles, ioConcurrency, async (item) => {
      const cached = requestCache.get(item.sha256);
      if (cached) {
        return cached;
      }

      const existing = existingByHash.get(item.sha256);
      if (existing) {
        const summary = this.toMediaSummary(existing);
        requestCache.set(item.sha256, summary);
        return summary;
      }

      const prepared = await this.preparePersistedFile(mediaType, item.file);

      const mediaId = new Types.ObjectId().toString();
      const storageResult = await this.storageService.saveBuffer({
        mediaId,
        mediaType,
        extension: prepared.extension,
        buffer: prepared.file.buffer,
      });

      const previewStorageResult = prepared.imagePreview
        ? await this.storageService.saveBuffer({
            mediaId,
            mediaType,
            extension: prepared.imagePreview.extension,
            buffer: prepared.imagePreview.buffer,
            variant: 'preview',
          })
        : undefined;

      const created = await this.mediaRepository.create({
        _id: new Types.ObjectId(mediaId),
        mediaType,
        ownerId: new Types.ObjectId(ownerId),
        originalName: prepared.file.originalname,
        fileName: storageResult.fileName,
        extension: prepared.extension,
        mimeType: prepared.file.mimetype,
        size: prepared.file.size,
        sha256: item.sha256,
        storageProvider: 'local',
        storageKey: storageResult.storageKey,
        imageMeta: prepared.imageMeta,
        imagePreview: prepared.imagePreview && previewStorageResult
          ? {
              fileName: previewStorageResult.fileName,
              extension: prepared.imagePreview.extension,
              mimeType: prepared.imagePreview.mimeType,
              size: prepared.imagePreview.buffer.length,
              storageKey: previewStorageResult.storageKey,
              imageMeta: prepared.imagePreview.imageMeta,
            }
          : undefined,
      });

      this.auditService.recordEventually({
        operatorId: ownerId,
        action: `media.${mediaType}.upload`,
        resourceType: 'media',
        resourceId: created.id,
        traceId,
      });

      this.metricsService.increment(`media.upload.${mediaType}`);
      const summary = this.toMediaSummary(created);
      requestCache.set(item.sha256, summary);
      return summary;
    });
  }

  private validateUploadedFile(mediaType: MediaType, file: UploadedBinaryFile): UploadedBinaryFile {
    this.debugUpload('validate-file', {
      mediaType,
      size: file?.size,
      mimetype: file?.mimetype,
    });

    if (!file || !file.buffer || file.size <= 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    const maxAllowedSize = this.resolveMaxAllowedFileSize(mediaType);
    if (file.size > maxAllowedSize) {
      throw new PayloadTooLargeException(
        `${this.resolveMediaTypeLabel(mediaType)} exceeds size limit of ${maxAllowedSize} bytes`,
      );
    }

    if (mediaType === 'image') {
      return file;
    }

    const allowed = mediaType === 'audio'
        ? ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac']
        : Array.from(ZIP_MIME_TYPES);

    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported ${mediaType} mime type: ${file.mimetype}`);
    }

    return file;
  }

  private async preparePersistedFile(mediaType: MediaType, file: UploadedBinaryFile): Promise<PreparedPersistedFile> {
    this.debugUpload('prepare-file-start', {
      mediaType,
      size: file.size,
      mimetype: file.mimetype,
    });

    if (mediaType !== 'image') {
      return {
        file,
        extension: this.storageService.resolveExtension(file.originalname, file.mimetype),
        imageMeta: undefined,
      };
    }

    const parsedImage = parseImageBuffer(file.buffer, file.mimetype);
    if (!parsedImage) {
      throw new BadRequestException('Unsupported or invalid image file');
    }

    this.debugUpload('image-parsed', {
      size: file.size,
      mimetype: parsedImage.mimeType,
      width: parsedImage.width,
      height: parsedImage.height,
      pixels: parsedImage.width * parsedImage.height,
    });

    return {
      file: {
        ...file,
        mimetype: parsedImage.mimeType,
      },
      extension: parsedImage.extension,
      imageMeta: {
        width: parsedImage.width,
        height: parsedImage.height,
      },
      imagePreview: await this.generateImagePreview(file.buffer, parsedImage),
    };
  }

  private async generateImagePreview(
    buffer: Buffer,
    parsedImage: ReturnType<typeof parseImageBuffer> & NonNullable<ReturnType<typeof parseImageBuffer>>,
  ): Promise<GeneratedImagePreview> {
    this.assertImageWithinPixelLimit(parsedImage);

    this.debugUpload('preview-start', {
      width: parsedImage.width,
      height: parsedImage.height,
      pixels: parsedImage.width * parsedImage.height,
      bufferSize: buffer.length,
    });

    try {
      const preview = await generateWebpPreview(buffer, parsedImage, parsedImage.mimeType, {
        maxLongEdge: this.configService.get<number>('media.imagePreviewLongEdge', 1280),
        minShortEdge: this.configService.get<number>('media.imagePreviewShortEdge', 480),
        quality: this.configService.get<number>('media.imagePreviewWebpQuality', 80),
        maxInputPixels: this.configService.get<number>('media.imageMaxPixels', 100_000_000),
      });

      this.debugUpload('preview-done', {
        width: preview.imageMeta.width,
        height: preview.imageMeta.height,
        size: preview.buffer.length,
      });

      return preview;
    } catch (error) {
      this.debugUpload('preview-error', {
        message: error instanceof Error ? error.message : 'unknown error',
      });
      throw new BadRequestException(
        error instanceof Error && error.message
          ? `Image preview generation failed: ${error.message}`
          : 'Image preview generation failed',
      );
    }
  }

  private debugUpload(phase: string, payload: Record<string, unknown>): void {
    if (!isMediaUploadDebugEnabled()) {
      return;
    }

    const debugPayload = {
      event: 'media.upload.application',
      phase,
      ...payload,
    };
    this.logger.debug(JSON.stringify(debugPayload));
    maybeBreakMediaUpload(phase, debugPayload);
  }

  private assertImageWithinPixelLimit(imageMeta: ImagePixelMeta): void {
    const maxPixels = this.configService.get<number>('media.imageMaxPixels', 100_000_000);
    const totalPixels = imageMeta.width * imageMeta.height;

    if (totalPixels > maxPixels) {
      throw new PayloadTooLargeException(
        `Image dimensions exceed limit of ${maxPixels} pixels (${imageMeta.width}x${imageMeta.height})`,
      );
    }
  }

  private resolveMaxAllowedFileSize(mediaType: MediaType): number {
    switch (mediaType) {
      case 'image':
        return this.configService.get<number>('media.imageMaxFileSize', 10 * 1024 * 1024);
      case 'audio':
        return this.configService.get<number>('media.audioMaxFileSize', 50 * 1024 * 1024);
      case 'zip':
        return this.configService.get<number>('media.zipMaxFileSize', 100 * 1024 * 1024);
    }
  }

  private resolveMediaTypeLabel(mediaType: MediaType): string {
    switch (mediaType) {
      case 'image':
        return 'Image file';
      case 'audio':
        return 'Audio file';
      case 'zip':
        return 'ZIP file';
    }
  }

  private validateZipUpload(file: UploadedBinaryFile | undefined): UploadedBinaryFile {
    if (!file) {
      throw new BadRequestException('ZIP file is required');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.zip' || !ZIP_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only ZIP archives are supported');
    }

    if (!file.buffer || file.size <= 0) {
      throw new BadRequestException('ZIP archive is empty');
    }

    return file;
  }

  private resolveArchiveEntry(fileName: string): ArchiveEntryResolution | null {
    return ARCHIVE_MEDIA_TYPES[extname(fileName).toLowerCase()] ?? null;
  }

  private normalizeArchiveEntryName(entryName: string): string {
    const normalized = basename(entryName.replace(/\\/g, '/')).trim();
    return normalized || 'unnamed-file';
  }

  private normalizeArchiveDownloadName(fileName?: string): string {
    const trimmed = (fileName ?? '').trim();
    const normalized = trimmed.length > 0 ? trimmed.replace(/[^a-zA-Z0-9._-]/g, '-') : `media-batch-${Date.now()}`;
    return normalized.endsWith('.zip') ? normalized : `${normalized}.zip`;
  }

  private listMediaStorageKeys(media: MediaAssetDocument): string[] {
    return Array.from(
      new Set(
        [media.storageKey, media.imagePreview?.storageKey].filter((storageKey): storageKey is string => Boolean(storageKey)),
      ),
    );
  }

  private buildUniqueArchiveFileName(originalName: string, mediaId: string, usedNames: Set<string>): string {
    const normalizedName = this.normalizeArchiveEntryName(originalName);
    const extension = extname(normalizedName);
    const baseName = extension ? normalizedName.slice(0, -extension.length) : normalizedName;
    const safeBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || mediaId;
    const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '') || '.bin';

    let candidate = `${safeBaseName}${safeExtension}`;
    let suffix = 1;
    while (usedNames.has(candidate)) {
      candidate = `${safeBaseName}-${suffix}${safeExtension}`;
      suffix += 1;
    }

    usedNames.add(candidate);
    return candidate;
  }

  private toMediaSummary(item: MediaAssetDocument): MediaSummary {
    const apiPrefix = this.configService.get<string>('app.apiPrefix', 'api/v1');
    const basePath = `/${apiPrefix}/media/${item.id}`;
    const previewPath = item.imagePreview ? `${basePath}/preview` : `${basePath}/download?disposition=inline`;
    return {
      id: item.id,
      type: item.mediaType,
      originalName: normalizeMediaFileName(item.originalName),
      fileName: item.fileName,
      mimeType: item.mimeType,
      size: item.size,
      sha256: item.sha256,
      cacheKey: item.sha256,
      createdAt: item.createdAt,
      detailPath: basePath,
      previewPath,
      downloadPath: `${basePath}/download`,
      attachmentPath: `${basePath}/download?disposition=attachment`,
    };
  }

  private toImagePresentation(item: MediaAssetDocument): ImageMediaPresentation {
    return {
      summary: this.toMediaSummary(item),
      quality: item.mediaType === 'image' ? toImageQualityView(item.imageMeta) : undefined,
    };
  }

  private sortByInputOrder(items: MediaAssetDocument[], ids: string[]): MediaAssetDocument[] {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    return ids.map((id) => itemMap.get(id)).filter((item): item is MediaAssetDocument => Boolean(item));
  }
}


