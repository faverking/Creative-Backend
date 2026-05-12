import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../dto/api-response.dto';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | StreamableFile> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | StreamableFile> {
    const request = context.switchToHttp().getRequest<{ traceId?: string }>();

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }

        if (this.isApiResponse(data)) {
          return data;
        }

        return {
          code: 0,
          message: 'OK',
          data,
          traceId: request.traceId ?? '',
        };
      }),
    );
  }

  private isApiResponse(value: unknown): value is ApiResponse<T> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<ApiResponse<T>>;
    return (
      typeof candidate.code === 'number' &&
      typeof candidate.message === 'string' &&
      Object.prototype.hasOwnProperty.call(candidate, 'data') &&
      typeof candidate.traceId === 'string'
    );
  }
}
