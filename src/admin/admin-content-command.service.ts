import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type ClientSession, type Model } from 'mongoose';
import { Article, type ArticleDocument } from '../articles/schemas/article.schema';
import { BookChapter, type BookChapterDocument, BookDetail, type BookDetailDocument } from '../books/schemas/book.schema';
import { DEFAULT_FEATURED_SCENE } from '../common/constants/featured-content.constants';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../common/constants/roles';
import { TargetType } from '../common/enums/target-type.enum';
import { Visibility } from '../common/enums/visibility.enum';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { resolveImagePackageCoverMediaId } from '../common/utils/content-presentation.util';
import { normalizeMediaReferenceIds } from '../common/utils/media-reference.util';
import { AuditService } from '../infra/audit/audit.service';
import { MongoTransactionService } from '../infra/database/mongo-transaction.service';
import { ImagePackage, type ImagePackageDocument } from '../images/schemas/image.schema';
import { ContentOperationLockService } from '../infra/redis/content-operation-lock.service';
import { MediaApplicationService } from '../media/application/media.application';
import { Topic, type TopicDocument } from '../topics/schemas/topic.schema';
import { WorkspaceRelationCleanupService } from '../workspace/workspace-relation-cleanup.service';
import { AdminContentQueryService } from './admin-content-query.service';
import { DeleteAdminContentDto } from './dto/admin-content.dto';

@Injectable()
export class AdminContentCommandService {
  constructor(
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(BookDetail.name)
    private readonly bookDetailModel: Model<BookDetailDocument>,
    @InjectModel(BookChapter.name)
    private readonly bookChapterModel: Model<BookChapterDocument>,
    @InjectModel(Topic.name)
    private readonly topicModel: Model<TopicDocument>,
    @InjectModel(ImagePackage.name)
    private readonly imagePackageModel: Model<ImagePackageDocument>,
    private readonly mediaApplicationService: MediaApplicationService,
    private readonly auditService: AuditService,
    private readonly mongoTransactionService: MongoTransactionService,
    private readonly contentOperationLockService: ContentOperationLockService,
    private readonly workspaceRelationCleanupService: WorkspaceRelationCleanupService,
    private readonly adminContentQueryService: AdminContentQueryService,
  ) {}

  async setPrivate(
    type: TargetType,
    id: string,
    user: JwtUser,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(type, id, async () => {
      const scene = this.resolveScene(undefined);
      const operatorRole = this.resolveOperatorRole(user);
      const content = await this.requireContentForPrivate(type, id);
      const changed = content.visibility !== Visibility.PRIVATE;

      const relationCleanup = await this.mongoTransactionService.runInTransaction(async (session) => {
        if (changed) {
          await this.updateVisibilityByType(type, id, Visibility.PRIVATE, session);
        }

        return this.workspaceRelationCleanupService.cleanupHiddenTarget(type, id, user.userId, session);
      });

      if (changed) {
        await this.recordSetPrivateAudit(
          user,
          operatorRole,
          type,
          id,
          content.visibility,
          Visibility.PRIVATE,
          traceId,
          ip,
          ua,
        );
      }

      return {
        success: true,
        changed,
        ...relationCleanup,
        item: await this.adminContentQueryService.detailItemByType(type, id, scene),
      };
    });
  }

