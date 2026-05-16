import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number = ERROR_CODES.INTERNAL_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const rawMessage = (exceptionResponse as { message: string | string[] }).message;
        message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
      }

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'code' in exceptionResponse
      ) {
        code = (exceptionResponse as { code: number }).code;
      } else {
        code = this.mapStatusToCode(status);
      }
    } else if (this.isMongoDuplicateKeyError(exception)) {
      status = HttpStatus.CONFLICT;
      code = ERROR_CODES.CONFLICT;
      message = this.buildDuplicateKeyMessage(exception);
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR || this.isMongoDuplicateKeyError(exception)) {
      this.logger.error(
        `${request.method} ${request.url} failed with traceId=${request.traceId ?? ''}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    }

    if (this.isClientConnectionClosed(response)) {
      this.logger.warn(
        `${request.method} ${request.url} failed after client connection closed with traceId=${request.traceId ?? ''}`,
      );
      return;
    }

    response.status(status).json({
      code,
      message,
      data: null,
      traceId: request.traceId ?? '',
    });
  }

  private isClientConnectionClosed(response: Response): boolean {
    return response.headersSent || response.writableEnded || response.destroyed;
  }

  private mapStatusToCode(status: number): number {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return ERROR_CODES.PAYLOAD_TOO_LARGE;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.TOO_MANY_REQUESTS;
      default:
        return ERROR_CODES.INTERNAL_ERROR;
    }
  }

  private isMongoDuplicateKeyError(
    exception: unknown,
  ): exception is { code: number; keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      (exception as { code?: unknown }).code === 11000
    );
  }

  private buildDuplicateKeyMessage(exception: {
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
  }): string {
    const duplicateFields = Object.keys(exception.keyPattern ?? exception.keyValue ?? {});
    if (duplicateFields.length === 0) {
      return 'Duplicate data already exists';
    }

    return `${duplicateFields.join(', ')} already exists`;
  }
}
