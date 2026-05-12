import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { type MediaVariant } from '../../common/constants/content-query.constants';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { TargetType } from '../../common/enums/target-type.enum';
import { Visibility } from '../../common/enums/visibility.enum';
import { buildBookCompositeTags } from '../../common/utils/content-tag.util';
import { mapSingleReferencedMediaAsset } from '../../common/utils/content-presentation.util';
import { buildShanghaiDateRangeFilter } from '../../common/utils/date-range.util';
import { buildKeywordSearchFilter, buildKeywordSearchTerms } from '../../common/utils/keyword-search.util';
import { extractMediaReferenceId } from '../../common/utils/media-reference.util';
import { buildStartsWithRegex } from '../../common/utils/regex.util';
import { buildApprovedPublicFilter } from '../../common/utils/public-content-filter.util';
import {
  pickMediaPath,
  type ResolvedMediaAssetMode,
  type ResolvedMediaAsset,
} from '../../common/utils/media-summary.util';
import { AuditService } from '../../infra/audit/audit.service';
import { MongoTransactionService } from '../../infra/database/mongo-transaction.service';
import { ContentOperationLockService } from '../../infra/redis/content-operation-lock.service';
import { MediaApplicationService, type MediaSummary } from '../../media/application/media.application';
import { WorkspaceRelationCleanupService } from '../../workspace/workspace-relation-cleanup.service';
import { BooksDomainService } from '../domain/books.domain.service';
import { CreateBookDto, QueryBooksDto, QueryMyBooksDto, UpdateBookDto, UpsertBookChaptersDto } from '../dto/book.dto';
import { BooksRepository } from '../repositories/books.repository';
import type { BookDetailDocument } from '../schemas/book.schema';

export interface HomeBookItem {
  id: string;
  title: string;
  summary: string;
  coverMedia?: ResolvedMediaAsset;
  tags: string[];
  authorNames: string[];
  viewCount: number;
  replyCount: number;
}

