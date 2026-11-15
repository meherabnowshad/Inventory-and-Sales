import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('AuthGuard (IMS-05.2, IMS-05.5 | FR-AUTH-02, NFR-SEC-01)', () => {
  let authGuard: AuthGuard;
  let mockAuthService: { validateToken: ReturnType<typeof vi.fn> };
  let mockReflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockAuthService = {
      validateToken: vi.fn(),
    };
    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };
    authGuard = new AuthGuard(
      mockAuthService as unknown as AuthService,
      mockReflector as unknown as Reflector,
    );
  });

  const createMockContext = (authHeader?: string) => {
    const request: { headers: { authorization?: string }; user?: unknown } = {
      headers: { authorization: authHeader },
    };
    const handler = () => {};
    class TestController {}
    const context = {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request, handler, TestController };
  };

  it('allows access without token when route is marked @Public()', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const { context, handler, TestController } = createMockContext(undefined);

    const result = await authGuard.canActivate(context);

    expect(result).toBe(true);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handler,
      TestController,
    ]);
    expect(mockAuthService.validateToken).not.toHaveBeenCalled();
  });

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
    mockAuthService.validateToken.mockRejectedValue(new UnauthorizedException('Token has expired'));

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
