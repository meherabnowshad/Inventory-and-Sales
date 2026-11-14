import { describe, it, expect, vi } from 'vitest';
import { ArgumentsHost } from '@nestjs/common';
import { TemporarilyLockedFilter } from './temporarily-locked.filter';
import { TemporarilyLockedException } from '../exceptions/temporarily-locked.exception';

describe('TemporarilyLockedFilter (IMS-05.4 / FR-AUTH-05)', () => {
  it('sets Retry-After header and returns 429 TEMPORARILY_LOCKED payload', () => {
    const filter = new TemporarilyLockedFilter();
    const setHeader = vi.fn();
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ setHeader, status }),
      }),
    } as unknown as ArgumentsHost;

    const exception = new TemporarilyLockedException(900);
    filter.catch(exception, mockHost);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '900');
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 429,
        code: 'TEMPORARILY_LOCKED',
        retryAfter: 900,
      }),
    );
  });
});
