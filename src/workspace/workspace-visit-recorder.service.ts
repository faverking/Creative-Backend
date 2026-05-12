import { Injectable } from '@nestjs/common';
import { TargetType } from '../common/enums/target-type.enum';
import { HistoryService } from '../history/history.service';

const DETAIL_VISIT_SOURCE_LABELS: Record<TargetType, string> = {
  [TargetType.ARTICLE]: 'article-detail',
  [TargetType.BOOK]: 'book-detail',
  [TargetType.TOPIC]: 'topic-detail',
  [TargetType.IMAGE]: 'image-detail',
};

@Injectable()
export class WorkspaceVisitRecorderService {
  constructor(private readonly historyService: HistoryService) {}

  recordPublicDetailVisit(userId: string | undefined, targetType: TargetType, targetId: string): void {
    if (!userId) {
      return;
    }

    this.historyService.recordVisitAsync(userId, targetType, targetId, DETAIL_VISIT_SOURCE_LABELS[targetType]);
  }
}
