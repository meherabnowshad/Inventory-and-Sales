import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../constants/roles';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    prisma = { user: { findUnique: vi.fn() } };
    guard = new RolesGuard(reflector as unknown as Reflector, prisma as never);
  });

  const createContext = () => {
    const request: { user: { id: number; role: string } } = {
      user: { id: 1, role: 'stale-role' },
    };
    const handler = () => {};
    class TestController {}
    return {
      request,
      context: {
        getHandler: () => handler,
        getClass: () => TestController,
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  };

  it('allows a role in the route metadata', async () => {
    const { context, request } = createContext();
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? [UserRole.Administrator] : key === IS_PUBLIC_KEY ? false : undefined,
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 1n,
      isActive: true,
      role: { name: UserRole.Administrator },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user.role).toBe(UserRole.Administrator);
  });

  it('returns the standard 403 for a forbidden role', async () => {
    const { context } = createContext();
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? [UserRole.Administrator] : false,
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 1n,
      isActive: true,
      role: { name: UserRole.SalesStaff },
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: {
        statusCode: 403,
        code: 'FORBIDDEN_ROLE',
        message: 'You do not have permission to perform this action',
      },
    });
  });

  it('allows routes without role metadata and refreshes the role', async () => {
    const { context, request } = createContext();
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? undefined : key === IS_PUBLIC_KEY ? false : undefined,
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 1n,
      isActive: true,
      role: { name: UserRole.StoreStaff },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user.role).toBe(UserRole.StoreStaff);
  });

  it('allows @Public routes without loading or checking the user', async () => {
    const { context } = createContext();
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === IS_PUBLIC_KEY ? true : undefined,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 401 for a deactivated user', async () => {
    const { context } = createContext();
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? [UserRole.Administrator] : false,
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 1n,
      isActive: false,
      role: { name: UserRole.Administrator },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Account is deactivated');
  });

  it('returns 401 for a missing user', async () => {
    const { context } = createContext();
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? [UserRole.Administrator] : false,
    );
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Account is deactivated');
  });
});
