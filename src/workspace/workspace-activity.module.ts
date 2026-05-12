import { Module } from '@nestjs/common';
import { HistoryModule } from '../history/history.module';
import { WorkspaceVisitRecorderService } from './workspace-visit-recorder.service';

@Module({
  imports: [HistoryModule],
  providers: [WorkspaceVisitRecorderService],
  exports: [WorkspaceVisitRecorderService],
})
export class WorkspaceActivityModule {}
