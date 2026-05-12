import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { type Model, type Types } from 'mongoose';
import { Article } from '../src/articles/schemas/article.schema';
import { AppModule } from '../src/app.module';
import { BookDetail } from '../src/books/schemas/book.schema';
import { buildKeywordSearchTerms } from '../src/common/utils/keyword-search.util';
import { ImagePackage } from '../src/images/schemas/image.schema';
import { Topic } from '../src/topics/schemas/topic.schema';

const BATCH_SIZE = 200;

interface SearchSourceDocument {
  _id: Types.ObjectId;
  title?: string;
  name?: string;
  desc?: string;
}

async function backfillSearchTerms(
  label: string,
  model: Model<SearchSourceDocument>,
  resolvePrimaryText: (document: SearchSourceDocument) => string | undefined,
): Promise<void> {
  let processed = 0;
  let lastId: Types.ObjectId | undefined;

  while (true) {
    const filter = lastId ? { _id: { $gt: lastId } } : {};
    const documents = (await model
      .find(filter)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .select({ _id: 1, title: 1, name: 1, desc: 1 })
      .lean()
      .exec()) as SearchSourceDocument[];

    if (documents.length === 0) {
      break;
    }

    await model.bulkWrite(
      documents.map((document) => ({
        updateOne: {
          filter: { _id: document._id },
          update: {
            $set: {
              search_terms: buildKeywordSearchTerms(resolvePrimaryText(document), document.desc),
            },
          },
        },
      })),
      { ordered: false },
    );

    processed += documents.length;
    lastId = documents[documents.length - 1]._id;
    console.log(`[backfill-search-terms] ${label}: processed ${processed}`);
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const articleModel = app.get<Model<SearchSourceDocument>>(getModelToken(Article.name));
    const bookModel = app.get<Model<SearchSourceDocument>>(getModelToken(BookDetail.name));
    const topicModel = app.get<Model<SearchSourceDocument>>(getModelToken(Topic.name));
    const imageModel = app.get<Model<SearchSourceDocument>>(getModelToken(ImagePackage.name));

    await backfillSearchTerms('articles', articleModel, (document) => document.title);
    await backfillSearchTerms('books', bookModel, (document) => document.name);
    await backfillSearchTerms('topics', topicModel, (document) => document.title);
    await backfillSearchTerms('images', imageModel, (document) => document.title);
  } finally {
    await app.close();
  }
}

void main();
