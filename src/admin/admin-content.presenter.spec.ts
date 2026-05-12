import { BUSINESS_LABELS } from '../common/constants/content-taxonomy.constants';
import { ReviewStatus } from '../common/enums/review-status.enum';
import { TargetType } from '../common/enums/target-type.enum';
import { Visibility } from '../common/enums/visibility.enum';
import type { FeaturedContentAdminItem } from '../featured-contents/featured-contents.service';
import type { ImageMediaPresentation, MediaSummary } from '../media/application/media.application';
import type { UserSafeProfile } from '../users/users.service';
import { AdminContentPresenter } from './admin-content.presenter';

describe('AdminContentPresenter', () => {
  const presenter = new AdminContentPresenter();

  it('builds article details with full image assets and compact owner info', () => {
    const article = {
      id: 'article-1',
      title: 'Monorepo Deep Dive',
      desc: 'Structure review',
      content: '<p>content</p>',
      images: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
      theme_id: 2,
      view_count: 120,
      favor_count: 16,
      reply_count: 8,
      review_status: ReviewStatus.APPROVED,
      visibility: Visibility.PUBLIC,
      status: 1,
      deleted_at: undefined,
      post_time: new Date('2026-04-03T08:00:00.000Z'),
      update_time: new Date('2026-04-03T09:00:00.000Z'),
    } as never;
    const owner = createOwner();
    const featuredConfig = createFeaturedConfig(TargetType.ARTICLE, 'article-1');
    const mediaMap = new Map<string, MediaSummary>([
      ['507f1f77bcf86cd799439011', createMediaSummary('507f1f77bcf86cd799439011')],
      ['507f1f77bcf86cd799439012', createMediaSummary('507f1f77bcf86cd799439012')],
    ]);

    expect(
      presenter.toArticleDetail(
        article,
        mediaMap,
        owner,
        featuredConfig,
        ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
      ),
    ).toEqual(
      expect.objectContaining({
        id: 'article-1',
        type: TargetType.ARTICLE,
        businessLabel: BUSINESS_LABELS[1],
        owner: {
          id: owner.id,
          name: owner.name,
          avatarUrl: owner.avatarUrl,
        },
        featured: true,
        featuredConfig,
        imageMediaIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        imageAssets: [
          {
            id: '507f1f77bcf86cd799439011',
            previewPath: '/preview/507f1f77bcf86cd799439011',
            downloadPath: '/download/507f1f77bcf86cd799439011',
            attachmentPath: '/attachment/507f1f77bcf86cd799439011',
          },
          {
            id: '507f1f77bcf86cd799439012',
            previewPath: '/preview/507f1f77bcf86cd799439012',
            downloadPath: '/download/507f1f77bcf86cd799439012',
            attachmentPath: '/attachment/507f1f77bcf86cd799439012',
          },
        ],
        cover: {
          previewPath: '/preview/507f1f77bcf86cd799439011',
          downloadPath: '/download/507f1f77bcf86cd799439011',
        },
      }),
    );
  });

  it('prefers explicit image covers and keeps image asset lists scoped to the package images', () => {
    const imagePackage = {
      id: 'image-1',
      title: 'Spring Gallery',
      desc: 'A curated image set',
      images: ['507f1f77bcf86cd799439021', '507f1f77bcf86cd799439022'],
      cover: '/api/v1/media/507f1f77bcf86cd799439099/download',
      theme_id: 3,
      total: 2,
      source: 'official',
      view_count: 90,
      favor_count: 12,
      reply_count: 4,
      review_status: ReviewStatus.APPROVED,
      visibility: Visibility.PUBLIC,
      upload_time: new Date('2026-04-03T10:00:00.000Z'),
    } as never;
    const mediaMap = new Map<string, ImageMediaPresentation>([
      ['507f1f77bcf86cd799439021', createImagePresentation('507f1f77bcf86cd799439021')],
      ['507f1f77bcf86cd799439022', createImagePresentation('507f1f77bcf86cd799439022')],
      [
        '507f1f77bcf86cd799439099',
        createImagePresentation('507f1f77bcf86cd799439099', {
          qualityLabel: '4K',
          resolution: '3840x2160',
          width: 3840,
          height: 2160,
        }),
      ],
    ]);

    expect(
      presenter.toImageDetail(
        imagePackage,
        mediaMap,
        createOwner(),
        createFeaturedConfig(TargetType.IMAGE, 'image-1'),
        ['507f1f77bcf86cd799439021', '507f1f77bcf86cd799439022'],
      ),
    ).toEqual(
      expect.objectContaining({
        id: 'image-1',
        type: TargetType.IMAGE,
        businessLabel: BUSINESS_LABELS[3],
        coverMediaId: '507f1f77bcf86cd799439099',
        qualityLabel: '4K',
        resolution: '3840x2160',
        cover: {
          previewPath: '/preview/507f1f77bcf86cd799439099',
          downloadPath: '/download/507f1f77bcf86cd799439099',
        },
        imageAssets: [
          {
            id: '507f1f77bcf86cd799439021',
            previewPath: '/preview/507f1f77bcf86cd799439021',
            downloadPath: '/download/507f1f77bcf86cd799439021',
            attachmentPath: '/attachment/507f1f77bcf86cd799439021',
          },
          {
            id: '507f1f77bcf86cd799439022',
            previewPath: '/preview/507f1f77bcf86cd799439022',
            downloadPath: '/download/507f1f77bcf86cd799439022',
            attachmentPath: '/attachment/507f1f77bcf86cd799439022',
          },
        ],
      }),
    );
  });
});

function createOwner(): UserSafeProfile {
  return {
    id: 'user-1',
    email: 'mono@example.com',
    name: 'Mono Nest',
    status: 'active' as never,
    roles: ['user'],
    avatarUrl: '/avatars/mono.png',
    bio: 'Backend maintainer',
    createdAt: new Date('2026-04-03T00:00:00.000Z'),
    updatedAt: new Date('2026-04-03T00:00:00.000Z'),
  };
}

function createFeaturedConfig(targetType: TargetType, targetId: string): FeaturedContentAdminItem {
  return {
    id: `${targetType}-${targetId}`,
    scene: 'home_featured',
    targetType,
    targetId,
    rank: 1,
    enabled: true,
    activeNow: true,
    startAt: '2026-04-03T00:00:00.000Z',
    endAt: '2026-04-10T00:00:00.000Z',
    note: '',
    operatorId: 'admin-1',
    createTime: '2026-04-03T00:00:00.000Z',
    updateTime: '2026-04-03T00:00:00.000Z',
  };
}

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

function createImagePresentation(
  id: string,
  quality: { qualityLabel: string; resolution: string; width: number; height: number } = {
    qualityLabel: 'HD',
    resolution: '1920x1080',
    width: 1920,
    height: 1080,
  },
): ImageMediaPresentation {
  return {
    summary: createMediaSummary(id),
    quality,
  };
}
