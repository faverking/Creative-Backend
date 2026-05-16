import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  mixin,
  PayloadTooLargeException,
  type Type,
  type NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { isMediaUploadDebugEnabled, maybeBreakMediaUpload } from '../utils/upload-debug.util';

const multer = require('multer') as {
  (options?: Record<string, unknown>): {
    single(fieldName: string): (
      request: unknown,
      response: unknown,
      callback: (error?: unknown) => void,
    ) => void;
    array(
      fieldName: string,
      maxCount?: number,
    ): (
      request: unknown,
      response: unknown,
      callback: (error?: unknown) => void,
    ) => void;
  };
  MulterError: new (code: string, field?: string) => {
    code: string;
    field?: string;
    message: string;
  };
};

type UploadKind = 'single' | 'multiple';

interface UploadLimitOptions {
  fieldName: string;
  kind: UploadKind;
  maxCount?: number;
  fileSizeConfigKey: string;
  fileSizeDefault: number;
  filesConfigKey?: string;
  filesDefault?: number;
  fileLabel: string;
}

type UploadMiddleware = (
  request: unknown,
  response: unknown,
  callback: (error?: unknown) => void,
) => void;

function createUploadException(
  error: unknown,
  options: {
    maxCount: number | undefined;
    fileSize: number;
    fileLabel: string;
  },
): Error {
  if (!(error instanceof multer.MulterError)) {
    return error instanceof Error ? error : new BadRequestException('Upload failed');
  }

  const multerError = error as { code: string; field?: string; message: string };

  switch (multerError.code) {
    case 'LIMIT_FILE_SIZE':
      return new PayloadTooLargeException(
        `${options.fileLabel} exceeds size limit of ${options.fileSize} bytes`,
      );
    case 'LIMIT_FILE_COUNT':
      return new BadRequestException(
        `${options.fileLabel} count exceeds limit of ${options.maxCount ?? 1}`,
      );
    case 'LIMIT_UNEXPECTED_FILE':
      return new BadRequestException(`Unexpected upload field: ${multerError.field ?? 'unknown'}`);
    default:
      return new BadRequestException(multerError.message);
  }
}

function createUploadMiddleware(
  configService: ConfigService,
  options: UploadLimitOptions,
): UploadMiddleware {
  const fileSize = configService.get<number>(options.fileSizeConfigKey, options.fileSizeDefault);
  const maxCount = options.kind === 'multiple'
    ? configService.get<number>(options.filesConfigKey!, options.filesDefault!)
    : undefined;

  const diskUploadOptions = options.kind === 'multiple'
    ? {
        dest: ensureUploadTempDir(),
      }
    : {};
  const middleware = multer({
    ...diskUploadOptions,
    limits: {
      fileSize,
      ...(typeof maxCount === 'number' ? { files: maxCount } : {}),
    },
  });

  return options.kind === 'multiple'
    ? middleware.array(options.fieldName, maxCount)
    : middleware.single(options.fieldName);
}

function sumParsedFileSizes(request: {
  file?: { size?: number };
  files?: Array<{ size?: number }>;
}): number {
  if (Array.isArray(request.files)) {
    return request.files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  }

  return request.file?.size ?? 0;
}

function ensureUploadTempDir(): string {
  const directory = join(process.cwd(), '.tmp-uploads');
  mkdirSync(directory, { recursive: true });
  return directory;
}

