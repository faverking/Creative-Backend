import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, FilterQuery, Model } from 'mongoose';
import { BookChapter, BookChapterDocument, BookDetail, BookDetailDocument } from '../schemas/book.schema';

@Injectable()
export class BooksRepository {
  constructor(
    @InjectModel(BookDetail.name)
    private readonly bookDetailModel: Model<BookDetailDocument>,
    @InjectModel(BookChapter.name)
    private readonly bookChapterModel: Model<BookChapterDocument>,
  ) {}

  createBookDetail(payload: Partial<BookDetail>): Promise<BookDetailDocument> {
    return this.bookDetailModel.create(payload);
  }

  async listBookDetails(
    filter: FilterQuery<BookDetailDocument>,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1>,
  ): Promise<{ items: BookDetailDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.bookDetailModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.bookDetailModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  findBookDetailById(id: string): Promise<BookDetailDocument | null> {
    return this.bookDetailModel.findById(id).exec();
  }

  findOneAndIncrementViewCount(filter: FilterQuery<BookDetailDocument>): Promise<BookDetailDocument | null> {
    return this.bookDetailModel.findOneAndUpdate(filter, { $inc: { view_count: 1 } }, { new: true }).exec();
  }

  updateBookDetailById(id: string, payload: Partial<BookDetail>): Promise<BookDetailDocument | null> {
    return this.bookDetailModel.findByIdAndUpdate(id, payload, { new: true }).exec();
  }

  async deleteBookById(id: string, session?: ClientSession): Promise<void> {
    await Promise.all([
      this.bookDetailModel.deleteOne({ _id: id }).session(session ?? null).exec(),
      this.bookChapterModel.deleteOne({ book_id: id }).session(session ?? null).exec(),
    ]);
  }

  findByIdAndIncrementViewCount(id: string): Promise<BookDetailDocument | null> {
    return this.bookDetailModel.findByIdAndUpdate(id, { $inc: { view_count: 1 } }, { new: true }).exec();
  }

  findChapterByBookId(bookId: string): Promise<BookChapterDocument | null> {
    return this.bookChapterModel.findOne({ book_id: bookId }).exec();
  }

  async upsertChapter(bookId: string, payload: Partial<BookChapter>): Promise<BookChapterDocument> {
    const result = await this.bookChapterModel
      .findOneAndUpdate(
        { book_id: bookId },
        {
          ...payload,
          book_id: bookId,
        },
        {
          new: true,
          upsert: true,
        },
      )
      .exec();

    return result;
  }

  async updateBookTotal(bookId: string, total: number): Promise<void> {
    await this.bookDetailModel
      .updateOne(
        { _id: bookId },
        {
          total,
          update_time: new Date(),
        },
      )
      .exec();
  }
}