@Injectable()
export class BooksApplicationService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly booksDomainService: BooksDomainService,
    private readonly auditService: AuditService,
    private readonly mediaApplicationService: MediaApplicationService,
    private readonly mongoTransactionService: MongoTransactionService,
    private readonly contentOperationLockService: ContentOperationLockService,
    private readonly workspaceRelationCleanupService: WorkspaceRelationCleanupService,
  ) {}

  async createBook(dto: CreateBookDto, operatorId: string, traceId?: string): Promise<unknown> {
    const coverMediaId = extractMediaReferenceId(dto.cover);
    if (!coverMediaId) {
      throw new BadRequestException('Book cover is required');
    }

    await this.mediaApplicationService.assertMediaIdsExist([coverMediaId], 'image');

    const payload = this.booksDomainService.buildDetailPayload({
      ...dto,
      cover: coverMediaId,
    });
    const chapterList = dto.chapterList ?? [];
    const created = await this.booksRepository.createBookDetail({
      ...payload,
      search_terms: buildKeywordSearchTerms(dto.name, dto.desc),
      user_id: new Types.ObjectId(operatorId),
      view_count: 0,
      reply_count: 0,
      total: this.booksDomainService.getChapterTotal(chapterList),
      favor_count: 0,
      review_status: ReviewStatus.APPROVED,
      visibility: Visibility.PUBLIC,
    });

    if (Array.isArray(dto.chapterList)) {
      await this.booksRepository.upsertChapter(
        created.id,
        this.booksDomainService.buildChapterPayload({
          chapterList: dto.chapterList,
        }),
      );
    }

    this.auditService.recordEventually({
      operatorId,
      action: 'book.create',
      resourceType: 'book',
      resourceId: created.id,
      traceId,
    });

    const chapter = await this.booksRepository.findChapterByBookId(created.id);
    const mediaMap = await this.createMediaSummaryMap([created.cover]);
    return {
      ...this.toEditableDetail(created, mediaMap),
      chapterList: chapter?.chapter_list ?? [],
      origin: chapter?.origin,
      comicId: chapter?.comic_id ?? '',
      novelId: chapter?.novel_id ?? '',
      otherId: chapter?.other_id ?? '',
    };
  }

  async listBooks(query: QueryBooksDto): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const mediaVariant = query.mediaVariant ?? 'download';

    const filter: Record<string, unknown> = {
      ...buildApprovedPublicFilter(),
    };
    if (typeof query.part === 'number') {
      filter.part = query.part;
    }
    if (typeof query.status === 'number') {
      filter.status = query.status;
    }
    if (typeof query.area === 'number') {
      filter.area = query.area;
    }
    Object.assign(filter, buildKeywordSearchFilter(query.keyword));

    const { items, total } = await this.booksRepository.listBookDetails(
      filter,
      page,
      limit,
      this.resolveListSort(query.sort),
    );
    const mediaMap = await this.createMediaSummaryMap(items.map((item) => item.cover));

    return {
      items: items.map((item) => this.toListItem(item, mediaMap, mediaVariant)),
      page,
      limit,
      total,
    };
  }

  async listHome(limit: number): Promise<HomeBookItem[]> {
    const { items } = await this.booksRepository.listBookDetails(
      buildApprovedPublicFilter(),
      1,
      limit,
      this.resolveListSort('recommend'),
    );
    const mediaMap = await this.createMediaSummaryMap(items.map((item) => item.cover));
    return items.map((item) => this.toHomeItem(item, mediaMap));
  }

  async listMyBooks(userId: string, query: QueryMyBooksDto): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter: Record<string, unknown> = {
      user_id: new Types.ObjectId(userId),
    };

    if (query.title) {
      filter.name = buildStartsWithRegex(query.title);
    }

    const createTimeRange = buildShanghaiDateRangeFilter(query.startDate, query.endDate);
    if (createTimeRange) {
      filter.create_time = createTimeRange;
    }
    const { items, total } = await this.booksRepository.listBookDetails(filter, page, limit, { create_time: -1 });
    const mediaMap = await this.createMediaSummaryMap(items.map((item) => item.cover));

    return {
      items: items.map((item) => this.toListItem(item, mediaMap)),
      page,
      limit,
      total,
    };
  }

  async getBookDetail(bookId: string): Promise<unknown> {
    const detail = await this.booksRepository.findOneAndIncrementViewCount({
      _id: bookId,
      ...buildApprovedPublicFilter(),
    });
    if (!detail) {
      throw new NotFoundException('Book not found');
    }

    const chapter = await this.booksRepository.findChapterByBookId(bookId);
    const mediaMap = await this.createMediaSummaryMap([detail.cover]);

    return {
      ...this.toPublicDetail(detail, mediaMap),
      chapterList: chapter?.chapter_list ?? [],
      origin: chapter?.origin,
      comicId: chapter?.comic_id ?? '',
      novelId: chapter?.novel_id ?? '',
      otherId: chapter?.other_id ?? '',
    };
  }

  async getMyBookDetail(bookId: string, userId: string): Promise<unknown> {
    const detail = await this.booksRepository.findBookDetailById(bookId);
    if (!detail) {
      throw new NotFoundException('Book not found');
    }

    if (detail.user_id.toString() !== userId) {
      throw new ForbiddenException('No permission to access this book');
    }

    const chapter = await this.booksRepository.findChapterByBookId(bookId);
    const mediaMap = await this.createMediaSummaryMap([detail.cover]);

    return {
      ...this.toEditableDetail(detail, mediaMap),
      chapterList: chapter?.chapter_list ?? [],
      origin: chapter?.origin,
      comicId: chapter?.comic_id ?? '',
      novelId: chapter?.novel_id ?? '',
      otherId: chapter?.other_id ?? '',
    };
  }

  async updateBook(
    bookId: string,
    dto: UpdateBookDto,
    operatorId: string,
    traceId?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(TargetType.BOOK, bookId, async () => {
      const detail = await this.booksRepository.findBookDetailById(bookId);
      if (!detail) {
        throw new NotFoundException('Book not found');
      }

      if (detail.user_id.toString() !== operatorId) {
        throw new ForbiddenException('No permission to update this book');
      }

      let normalizedCover = detail.cover;
      if (typeof dto.cover === 'string') {
        normalizedCover = extractMediaReferenceId(dto.cover) ?? '';
        if (!normalizedCover) {
          throw new BadRequestException('Book cover is invalid');
        }
        await this.mediaApplicationService.assertMediaIdsExist([normalizedCover], 'image');
      }

      const payload: Record<string, unknown> = {};
      if (dto.author) payload.author = dto.author;
      if (typeof dto.part === 'number') payload.part = dto.part;
      if (dto.style) payload.style = this.booksDomainService.normalizeStyles(dto.style);
      if (typeof dto.status === 'number') payload.status = dto.status;
      if (typeof dto.area === 'number') payload.area = dto.area;
      if (typeof dto.name === 'string') payload.name = dto.name;
      if (typeof dto.cover === 'string') payload.cover = normalizedCover;
      if (typeof dto.desc === 'string') payload.desc = dto.desc;
      if (typeof dto.releaseTime === 'number') payload.release_time = dto.releaseTime;
      payload.search_terms = buildKeywordSearchTerms(
        typeof dto.name === 'string' ? dto.name : detail.name,
        typeof dto.desc === 'string' ? dto.desc : detail.desc,
      );

      const updated = await this.booksRepository.updateBookDetailById(bookId, payload);
      if (!updated) {
        throw new NotFoundException('Book not found');
      }

      if (Array.isArray(dto.chapterList)) {
        const chapterPayload = this.booksDomainService.buildChapterPayload({
          chapterList: dto.chapterList,
        });
        await this.booksRepository.upsertChapter(bookId, chapterPayload);
        await this.booksRepository.updateBookTotal(bookId, this.booksDomainService.getChapterTotal(dto.chapterList));
      }

      this.auditService.recordEventually({
        operatorId,
        action: 'book.update',
        resourceType: 'book',
        resourceId: bookId,
        traceId,
      });

      const latestDetail = Array.isArray(dto.chapterList)
        ? await this.booksRepository.findBookDetailById(bookId)
        : updated;
      if (!latestDetail) {
        throw new NotFoundException('Book not found');
      }

      const chapter = await this.booksRepository.findChapterByBookId(bookId);
      const mediaMap = await this.createMediaSummaryMap([latestDetail.cover]);
      return {
        ...this.toEditableDetail(latestDetail, mediaMap),
        chapterList: chapter?.chapter_list ?? [],
        origin: chapter?.origin,
        comicId: chapter?.comic_id ?? '',
        novelId: chapter?.novel_id ?? '',
        otherId: chapter?.other_id ?? '',
      };
    });
  }

  async deleteBook(
    bookId: string,
    operatorId: string,
    cascadeMedia = false,
    traceId?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(TargetType.BOOK, bookId, async () => {
      const detail = await this.booksRepository.findBookDetailById(bookId);
      if (!detail) {
        throw new NotFoundException('Book not found');
      }

      if (detail.user_id.toString() !== operatorId) {
        throw new ForbiddenException('No permission to delete this book');
      }

      const linkedMediaIds = detail.cover ? [detail.cover] : [];
      const result = await this.mongoTransactionService.runInTransaction(async (session) => {
        await this.booksRepository.deleteBookById(bookId, session);
        return this.workspaceRelationCleanupService.cleanupDeletedTarget(TargetType.BOOK, bookId, session);
      });

      let mediaCleanup: { deletedIds: string[]; skipped: Array<{ id: string; reason: string }> } | undefined;
      if (cascadeMedia) {
        mediaCleanup = await this.mediaApplicationService.deleteOwnedImagesIfUnreferenced(
          linkedMediaIds,
          operatorId,
          traceId,
        );
      }

      this.auditService.recordEventually({
        operatorId,
        action: 'book.delete',
        resourceType: 'book',
        resourceId: bookId,
        traceId,
      });

      return {
        success: true,
        ...result,
        mediaCleanup,
      };
    });
  }

  async upsertBookChapters(
    bookId: string,
    dto: UpsertBookChaptersDto,
    operatorId?: string,
    traceId?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(TargetType.BOOK, bookId, async () => {
      const detail = await this.booksRepository.findBookDetailById(bookId);
      if (!detail) {
        throw new NotFoundException('Book not found');
      }

      if (operatorId && detail.user_id.toString() !== operatorId) {
        throw new ForbiddenException('No permission to update this book');
      }

      const payload = this.booksDomainService.buildChapterPayload(dto);
      const chapter = await this.booksRepository.upsertChapter(bookId, payload);
      const total = this.booksDomainService.getChapterTotal(payload.chapter_list);
      await this.booksRepository.updateBookTotal(bookId, total);

      this.auditService.recordEventually({
        operatorId,
        action: 'book.chapter.upsert',
        resourceType: 'book',
        resourceId: bookId,
        traceId,
        after: {
          total,
        },
      });

      return {
        bookId,
        total,
        chapterList: chapter.chapter_list,
        origin: chapter.origin,
        comicId: chapter.comic_id,
        novelId: chapter.novel_id,
        otherId: chapter.other_id,
      };
    });
  }

  private resolveListSort(sort: QueryBooksDto['sort'] = 'latest'): Record<string, 1 | -1> {
    if (sort === 'hot') {
      return {
        favor_count: -1,
        reply_count: -1,
        view_count: -1,
        total: -1,
        update_time: -1,
      };
    }

    if (sort === 'recommend') {
      return {
        favor_count: -1,
        reply_count: -1,
        view_count: -1,
        update_time: -1,
      };
    }

    return {
      update_time: -1,
    };
  }

  private async createMediaSummaryMap(mediaIds: string[]) {
    return this.mediaApplicationService.getMediaSummaryMap(mediaIds);
  }

  private mapCoverAsset(
    mediaId: string,
    mediaMap: Map<string, MediaSummary>,
    mode: ResolvedMediaAssetMode = 'full',
  ): ResolvedMediaAsset | undefined {
    return mapSingleReferencedMediaAsset(mediaId, mediaMap, mode);
  }

  private buildTags(item: BookDetailDocument): string[] {
    return buildBookCompositeTags(item.part, item.area, item.style);
  }

  private buildHomeTags(item: BookDetailDocument): string[] {
    return buildBookCompositeTags(item.part, item.area, item.style, 3);
  }

  private toHomeItem(
    item: BookDetailDocument,
    mediaMap: Map<string, MediaSummary>,
  ): HomeBookItem {
    return {
      id: item.id,
      title: item.name,
      summary: item.desc,
      coverMedia: this.mapCoverAsset(item.cover, mediaMap, 'compact'),
      tags: this.buildHomeTags(item),
      authorNames: item.author,
      viewCount: item.view_count ?? 0,
      replyCount: item.reply_count ?? 0,
    };
  }

  private toListItem(
    item: BookDetailDocument,
    mediaMap: Map<string, MediaSummary>,
    mediaVariant: MediaVariant = 'download',
  ) {
    const coverMedia = this.mapCoverAsset(item.cover, mediaMap, 'compact');
    const viewCount = item.view_count ?? 0;
    const favorCount = item.favor_count ?? 0;
    const replyCount = item.reply_count ?? 0;

    return {
      id: item.id,
      title: item.name,
      name: item.name,
      summary: item.desc,
      desc: item.desc,
      author: item.author,
      authorNames: item.author,
      part: item.part,
      status: item.status,
      reviewStatus: item.review_status,
      visibility: item.visibility,
      area: item.area,
      total: item.total,
      tags: this.buildTags(item),
      style: item.style,
      cover: pickMediaPath(coverMedia, mediaVariant),
      coverMedia,
      coverMediaId: item.cover,
      viewCount,
      favorCount,
      replyCount,
      releaseTime: item.release_time,
      createTime: item.create_time,
      updateTime: item.update_time,
      userId: item.user_id.toString(),
    };
  }

  private toPublicDetail(
    detail: BookDetailDocument,
    mediaMap: Map<string, MediaSummary>,
    mediaVariant: MediaVariant = 'download',
  ) {
    return {
      ...this.toListItem(detail, mediaMap, mediaVariant),
      coverMedia: this.mapCoverAsset(detail.cover, mediaMap, 'full'),
      cover: pickMediaPath(this.mapCoverAsset(detail.cover, mediaMap, 'full'), mediaVariant),
    };
  }

  private toEditableDetail(
    detail: BookDetailDocument,
    mediaMap: Map<string, MediaSummary>,
    mediaVariant: MediaVariant = 'download',
  ) {
    return {
      ...this.toPublicDetail(detail, mediaMap, mediaVariant),
      style: detail.style,
    };
  }
}