function buildConfiguredUploadInterceptor(options: UploadLimitOptions): Type<NestInterceptor> {
  @Injectable()
  class ConfiguredUploadInterceptor implements NestInterceptor {
    private readonly logger = new Logger(`ConfiguredUploadInterceptor:${options.fieldName}`);

    constructor(private readonly configService: ConfigService) {}

    async intercept(context: ExecutionContext, next: CallHandler) {
      const http = context.switchToHttp();
      const request = http.getRequest();
      const response = http.getResponse();

      const fileSize = this.configService.get<number>(options.fileSizeConfigKey, options.fileSizeDefault);
      const maxCount = options.kind === 'multiple'
        ? this.configService.get<number>(options.filesConfigKey!, options.filesDefault!)
        : undefined;
      const upload = createUploadMiddleware(this.configService, options);
      const debugPayload = this.buildDebugPayload(request, fileSize, maxCount, 'before-multer');
      this.debugUpload('before-multer', debugPayload);

      await new Promise<void>((resolve, reject) => {
        upload(request, response, (error: unknown) => {
          if (error) {
            this.debugUpload('multer-error', {
              ...this.buildDebugPayload(request, fileSize, maxCount, 'multer-error'),
              error: this.toUploadErrorPayload(error),
            });
            reject(
              createUploadException(error, {
                maxCount,
                fileSize,
                fileLabel: options.fileLabel,
              }),
            );
            return;
          }

          this.debugUpload('after-multer', this.buildDebugPayload(request, fileSize, maxCount, 'after-multer'));
          resolve();
        });
      });

      return next.handle();
    }

    private debugUpload(phase: string, payload: Record<string, unknown>): void {
      if (!isMediaUploadDebugEnabled()) {
        return;
      }

      this.logger.debug(JSON.stringify(payload));
      maybeBreakMediaUpload(phase, payload);
    }

    private buildDebugPayload(
      request: {
        traceId?: string;
        method?: string;
        url?: string;
        headers?: Record<string, string | string[] | undefined>;
        file?: { size?: number; mimetype?: string };
        files?: Array<{ size?: number; mimetype?: string; path?: string }>;
      },
      fileSize: number,
      maxCount: number | undefined,
      phase: string,
    ): Record<string, unknown> {
      const files = Array.isArray(request.files) ? request.files : [];
      return {
        event: 'media.upload.interceptor',
        phase,
        traceId: request.traceId ?? '',
        method: request.method ?? '',
        url: request.url ?? '',
        fieldName: options.fieldName,
        kind: options.kind,
        contentLength: request.headers?.['content-length'] ?? '',
        configuredFileSize: fileSize,
        configuredMaxCount: maxCount,
        parsedFileCount: files.length || (request.file ? 1 : 0),
        parsedTotalSize: sumParsedFileSizes(request),
        parsedStorage: files.length > 0 ? files.map((file) => file.path ? 'disk' : 'memory') : request.file ? ['memory'] : [],
        parsedSizes: files.length > 0 ? files.map((file) => file.size ?? 0) : request.file ? [request.file.size ?? 0] : [],
        parsedMimeTypes: files.length > 0
          ? files.map((file) => file.mimetype ?? '')
          : request.file
            ? [request.file.mimetype ?? '']
            : [],
      };
    }

    private toUploadErrorPayload(error: unknown): Record<string, unknown> {
      if (!(error instanceof Error)) {
        return {
          message: 'unknown upload error',
        };
      }

      return {
        name: error.name,
        message: error.message,
        code: 'code' in error ? (error as { code?: unknown }).code : undefined,
        field: 'field' in error ? (error as { field?: unknown }).field : undefined,
      };
    }
  }

  return mixin(ConfiguredUploadInterceptor);
}

export function ConfiguredFilesUploadInterceptor(
  fieldName: string,
  fileLabel: string,
  filesConfigKey: string,
  filesDefault: number,
  fileSizeConfigKey: string,
  fileSizeDefault: number,
): Type<NestInterceptor> {
  return buildConfiguredUploadInterceptor({
    fieldName,
    kind: 'multiple',
    filesConfigKey,
    filesDefault,
    fileSizeConfigKey,
    fileSizeDefault,
    fileLabel,
  });
}

export function ConfiguredFileUploadInterceptor(
  fieldName: string,
  fileLabel: string,
  fileSizeConfigKey: string,
  fileSizeDefault: number,
): Type<NestInterceptor> {
  return buildConfiguredUploadInterceptor({
    fieldName,
    kind: 'single',
    fileSizeConfigKey,
    fileSizeDefault,
    fileLabel,
  });
}
