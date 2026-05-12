import { HomeApplicationService } from './home.application';

describe('HomeApplicationService', () => {
  it('applies the current home section limits', async () => {
    const articleItems = Array.from({ length: 4 }, (_, index) => ({
      id: `article-${index + 1}`,
      title: `Article ${index + 1}`,
      summary: `Summary ${index + 1}`,
      coverMedia: undefined,
      themeId: 1,
      viewCount: 0,
      replyCount: 0,
      postTime: new Date('2026-01-01T00:00:00.000Z'),
    }));

    const topicItems = Array.from({ length: 3 }, (_, index) => ({
      id: `topic-${index + 1}`,
      topicId: index + 1,
      title: `Topic ${index + 1}`,
      summary: `Topic summary ${index + 1}`,
      coverMedia: undefined,
      author: undefined,
      featureFlags: [],
      featureFlagLabels: [],
      viewCount: 0,
      replyCount: 0,
    }));

    const bookItems = Array.from({ length: 2 }, (_, index) => ({
      id: `book-${index + 1}`,
      title: `Book ${index + 1}`,
      summary: `Book summary ${index + 1}`,
      coverMedia: undefined,
      tags: [],
      authorNames: [],
      viewCount: 0,
      replyCount: 0,
    }));

    const imageItems = Array.from({ length: 3 }, (_, index) => ({
      id: `image-${index + 1}`,
      title: `Image ${index + 1}`,
      meta: `Meta ${index + 1}`,
      qualityLabel: undefined,
      resolution: undefined,
      images: [],
      total: 0,
      viewCount: 0,
      replyCount: 0,
    }));

    const articleListHome = jest.fn().mockResolvedValue(articleItems);
    const topicListHome = jest.fn().mockResolvedValue(topicItems);
    const bookListHome = jest.fn().mockResolvedValue(bookItems);
    const imageListHome = jest.fn().mockResolvedValue(imageItems);

    const articlesService = {
      listHome: articleListHome,
    } as never;
    const topicsService = {
      listHome: topicListHome,
    } as never;
    const booksService = {
      listHome: bookListHome,
    } as never;
    const imagesService = {
      listHome: imageListHome,
    } as never;

    const service = new HomeApplicationService(
      articlesService,
      topicsService,
      booksService,
      imagesService,
    );

    const result = (await service.getHome()) as {
      articleSection: { featured: Record<string, unknown> | null; items: Array<Record<string, unknown>> };
      columnSection: { items: Array<Record<string, unknown>> };
      bookshelfSection: { items: Array<Record<string, unknown>> };
      gallerySection: { items: Array<Record<string, unknown>> };
    };

    expect(articleListHome).toHaveBeenCalledWith(4);
    expect(topicListHome).toHaveBeenCalledWith(3);
    expect(bookListHome).toHaveBeenCalledWith(2);
    expect(imageListHome).toHaveBeenCalledWith(3);
    expect(result.articleSection.featured).not.toBeNull();
    expect(result.articleSection.items).toHaveLength(3);
    expect(result.columnSection.items).toHaveLength(3);
    expect(result.bookshelfSection.items).toHaveLength(2);
    expect(result.gallerySection.items).toHaveLength(3);
  });

  it('returns topicId for home column items', async () => {
    const service = new HomeApplicationService(
      {
        listHome: jest.fn().mockResolvedValue([]),
      } as never,
      {
        listHome: jest.fn().mockResolvedValue([
          {
            id: 'topic-1',
            topicId: 2,
            title: 'Topic title',
            summary: 'Topic summary',
            coverMedia: undefined,
            author: undefined,
            featureFlags: [1, 3],
            featureFlagLabels: ['汉化', 'PC'],
            viewCount: 12,
            replyCount: 3,
          },
        ]),
      } as never,
      {
        listHome: jest.fn().mockResolvedValue([]),
      } as never,
      {
        listHome: jest.fn().mockResolvedValue([]),
      } as never,
    );

    const result = (await service.getHome()) as {
      columnSection: { items: Array<Record<string, unknown>> };
    };

    expect(result.columnSection.items).toHaveLength(1);
    expect(result.columnSection.items[0]).toMatchObject({
      id: 'topic-1',
      topicId: 2,
    });
  });
});
