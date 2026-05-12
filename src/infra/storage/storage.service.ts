import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaType } from '../../media/dto/media.dto';

interface SaveBufferInput {
  mediaId: string;
  mediaType: MediaType;
  extension: string;
  buffer: Buffer;
  variant?: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private rootDir = '';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.rootDir = resolve(this.configService.get<string>('media.storageRoot', '.storage/media'));
    await mkdir(this.rootDir, { recursive: true });
  }

  getUploadPolicy(): { provider: string; note: string; rootDir: string } {
    return {
      provider: 'local',
      note: 'Local file storage, can be replaced by OSS/COS/S3 later.',
      rootDir: this.rootDir,
    };
  }

  createSha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  resolveExtension(originalName: string, mimeType: string): string {
    const normalized = extname(originalName).toLowerCase();
    if (normalized) {
      return normalized;
    }

    const fallback = mimeType.split('/')[1]?.toLowerCase() ?? 'bin';
    return `.${fallback.replace(/[^a-z0-9]/g, '') || 'bin'}`;
  }

  async saveBuffer(input: SaveBufferInput): Promise<{ storageKey: string; fileName: string }> {
    const storageKey = this.buildStorageKey(input.mediaType, input.mediaId, input.extension, input.variant);
    const absolutePath = this.toAbsolutePath(storageKey);
    const directory = dirname(absolutePath);
    const tempPath = `${absolutePath}.tmp-${Date.now()}`;

    await mkdir(directory, { recursive: true });
    await writeFile(tempPath, input.buffer);
    await rename(tempPath, absolutePath);

    return {
      storageKey,
      fileName: input.variant ? `${input.mediaId}-${input.variant}${input.extension}` : `${input.mediaId}${input.extension}`,
    };
  }

  async stat(storageKey: string): Promise<{ size: number } | null> {
    try {
      const stats = await stat(this.toAbsolutePath(storageKey));
      return { size: stats.size };
    } catch {
      return null;
    }
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.toAbsolutePath(storageKey), { force: true });
  }

  createReadStream(storageKey: string, start?: number, end?: number) {
    return createReadStream(this.toAbsolutePath(storageKey), {
      start,
      end,
    });
  }

  private buildStorageKey(mediaType: MediaType, mediaId: string, extension: string, variant?: string): string {
    const first = mediaId.slice(0, 2);
    const second = mediaId.slice(2, 4);
    const fileName = variant ? `${mediaId}-${variant}${extension}` : `${mediaId}${extension}`;
    return join(mediaType, first, second, fileName);
  }

  private toAbsolutePath(storageKey: string): string {
    return join(this.rootDir, storageKey);
  }
}
