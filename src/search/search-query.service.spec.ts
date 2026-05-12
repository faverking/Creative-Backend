import { SearchQueryService } from './search-query.service';

describe('SearchQueryService', () => {
  it('returns empty result for blank full-text queries without hitting the repository', async () => {
    const repository = {
      searchArticles: jest.fn(),
      searchBooks: jest.fn(),
      searchImages: jest.fn(),
      searchTopics: jest.fn(),
    };
    const service = new SearchQueryService(repository as never);

    await expect(service.fullTextSearch({ q: '   ', scope: 'all', page: 2, limit: 5 })).resolves.toEqual({
      query: '',
      scope: 'all',
      page: 2,
      limit: 5,
      total: 0,
      items: [],
    });
    expect(repository.searchArticles).not.toHaveBeenCalled();
    expect(repository.searchBooks).not.toHaveBeenCalled();
    expect(repository.searchImages).not.toHaveBeenCalled();
    expect(repository.searchTopics).not.toHaveBeenCalled();
  });

  it('aggregates totals for full-text all-scope searches', async () => {
    const repository = {
      searchArticles: jest.fn().mockResolvedValue({ total: 3, items: [{ id: 'a1' }] }),
      searchBooks: jest.fn().mockResolvedValue({ total: 2, items: [{ id: 'b1' }] }),
      searchImages: jest.fn().mockResolvedValue({ total: 1, items: [{ id: 'i1' }] }),
      searchTopics: jest.fn().mockResolvedValue({ total: 4, items: [{ id: 't1' }] }),
    };
    const service = new SearchQueryService(repository as never);

    await expect(service.fullTextSearch({ q: 'design', scope: 'all', page: 1, limit: 10 })).resolves.toEqual({
      query: 'design',
      scope: 'all',
      page: 1,
      limit: 10,
      groups: {
        articles: { total: 3, items: [{ id: 'a1' }] },
        books: { total: 2, items: [{ id: 'b1' }] },
        images: { total: 1, items: [{ id: 'i1' }] },
        topics: { total: 4, items: [{ id: 't1' }] },
      },
      total: 10,
    });
  });

  it('merges quick-search results by freshness and respects the requested limit', async () => {
    const repository = {
      quickSearchArticles: jest.fn().mockResolvedValue([
        { id: 'a1', type: 'article', title: 'Article', snippet: 'A', time: new Date('2026-04-03T10:00:00.000Z') },
      ]),
      quickSearchBooks: jest.fn().mockResolvedValue([
        { id: 'b1', type: 'book', title: 'Book', snippet: 'B', time: new Date('2026-04-03T12:00:00.000Z') },
      ]),
      quickSearchImages: jest.fn().mockResolvedValue([
        { id: 'i1', type: 'image', title: 'Image', snippet: 'I', time: new Date('2026-04-03T11:00:00.000Z') },
      ]),
      quickSearchTopics: jest.fn().mockResolvedValue([
        { id: 't1', type: 'topic', title: 'Topic', snippet: 'T', time: new Date('2026-04-03T09:00:00.000Z') },
      ]),
    };
    const service = new SearchQueryService(repository as never);

    await expect(service.quickSearch({ q: 'mono', limit: 2 })).resolves.toEqual({
      query: 'mono',
      limit: 2,
      items: [
        { id: 'b1', type: 'book', title: 'Book', snippet: 'B', time: new Date('2026-04-03T12:00:00.000Z') },
        { id: 'i1', type: 'image', title: 'Image', snippet: 'I', time: new Date('2026-04-03T11:00:00.000Z') },
      ],
      groups: {
        articles: 1,
        books: 1,
        images: 1,
        topics: 1,
      },
    });
    expect(repository.quickSearchArticles).toHaveBeenCalledWith(expect.any(RegExp), 2);
    expect(repository.quickSearchBooks).toHaveBeenCalledWith(expect.any(RegExp), 2);
    expect(repository.quickSearchImages).toHaveBeenCalledWith(expect.any(RegExp), 2);
    expect(repository.quickSearchTopics).toHaveBeenCalledWith(expect.any(RegExp), 2);
  });
});