  async deletePermanently(
    type: TargetType,
    id: string,
    user: JwtUser,
    query: DeleteAdminContentDto,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<unknown> {
    return this.contentOperationLockService.runWithContentLock(type, id, async () => {
      const operatorRole = this.resolveOperatorRole(user);
      const cascadeMedia = query.cascadeMedia ?? false;
      const content = await this.requireContentForDelete(type, id);
      const ownerId = content.user_id.toString();
      const mediaIds = this.collectContentMediaIds(type, content);

      const result = await this.mongoTransactionService.runInTransaction(async (session) => {
        await this.deleteContentByType(type, content, session);

        return this.workspaceRelationCleanupService.cleanupDeletedTarget(type, id, session);
      });

      const mediaCleanup = cascadeMedia
        ? await this.mediaApplicationService.deleteOwnedImagesIfUnreferenced(mediaIds, ownerId, traceId)
        : undefined;

      await this.recordPhysicalDeleteAudit(
        user,
        operatorRole,
        type,
        id,
        { title: this.resolveContentTitle(content) },
        {
          ...result,
          mediaCleanup,
        },
        traceId,
        ip,
        ua,
      );

      return {
        success: true,
        ...result,
        mediaCleanup,
      };
    });
  }

  private async requireContentForPrivate(
    type: TargetType,
    id: string,
  ): Promise<ArticleDocument | BookDetailDocument | TopicDocument | ImagePackageDocument> {
    const content = await this.requireContentForDelete(type, id);
    if (type === TargetType.ARTICLE && (content as ArticleDocument).deleted_at) {
      throw new BadRequestException('Deleted article cannot change visibility');
    }

    return content;
  }

  private async requireContentForDelete(
    type: TargetType,
    id: string,
  ): Promise<ArticleDocument | BookDetailDocument | TopicDocument | ImagePackageDocument> {
    if (type === TargetType.ARTICLE) {
      const article = await this.articleModel.findById(id).exec();
      if (!article) {
        throw new NotFoundException('Article not found');
      }
      return article;
    }

    if (type === TargetType.BOOK) {
      const book = await this.bookDetailModel.findById(id).exec();
      if (!book) {
        throw new NotFoundException('Book not found');
      }
      return book;
    }

    if (type === TargetType.TOPIC) {
      const topic = await this.topicModel.findById(id).exec();
      if (!topic) {
        throw new NotFoundException('Topic not found');
      }
      return topic;
    }

    const imagePackage = await this.imagePackageModel.findById(id).exec();
    if (!imagePackage) {
      throw new NotFoundException('Image package not found');
    }

    return imagePackage;
  }

  private async updateVisibilityByType(
    type: TargetType,
    id: string,
    visibility: Visibility,
    session?: ClientSession,
  ): Promise<void> {
    if (type === TargetType.ARTICLE) {
      await this.articleModel.updateOne({ _id: id }, { $set: { visibility } }).session(session ?? null).exec();
      return;
    }

    if (type === TargetType.BOOK) {
      await this.bookDetailModel.updateOne({ _id: id }, { $set: { visibility } }).session(session ?? null).exec();
      return;
    }

    if (type === TargetType.TOPIC) {
      await this.topicModel.updateOne({ _id: id }, { $set: { visibility } }).session(session ?? null).exec();
      return;
    }

    await this.imagePackageModel.updateOne({ _id: id }, { $set: { visibility } }).session(session ?? null).exec();
  }

  private async deleteContentByType(
    type: TargetType,
    content: ArticleDocument | BookDetailDocument | TopicDocument | ImagePackageDocument,
    session?: ClientSession,
  ): Promise<void> {
    if (type === TargetType.ARTICLE) {
      await this.articleModel.deleteOne({ _id: content._id }).session(session ?? null).exec();
      return;
    }

    if (type === TargetType.BOOK) {
      const book = content as BookDetailDocument;
      await Promise.all([
        this.bookDetailModel.deleteOne({ _id: book._id }).session(session ?? null).exec(),
        this.bookChapterModel.deleteOne({ book_id: book._id }).session(session ?? null).exec(),
      ]);
      return;
    }

    if (type === TargetType.TOPIC) {
      await this.topicModel.deleteOne({ _id: content._id }).session(session ?? null).exec();
      return;
    }

    await this.imagePackageModel.deleteOne({ _id: content._id }).session(session ?? null).exec();
  }

  private collectContentMediaIds(
    type: TargetType,
    content: ArticleDocument | BookDetailDocument | TopicDocument | ImagePackageDocument,
  ): string[] {
    if (type === TargetType.ARTICLE) {
      return normalizeMediaReferenceIds((content as ArticleDocument).images);
    }

    if (type === TargetType.BOOK) {
      const cover = (content as BookDetailDocument).cover;
      return cover ? [cover] : [];
    }

    if (type === TargetType.TOPIC) {
      return normalizeMediaReferenceIds((content as TopicDocument).images);
    }

    const imagePackage = content as ImagePackageDocument;
    return Array.from(
      new Set([
        ...normalizeMediaReferenceIds(imagePackage.images),
        ...this.collectImagePackageCoverIds(imagePackage),
      ]),
    );
  }

  private resolveContentTitle(
    content: ArticleDocument | BookDetailDocument | TopicDocument | ImagePackageDocument,
  ): string {
    if ('title' in content) {
      return content.title;
    }

    return content.name;
  }

  private resolveScene(scene?: string): string {
    const normalized = scene?.trim();
    return normalized && normalized.length > 0 ? normalized : DEFAULT_FEATURED_SCENE;
  }

  private resolveOperatorRole(user: JwtUser): string {
    return user.roles.includes(ROLE_SUPER_ADMIN) ? ROLE_SUPER_ADMIN : ROLE_ADMIN;
  }

  private collectImagePackageCoverIds(imagePackage: ImagePackageDocument): string[] {
    const coverMediaId = resolveImagePackageCoverMediaId(imagePackage);
    return coverMediaId ? [coverMediaId] : [];
  }

  private async recordSetPrivateAudit(
    user: JwtUser,
    operatorRole: string,
    type: TargetType,
    resourceId: string,
    beforeVisibility: Visibility,
    afterVisibility: Visibility,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<void> {
    await this.auditService.recordCritical({
      operatorId: user.userId,
      operatorRole,
      action: 'admin.content.set_private',
      resourceType: type,
      resourceId,
      before: {
        visibility: beforeVisibility,
      },
      after: {
        visibility: afterVisibility,
      },
      ip,
      ua,
      traceId,
    });
  }

  private async recordPhysicalDeleteAudit(
    user: JwtUser,
    operatorRole: string,
    type: TargetType,
    resourceId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<void> {
    await this.auditService.recordCritical({
      operatorId: user.userId,
      operatorRole,
      action: 'admin.content.delete_permanently',
      resourceType: type,
      resourceId,
      before,
      after,
      ip,
      ua,
      traceId,
    });
  }
}
