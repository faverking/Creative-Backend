import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  increment(_name: string): void {
    return;
  }
}
