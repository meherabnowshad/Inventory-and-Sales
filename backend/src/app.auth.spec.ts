import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AppModule } from './app.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { AuthService } from './auth/auth.service';
import { IS_PUBLIC_KEY } from './auth/decorators/public.decorator';
import { AuthController } from './auth/auth.controller';
import { HealthController } from './health/health.controller';
import { InventoryController } from './inventory/inventory.controller';
import { SalesController } from './sales/sales.controller';

describe('IMS-05.5: Auth middleware on every route (NFR-SEC-01)', () => {
  const reflector = new Reflector();
  const mockAuthService = { validateToken: vi.fn() } as unknown as AuthService;
  const globalGuard = new AuthGuard(mockAuthService, reflector);

  const createContextForHandler = (
    ControllerClass: new (...args: never[]) => unknown,
    handlerName: string,
    authHeader?: string,
  ) => {
    const handler = (ControllerClass.prototype as Record<string, unknown>)[handlerName] as (
      ...args: unknown[]
    ) => unknown;
    return {
      getHandler: () => handler,
      getClass: () => ControllerClass,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: authHeader } }),
      }),
    } as unknown as ExecutionContext;
  };

  it('registers AuthGuard globally as APP_GUARD on AppModule', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as Array<{
      provide?: unknown;
      useClass?: unknown;
    }>;
    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: APP_GUARD,
          useClass: AuthGuard,
        }),
      ]),
    );
  });

  it('rejects unauthenticated calls with HTTP 401 on protected routes (Inventory, Sales, Profile)', async () => {
    const protectedRoutes: Array<[new (...args: never[]) => unknown, string]> = [
      [InventoryController, 'getProducts'],
      [SalesController, 'getSales'],
      [AuthController, 'getProfile'],
    ];

    for (const [ControllerClass, handlerName] of protectedRoutes) {
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        (ControllerClass.prototype as Record<string, unknown>)[handlerName] as () => unknown,
        ControllerClass,
      ]);
      expect(isPublic).toBeFalsy();

      const ctx = createContextForHandler(ControllerClass, handlerName, undefined);
      await expect(globalGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    }
  });

  it('allows @Public() routes (login, refresh, health) without a Bearer token', async () => {
    const publicRoutes: Array<[new (...args: never[]) => unknown, string]> = [
      [AuthController, 'login'],
      [AuthController, 'refresh'],
      [AuthController, 'logout'],
      [HealthController, 'getHealth'],
    ];

    for (const [ControllerClass, handlerName] of publicRoutes) {
      const ctx = createContextForHandler(ControllerClass, handlerName, undefined);
      await expect(globalGuard.canActivate(ctx)).resolves.toBe(true);
    }
  });
});
