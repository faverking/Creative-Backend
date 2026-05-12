import type { MediaSummary } from '../../media/application/media.application';
import {
  mapPrimaryReferencedMediaAsset,
  mapReferencedMediaAssets,
  mapSingleReferencedMediaAsset,
  resolveImagePackageCoverMediaId,
  toCompactUserIdentity,
} from './content-presentation.util';

describe('content-presentation.util', () => {
  it('returns a compact user identity without extra fields', () => {
    expect(
      toCompactUserIdentity({
        id: 'user-1',
        name: 'Mono',
        avatarUrl: '/avatars/mono.png',
      }),
    ).toEqual({
      id: 'user-1',
      name: 'Mono',
      avatarUrl: '/avatars/mono.png',
    });
  });

  it('maps media summaries into compact assets', () => {
    const mediaMap = new Map<string, MediaSummary>([
      ['507f1f77bcf86cd799439011', createMediaSummary('507f1f77bcf86cd799439011')],
      ['507f1f77bcf86cd799439012', createMediaSummary('507f1f77bcf86cd799439012')],
    ]);

    expect(
      mapReferencedMediaAssets(
        ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        mediaMap,
        'compact',
      ),
    ).toEqual([
      {
        id: '507f1f77bcf86cd799439011',
        previewPath: '/preview/507f1f77bcf86cd799439011',
        downloadPath: '/preview/507f1f77bcf86cd799439011',
        attachmentPath: '/preview/507f1f77bcf86cd799439011',
      },
      {
        id: '507f1f77bcf86cd799439012',
        previewPath: '/preview/507f1f77bcf86cd799439012',
        downloadPath: '/preview/507f1f77bcf86cd799439012',
        attachmentPath: '/preview/507f1f77bcf86cd799439012',
      },
    ]);
  });

  it('reads media summaries from presentation wrappers', () => {
    const mediaMap = new Map([
      [
        '507f1f77bcf86cd799439013',
        {
          summary: createMediaSummary('507f1f77bcf86cd799439013'),
        },
      ],
    ]);

    expect(
      mapSingleReferencedMediaAsset('507f1f77bcf86cd799439013', mediaMap),
    ).toEqual({
      id: '507f1f77bcf86cd799439013',
      previewPath: '/preview/507f1f77bcf86cd799439013',
      downloadPath: '/download/507f1f77bcf86cd799439013',
      attachmentPath: '/attachment/507f1f77bcf86cd799439013',
    });

    expect(
      mapPrimaryReferencedMediaAsset(['507f1f77bcf86cd799439013'], mediaMap, 'compact'),
    ).toEqual({
      id: '507f1f77bcf86cd799439013',
      previewPath: '/preview/507f1f77bcf86cd799439013',
      downloadPath: '/preview/507f1f77bcf86cd799439013',
      attachmentPath: '/preview/507f1f77bcf86cd799439013',
    });
  });

  it('prefers explicit image package covers before falling back to the first image', () => {
    expect(
      resolveImagePackageCoverMediaId({
        cover: '/api/v1/media/507f1f77bcf86cd799439014/download',
        images: ['507f1f77bcf86cd799439015'],
      }),
    ).toBe('507f1f77bcf86cd799439014');

    expect(
      resolveImagePackageCoverMediaId({
        images: ['507f1f77bcf86cd799439015', '507f1f77bcf86cd799439016'],
      }),
    ).toBe('507f1f77bcf86cd799439015');
  });
});

function createMediaSummary(id: string): MediaSummary {
  return {
    id,
    type: 'image',
    originalName: `${id}.png`,
    fileName: `${id}.png`,
    mimeType: 'image/png',
    size: 1024,
    sha256: `${id}-sha`,
    cacheKey: `${id}-cache`,
    createdAt: new Date('2026-04-03T00:00:00.000Z'),
    detailPath: `/detail/${id}`,
    previewPath: `/preview/${id}`,
    downloadPath: `/download/${id}`,
    attachmentPath: `/attachment/${id}`,
  };
}
