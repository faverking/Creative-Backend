import { Injectable } from '@nestjs/common';
import { TargetType } from '../common/enums/target-type.enum';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { AdminContentCommandService } from './admin-content-command.service';
import { AdminContentQueryService } from './admin-content-query.service';
import {
  DeleteAdminContentDto,
  QueryAdminContentDetailDto,
  QueryAdminContentsDto,
  QueryAdminContentSummaryDto,
} from './dto/admin-content.dto';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly adminContentQueryService: AdminContentQueryService,
    private readonly adminContentCommandService: AdminContentCommandService,
  ) {}

  summary(user: JwtUser, query: QueryAdminContentSummaryDto): Promise<unknown> {
    return this.adminContentQueryService.summary(user, query);
  }

  list(user: JwtUser, query: QueryAdminContentsDto): Promise<unknown> {
    return this.adminContentQueryService.list(user, query);
  }

  detail(
    type: TargetType,
    id: string,
    user: JwtUser,
    query: QueryAdminContentDetailDto,
  ): Promise<unknown> {
    return this.adminContentQueryService.detail(type, id, user, query);
  }

  setPrivate(
    type: TargetType,
    id: string,
    user: JwtUser,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<unknown> {
    return this.adminContentCommandService.setPrivate(type, id, user, traceId, ip, ua);
  }

  deletePermanently(
    type: TargetType,
    id: string,
    user: JwtUser,
    query: DeleteAdminContentDto,
    traceId?: string,
    ip?: string,
    ua?: string,
  ): Promise<unknown> {
    return this.adminContentCommandService.deletePermanently(type, id, user, query, traceId, ip, ua);
  }
}
