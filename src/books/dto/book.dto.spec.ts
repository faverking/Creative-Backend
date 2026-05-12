import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateBookDto, UpdateBookDto } from './book.dto';

describe('Book DTO style validation', () => {
  it('rejects create payloads with style ids outside the finalized dictionary', () => {
    const dto = plainToInstance(CreateBookDto, {
      name: 'Test book',
      cover: 'media:test-cover',
      desc: 'valid description',
      style: [{ id: 999, name: 'custom-style' }],
    });

    const errors = validateSync(dto);

    expect(JSON.stringify(errors)).toContain('must be one of the following values');
  });

  it('rejects update payloads with style ids outside the finalized dictionary', () => {
    const dto = plainToInstance(UpdateBookDto, {
      style: [{ id: 999, name: 'custom-style' }],
    });

    const errors = validateSync(dto);

    expect(JSON.stringify(errors)).toContain('must be one of the following values');
  });
});
