import { Injectable } from '@nestjs/common';
import { buildStartsWithRegex } from '../common/utils/regex.util';
import { type FeaturedContentType, type SearchScope, FullTextSearchDto, QuickSearchDto } from './dto/search.dto';
import { SearchRepository, type SearchGroup, type SearchItem } from './repositories/search.repository';

type SearchGroupMap = Record<Exclude<SearchScope, 'all'>, SearchGroup>;
type QuickSearchGroupCounts = Record<`${FeaturedContentType}s`, number>;

@Injectable()
export class SearchQueryService {
  constructor(private readonly searchRepository: SearchRepository) {}

  async fullTextSearch(dto: FullTextSearchDto): Promise<unknown> {
    const query = dto.q.trim();
    const scope = dto.scope ?? 'all';
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;

    if (!query) {
      return {
        query,
        scope,
        page,
        limit,
        total: 0,
        items: [],
      };
    }

    if (scope === 'all') {
      const groups = await this.searchAllGroups(query, page, limit);
      return {
        query,
        scope,
        page,
        limit,
        groups,
        total:
          groups.articles.total +
          groups.books.total +
          groups.images.total +
          groups.topics.total,
      };
    }

    const result = await this.searchByScope(scope, query, page, limit);
    return {
      query,
      scope,
      page,
      limit,
      total: result.total,
      items: result.items,
    };
  }

  async quickSearch(dto: QuickSearchDto): Promise<unknown> {
    const query = dto.q.trim();
    const limit = dto.limit ?? 8;

    if (!query) {
      return {
        query,
        limit,
        items: [],
      };
    }

    const regex = buildStartsWithRegex(query);
    const [articles, books, images, topics] = await Promise.all([
      this.searchRepository.quickSearchArticles(regex, limit),
      this.searchRepository.quickSearchBooks(regex, limit),
      this.searchRepository.quickSearchImages(regex, limit),
      this.searchRepository.quickSearchTopics(regex, limit),
    ]);

    const merged: SearchItem[] = [...articles, ...books, ...images, ...topics]
      .sort((left, right) => (right.time?.getTime() ?? 0) - (left.time?.getTime() ?? 0))
      .slice(0, limit);

    return {
      query,
      limit,
      items: merged,
      groups: {
        articles: articles.length,
        books: books.length,
        images: images.length,
        topics: topics.length,
      } satisfies QuickSearchGroupCounts,
    };
  }

  private async searchAllGroups(query: string, page: number, limit: number): Promise<SearchGroupMap> {
    const [articles, books, images, topics] = await Promise.all([
      this.searchRepository.searchArticles(query, page, limit),
      this.searchRepository.searchBooks(query, page, limit),
      this.searchRepository.searchImages(query, page, limit),
      this.searchRepository.searchTopics(query, page, limit),
    ]);

    return {
      articles,
      books,
      images,
      topics,
    };
  }

  private searchByScope(scope: Exclude<SearchScope, 'all'>, query: string, page: number, limit: number): Promise<SearchGroup> {
    switch (scope) {
      case 'articles':
        return this.searchRepository.searchArticles(query, page, limit);
      case 'books':
        return this.searchRepository.searchBooks(query, page, limit);
      case 'images':
        return this.searchRepository.searchImages(query, page, limit);
      case 'topics':
        return this.searchRepository.searchTopics(query, page, limit);
    }
  }
}
