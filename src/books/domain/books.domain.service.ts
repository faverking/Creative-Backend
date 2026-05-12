import { BadRequestException, Injectable } from '@nestjs/common';
import { BOOK_STYLE_LABELS } from '../../common/constants/content-taxonomy.constants';
import type { CreateBookDto, UpsertBookChaptersDto } from '../dto/book.dto';

@Injectable()
export class BooksDomainService {
  normalizeStyles(
    styles?: Array<{ id: number; name: string }>,
  ): Array<{ id: number; name: string }> {
    const normalized: Array<{ id: number; name: string }> = [];
    const seenStyleIds = new Set<number>();

    for (const style of styles ?? []) {
      const label = BOOK_STYLE_LABELS[style.id];
      if (!label) {
        throw new BadRequestException(`Unsupported book style id: ${style.id}`);
      }

      if (seenStyleIds.has(style.id)) {
        continue;
      }

      seenStyleIds.add(style.id);
      normalized.push({
        id: style.id,
        name: label,
      });
    }

    return normalized;
  }

  buildDetailPayload(dto: CreateBookDto): {
    author: string[];
    part: 1 | 2 | 3;
    style: Array<{ id: number; name: string }>;
    status: 1 | 2;
    area: 1 | 2 | 3;
    name: string;
    cover: string;
    desc: string;
    release_time?: number;
  } {
    return {
      author: dto.author ?? [],
      part: dto.part ?? 1,
      style: this.normalizeStyles(dto.style),
      status: dto.status ?? 1,
      area: dto.area ?? 2,
      name: dto.name,
      cover: dto.cover,
      desc: dto.desc,
      release_time: dto.releaseTime,
    };
  }

  buildChapterPayload(dto: {
    chapterList: UpsertBookChaptersDto['chapterList'];
    origin?: string;
    comicId?: string;
    novelId?: string;
    otherId?: string;
  }): {
    chapter_list: UpsertBookChaptersDto['chapterList'];
    origin?: string;
    comic_id: string;
    novel_id: string;
    other_id: string;
  } {
    return {
      chapter_list: dto.chapterList,
      origin: dto.origin,
      comic_id: dto.comicId ?? '',
      novel_id: dto.novelId ?? '',
      other_id: dto.otherId ?? '',
    };
  }

  getChapterTotal(chapterList: UpsertBookChaptersDto['chapterList']): number {
    return chapterList.length;
  }
}
