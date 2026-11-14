import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * HTTP 429 Too Many Requests exception for FR-AUTH-05 (failed-login throttling).
 * Follows RFC 9457 Problem Details and Engineering Spec v0.3 error code `TEMPORARILY_LOCKED`.
 */
export class TemporarilyLockedException extends HttpException {
  readonly retryAfter: number;

  constructor(retryAfterSeconds: number) {
    const safeRetryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
    const minutes = Math.ceil(safeRetryAfter / 60);

    super(
      {
        type: 'https://smartmart.local/errors/temporarily-locked',
        title: 'Too many failed login attempts',
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: 'TEMPORARILY_LOCKED',
        detail: `Account temporarily locked due to too many failed login attempts. Try again in ${minutes} minute(s).`,
        retryAfter: safeRetryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );

    this.retryAfter = safeRetryAfter;
  }
}
