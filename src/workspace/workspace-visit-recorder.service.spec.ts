import { TargetType } from '../common/enums/target-type.enum';
import { WorkspaceVisitRecorderService } from './workspace-visit-recorder.service';

describe('WorkspaceVisitRecorderService', () => {
  it('records public detail visits through history async writer', () => {
    const historyService = {
      recordVisitAsync: jest.fn(),
    };
    const service = new WorkspaceVisitRecorderService(historyService as never);

    service.recordPublicDetailVisit('507f1f77bcf86cd799439012', TargetType.BOOK, '507f1f77bcf86cd799439011');

    expect(historyService.recordVisitAsync).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      TargetType.BOOK,
      '507f1f77bcf86cd799439011',
      'book-detail',
    );
  });

  it('ignores anonymous public detail visits', () => {
    const historyService = {
      recordVisitAsync: jest.fn(),
    };
    const service = new WorkspaceVisitRecorderService(historyService as never);

    service.recordPublicDetailVisit(undefined, TargetType.ARTICLE, '507f1f77bcf86cd799439011');

    expect(historyService.recordVisitAsync).not.toHaveBeenCalled();
  });
});
