import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuditService } from '../../infra/audit/audit.service';
import { CreateDraftDto, QueryMyDraftsDto, UpdateDraftDto } from '../dto/draft.dto';
import { DraftsRepository } from '../repositories/drafts.repository';

@Injectable()
export class DraftsApplicationService {
  constructor(
    private readonly draftsRepository: DraftsRepository,
    private readonly auditService: AuditService,
  ) {}

  async createDraft(userId: string, dto: CreateDraftDto, traceId?: string): Promise<unknown> {
    const userObjectId = new Types.ObjectId(userId);
    const created = await this.draftsRepository.create({
      user_id: userObjectId,
      theme_id: dto.themeId,
      title: dto.title,
      content: dto.content,
      version: 1,
    });

    this.auditService.recordEventually({
      operatorId: userId,
      action: 'draft.create',
      resourceType: 'draft',
      resourceId: created.id,
      traceId,
    });

    return {
      id: created.id,
      themeId: created.theme_id,
      title: created.title,
      version: created.version,
      createTime: created.create_time,
      updateTime: created.update_time,
    };
  }

  async listMyDrafts(userId: string, query: QueryMyDraftsDto): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { items, total } = await this.draftsRepository.listByUser(userId, page, limit);

    return {
      items: items.map((item) => ({
        id: item.id,
        themeId: item.theme_id,
        title: item.title,
        version: item.version,
        createTime: item.create_time,
        updateTime: item.update_time,
      })),
      page,
      limit,
      total,
    };
  }

  async getDraftDetail(draftId: string, userId: string): Promise<unknown> {
    const draft = await this.draftsRepository.findById(draftId);
    if (!draft) {
      throw new NotFoundException('Draft not found');
    }

    if (draft.user_id.toString() !== userId) {
      throw new ForbiddenException('No permission to access this draft');
    }

    return {
      id: draft.id,
      themeId: draft.theme_id,
      title: draft.title,
      content: draft.content,
      version: draft.version,
      createTime: draft.create_time,
      updateTime: draft.update_time,
    };
  }

  async updateDraft(
    draftId: string,
    userId: string,
    dto: UpdateDraftDto,
    traceId?: string,
  ): Promise<unknown> {
    const draft = await this.draftsRepository.findById(draftId);
    if (!draft) {
      throw new NotFoundException('Draft not found');
    }

    if (draft.user_id.toString() !== userId) {
      throw new ForbiddenException('No permission to update this draft');
    }

    const payload: Record<string, unknown> = {};
    if (typeof dto.themeId === 'number') {
      payload.theme_id = dto.themeId;
    }
    if (typeof dto.title === 'string') {
      payload.title = dto.title;
    }
    if (typeof dto.content === 'string') {
      payload.content = dto.content;
    }

    const updated = await this.draftsRepository.updateById(draftId, payload);
    if (!updated) {
      throw new NotFoundException('Draft not found');
    }

    this.auditService.recordEventually({
      operatorId: userId,
      action: 'draft.update',
      resourceType: 'draft',
      resourceId: draftId,
      traceId,
    });

    return {
      id: updated.id,
      themeId: updated.theme_id,
      title: updated.title,
      content: updated.content,
      version: updated.version,
      createTime: updated.create_time,
      updateTime: updated.update_time,
    };
  }

  async deleteDraft(draftId: string, userId: string, traceId?: string): Promise<{ success: true }> {
    const draft = await this.draftsRepository.findById(draftId);
    if (!draft) {
      throw new NotFoundException('Draft not found');
    }

    if (draft.user_id.toString() !== userId) {
      throw new ForbiddenException('No permission to delete this draft');
    }

    await this.draftsRepository.deleteById(draftId);

    this.auditService.recordEventually({
      operatorId: userId,
      action: 'draft.delete',
      resourceType: 'draft',
      resourceId: draftId,
      traceId,
    });

    return { success: true };
  }
}
