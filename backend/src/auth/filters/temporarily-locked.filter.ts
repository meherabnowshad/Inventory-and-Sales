import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { TemporarilyLockedException } from '../exceptions/temporarily-locked.exception';

/**
 * Ensures HTTP 429 TEMPORARILY_LOCKED responses include the `Retry-After` header (FR-AUTH-05).
 */
@Catch(TemporarilyLockedException)
export class TemporarilyLockedFilter implements ExceptionFilter {
  catch(exception: TemporarilyLockedException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.setHeader('Retry-After', String(exception.retryAfter));
    response.status(status).json(exception.getResponse());
  }
}
