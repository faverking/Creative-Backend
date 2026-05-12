import { Injectable } from '@nestjs/common';
import { ArticlesService, type HomeArticleItem } from '../../articles/articles.service';
import { BooksApplicationService, type HomeBookItem } from '../../books/application/books.application';
import { buildArticleBusinessTags } from '../../common/utils/content-tag.util';
import { toCoverView } from '../../common/utils/cover-view.util';
import { ImagesApplicationService, type HomeImageItem } from '../../images/application/images.application';
import { TopicsApplicationService, type HomeTopicItem } from '../../topics/application/topics.application';

const HOME_SECTION_LIMITS = {
  article: 4,
  topic: 3,
  book: 2,
  image: 3,
} as const;

@Injectable()
export class HomeApplicationService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly topicsApplicationService: TopicsApplicationService,
    private readonly booksApplicationService: BooksApplicationService,
    private readonly imagesApplicationService: ImagesApplicationService,
  ) {}

  async getHome(): Promise<unknown> {
    const [articleItems, topicItems, bookItems, imageItems] = await Promise.all([
      this.articlesService.listHome(HOME_SECTION_LIMITS.article),
      this.topicsApplicationService.listHome(HOME_SECTION_LIMITS.topic),
      this.booksApplicationService.listHome(HOME_SECTION_LIMITS.book),
      this.imagesApplicationService.listHome(HOME_SECTION_LIMITS.image),
    ]);

    return {
      articleSection: {
        featured: articleItems[0] ? this.toArticleFeatured(articleItems[0]) : null,
        items: articleItems.slice(1).map((item) => this.toArticleListItem(item)),
      },
      columnSection: {
        items: topicItems.map((item) => this.toColumnItem(item)),
      },
      bookshelfSection: {
        items: bookItems.map((item) => this.toBookshelfItem(item)),
      },
      gallerySection: {
        items: imageItems.map((item) => this.toGalleryItem(item)),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private toArticleFeatured(item: HomeArticleItem) {
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      cover: toCoverView(item.coverMedia),
      badge: 'FEATURED',
      tags: buildArticleBusinessTags(item.themeId),
      viewCount: item.viewCount,
      replyCount: item.replyCount,
      publishTime: item.postTime.toISOString(),
    };
  }

  private toArticleListItem(item: HomeArticleItem) {
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      cover: toCoverView(item.coverMedia),
      viewCount: item.viewCount,
      replyCount: item.replyCount,
      publishTime: item.postTime.toISOString(),
    };
  }

  private toColumnItem(item: HomeTopicItem) {
    return {
      id: item.id,
      topicId: item.topicId,
      title: item.title,
      summary: item.summary,
      cover: toCoverView(item.coverMedia),
      author: item.author,
      featureFlags: item.featureFlags,
      featureFlagLabels: item.featureFlagLabels,
      viewCount: item.viewCount,
      replyCount: item.replyCount,
    };
  }

  private toBookshelfItem(item: HomeBookItem) {
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      cover: toCoverView(item.coverMedia),
      tags: item.tags,
      authorNames: item.authorNames,
      viewCount: item.viewCount,
      replyCount: item.replyCount,
    };
  }

  private toGalleryItem(item: HomeImageItem) {
    return {
      id: item.id,
      title: item.title,
      meta: item.meta,
      qualityLabel: item.qualityLabel,
      resolution: item.resolution,
      badge: 'GALLERY',
      images: item.images,
      total: item.total,
      viewCount: item.viewCount,
      replyCount: item.replyCount,
    };
  }
}
