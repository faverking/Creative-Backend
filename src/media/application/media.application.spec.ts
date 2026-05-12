import { PayloadTooLargeException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
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
});
