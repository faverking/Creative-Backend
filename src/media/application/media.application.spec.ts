import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaApplicationService } from './media.application';

function createConfigService(overrides?: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (overrides && key in overrides) {
        return overrides[key];
      }

      return defaultValue;
    }),
  } as unknown as ConfigService;
}

function createService(configService: ConfigService): MediaApplicationService {
  return new MediaApplicationService(
    {} as never,
    {} as never,
    configService,
    { recordEventually: jest.fn() } as never,
    { increment: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('MediaApplicationService', () => {
  it('rejects images whose pixel count exceeds the configured limit', () => {
    const service = createService(
      createConfigService({
        'media.imagePreviewConcurrency': 2,
        'media.imageMaxPixels': 10_000_000,
      }),
    );

    expect(() =>
      (service as unknown as { assertImageWithinPixelLimit: (meta: { width: number; height: number }) => void })
        .assertImageWithinPixelLimit({
          width: 5000,
          height: 3000,
        }),
    ).toThrow(PayloadTooLargeException);
  });

  it('removes disk-backed upload files when validation fails before processing starts', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'mononest-upload-'));
    const invalidFilePath = join(tempDir, 'invalid-upload');
    const pendingFilePath = join(tempDir, 'pending-upload');
    await writeFile(invalidFilePath, Buffer.alloc(1));
    await writeFile(pendingFilePath, Buffer.alloc(1));

    const service = createService(
      createConfigService({
        'media.imagePreviewConcurrency': 2,
        'media.ioConcurrency': 1,
      }),
    );

    try {
      await expect(
        service.uploadImages(
          [
            {
              originalname: 'invalid.png',
              mimetype: 'image/png',
              size: 0,
              path: invalidFilePath,
            },
            {
              originalname: 'pending.png',
              mimetype: 'image/png',
              size: 1,
              path: pendingFilePath,
            },
          ],
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(await pathExists(invalidFilePath)).toBe(false);
      expect(await pathExists(pendingFilePath)).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
