import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { MediaApplicationService } from './application/media.application';
import {
  BatchImageDownloadDto,
  DownloadMediaQueryDto,
  QueryMediaDto,
  ResolveMediaDto,
  UploadZipQueryDto,
  ZipMediaDownloadDto,
} from './dto/media.dto';
import type { UploadedBinaryFile } from './interfaces/uploaded-binary-file.interface';
import {
  ConfiguredFilesUploadInterceptor,
  ConfiguredFileUploadInterceptor,
} from './interceptors/configured-upload.interceptor';
import { encodeContentDispositionFileName } from './utils/media-filename.util';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaApplicationService: MediaApplicationService) {}

  @Post('images/upload')
  @Idempotent(60)
  @UseInterceptors(
    ConfiguredFilesUploadInterceptor(
      'files',
      'Image file',
      'media.batchUploadLimit',
      12,
      'media.imageMaxFileSize',
      10 * 1024 * 1024,
    ),
  )
  uploadImages(
    @UploadedFiles() files: UploadedBinaryFile[],
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.mediaApplicationService.uploadImages(files ?? [], user.userId, req.traceId);
  }

  @Post('audio/upload')
  @Idempotent(60)
  @UseInterceptors(
    ConfiguredFileUploadInterceptor(
      'file',
      'Audio file',
      'media.audioMaxFileSize',
      50 * 1024 * 1024,
    ),
  )
  uploadAudio(
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.mediaApplicationService.uploadAudio(file, user.userId, req.traceId);
  }

  @Post('zip/upload')
  @Idempotent(60)
  @UseInterceptors(
    ConfiguredFileUploadInterceptor(
      'file',
      'ZIP file',
      'media.zipMaxFileSize',
      100 * 1024 * 1024,
    ),
  )
  uploadZip(
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Query() query: UploadZipQueryDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.mediaApplicationService.uploadZip(file, user.userId, query.mode ?? 'extract', req.traceId);
  }

  @Public()
  @Get()
  listMedia(@Query() query: QueryMediaDto) {
    return this.mediaApplicationService.listMedia(query);
  }

  @Public()
  @Post('resolve')
  resolveMedia(@Body() dto: ResolveMediaDto) {
    return this.mediaApplicationService.resolveMedia(dto);
  }

  @Public()
  @Post('images/batch-download')
  batchDownloadImages(@Body() dto: BatchImageDownloadDto) {
    return this.mediaApplicationService.prepareBatchImageDownload(dto);
  }

  @Public()
  @Post('zip/download')
  async downloadZip(
    @Body() dto: ZipMediaDownloadDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if ((dto.mode ?? 'package') === 'direct') {
      const payload = await this.mediaApplicationService.prepareDirectZipDownload(dto.mediaId!);
      const { media, size } = payload;
      const fileName = encodeContentDispositionFileName(media.originalName, media.fileName);

      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', `"${media.sha256}"`);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`);
      res.setHeader('Content-Length', size);
      return new StreamableFile(this.mediaApplicationService.createReadStream(media.storageKey));
    }

    const payload = await this.mediaApplicationService.prepareZipDownload(dto);
    const archiveName = encodeURIComponent(payload.fileName);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${archiveName}`);

    payload.archive.on('error', (error: Error) => {
      res.destroy(error);
    });

    const finalizeResult = payload.archive.finalize();
    if (finalizeResult instanceof Promise) {
      void finalizeResult.catch((error: Error) => res.destroy(error));
    }

    return new StreamableFile(payload.archive);
  }

  @Public()
  @Get(':id')
  getMediaDetail(@Param('id', ParseObjectIdPipe) id: string) {
    return this.mediaApplicationService.getMediaDetail(id);
  }

  @Public()
  @Get(':id/preview')
  async previewMedia(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const payload = await this.mediaApplicationService.preparePreview(id);
    const storageKey = payload.media.imagePreview?.storageKey ?? payload.media.storageKey;

    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', payload.eTag);

    if (req.headers['if-none-match'] === payload.eTag) {
      res.status(304);
      return new StreamableFile(Buffer.alloc(0));
    }

    res.setHeader('Content-Length', payload.size);
    return new StreamableFile(this.mediaApplicationService.createReadStream(storageKey));
  }

  @Public()
  @Get(':id/download')
  @Header('Accept-Ranges', 'bytes')
  async downloadMedia(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: DownloadMediaQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const payload = await this.mediaApplicationService.prepareDownload(id);
    const { media, size } = payload;
    const eTag = `"${media.sha256}"`;
    const disposition = query.disposition ?? (media.mediaType === 'image' ? 'inline' : 'attachment');
    const fileName = encodeContentDispositionFileName(media.originalName, media.fileName);

    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', eTag);
    if (disposition === 'attachment') {
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`);
    }

    if (req.headers['if-none-match'] === eTag) {
      res.status(304);
      return new StreamableFile(Buffer.alloc(0));
    }

    const rangeHeader = req.headers.range;
    if (typeof rangeHeader === 'string') {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : size - 1;

        if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end && end < size) {
          const stream = this.mediaApplicationService.createReadStream(media.storageKey, start, end);
          res.status(206);
          res.setHeader('Content-Length', end - start + 1);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
          return new StreamableFile(stream);
        }
      }
    }

    res.setHeader('Content-Length', size);
    return new StreamableFile(this.mediaApplicationService.createReadStream(media.storageKey));
  }
}
