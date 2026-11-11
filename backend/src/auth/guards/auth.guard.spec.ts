import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../auth.service';

describe('AuthGuard (IMS-05.2 / FR-AUTH-02)', () => {
  let authGuard: AuthGuard;
  let mockAuthService: { validateToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAuthService = {
      validateToken: vi.fn(),
    };
    authGuard = new AuthGuard(mockAuthService as unknown as AuthService);
  });

  const createMockContext = (authHeader?: string) => {
    const request: { headers: { authorization?: string }; user?: unknown } = {
      headers: { authorization: authHeader },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  it('allows access and attaches user to request for valid bearer token', async () => {
    const mockUser = {
      id: 1,
      name: 'Sadia Rahman',
      username: 'sadia',
      email: 'sadia@smartmart.local',
      role: 'Administrator',
    };
    mockAuthService.validateToken.mockResolvedValue(mockUser);

    const { context, request } = createMockContext('Bearer valid_token_123');

    const result = await authGuard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthService.validateToken).toHaveBeenCalledWith('valid_token_123');
    expect(request.user).toEqual(mockUser);
  });

  it('blocks access with 401 when token is revoked (Done when: Old token gets 401)', async () => {
    mockAuthService.validateToken.mockRejectedValue(
      new UnauthorizedException('Token has been revoked'),
    );

    const { context } = createMockContext('Bearer old_revoked_token_123');

    await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(authGuard.canActivate(context)).rejects.toThrow('Token has been revoked');
  });

  it('blocks access with 401 when token has expired (FR-AUTH-03)', async () => {
    mockAuthService.validateToken.mockRejectedValue(
      new UnauthorizedException('Token has expired'),
    );

    const { context } = createMockContext('Bearer expired_token_123');

    await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(authGuard.canActivate(context)).rejects.toThrow('Token has expired');
  });

  it('blocks access with 401 when authorization header is missing', async () => {
    const { context } = createMockContext(undefined);

    await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(authGuard.canActivate(context)).rejects.toThrow('Authorization header is missing');
  });

  it('blocks access with 401 when scheme is not Bearer', async () => {
    const { context } = createMockContext('Basic dXNlcjpwYXNz');

    await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(authGuard.canActivate(context)).rejects.toThrow('Invalid authorization scheme');
  });
});
