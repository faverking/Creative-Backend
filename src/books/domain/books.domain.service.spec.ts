import { BadRequestException } from '@nestjs/common';
import { BOOK_STYLE_LABELS } from '../../common/constants/content-taxonomy.constants';
import { BooksDomainService } from './books.domain.service';

describe('BooksDomainService', () => {
  const service = new BooksDomainService();

  it('normalizes book styles to finalized dictionary labels', () => {
    expect(
      service.normalizeStyles([
        { id: 101, name: 'old-campus' },
        { id: 105, name: 'old-romance' },
        { id: 110, name: 'old-comedy' },
        { id: 116, name: 'old-classic' },
        { id: 101, name: 'duplicate-campus' },
      ]),
    ).toEqual([
      { id: 101, name: BOOK_STYLE_LABELS[101] },
      { id: 105, name: BOOK_STYLE_LABELS[105] },
      { id: 110, name: '搞笑' },
      { id: 116, name: BOOK_STYLE_LABELS[116] },
    ]);
  });

  it('rejects book styles outside the finalized dictionary', () => {
    expect(() => service.normalizeStyles([{ id: 999, name: 'custom-style' }])).toThrow(BadRequestException);
  });
});
