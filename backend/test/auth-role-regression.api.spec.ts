import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Algorithm, hash } from '@node-rs/argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { UserRole } from '../src/auth/constants/roles';

interface LoginSession {
  accessToken: string;
  refreshCookie: string;
  refreshToken: string;
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
    role: string;
    mustResetPassword: boolean;
  };
}

describe('Auth & Role-Based API Regression (IMS-53 | FR-USR-04, NFR-SEC-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  const RUN = Date.now();
  const PREFIX = `qa_ims53_${RUN}_`;
  const PASSWORD = 'Smart@1234';

  const roleUsers: Record<UserRole, { id: number; username: string }> = {
    [UserRole.Administrator]: { id: 0, username: 'sadia' },
    [UserRole.SalesStaff]: { id: 0, username: `${PREFIX}sales` },
    [UserRole.StoreStaff]: { id: 0, username: `${PREFIX}store` },
  };
  let deactUser: { id: number; username: string };
  let roleSessions: Record<UserRole, LoginSession>;
  let existingCategoryId: number;
  const createdCategoryIds: number[] = [];

  const http = () => request(app.getHttpServer());

  const extractRefreshCookie = (res: {
    headers: Record<string, string | string[] | undefined>;
  }) => {
    const cookies = res.headers['set-cookie'];
    const raw = (Array.isArray(cookies) ? cookies : [cookies]).find((c) =>
      c?.startsWith('refreshToken='),
    );
    if (!raw) throw new Error('Expected Set-Cookie header with refreshToken');
    const pair = raw.split(';', 1)[0];
    return {
      cookiePair: pair,
      token: decodeURIComponent(pair.slice('refreshToken='.length)),
    };
  };

  const loginAs = async (username: string): Promise<LoginSession> => {
    const res = await http()
      .post('/api/auth/login')
      .send({ usernameOrEmail: username, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('refreshToken');
    const { cookiePair, token } = extractRefreshCookie(res);
    return {
      accessToken: res.body.accessToken,
      refreshCookie: cookiePair,
      refreshToken: token,
      user: res.body.user,
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);

    const passwordHash = await hash(PASSWORD, { algorithm: Algorithm.Argon2id });
    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map((r) => [r.name, r.id]));

    const sadia = await prisma.user.findFirstOrThrow({
      where: { username: 'sadia' },
      select: { id: true },
    });
    roleUsers[UserRole.Administrator].id = Number(sadia.id);

    for (const role of [UserRole.SalesStaff, UserRole.StoreStaff]) {
      const roleId = roleMap.get(role);
      if (!roleId) throw new Error(`Seeded role "${role}" not found`);
      const created = await prisma.user.create({
        data: {
          name: `IMS53 ${role}`,
          username: roleUsers[role].username,
          email: `${roleUsers[role].username}@example.local`,
          passwordHash,
          roleId,
          isActive: true,
        },
      });
      roleUsers[role].id = Number(created.id);
    }

    const adminRoleId = roleMap.get(UserRole.Administrator)!;
    const createdDeact = await prisma.user.create({
      data: {
        name: 'IMS53 Deactivated User',
        username: `${PREFIX}deact`,
        email: `${PREFIX}deact@example.local`,
        passwordHash,
        roleId: adminRoleId,
        isActive: true,
      },
    });
    deactUser = { id: Number(createdDeact.id), username: createdDeact.username };

    roleSessions = {
      [UserRole.Administrator]: await loginAs(roleUsers[UserRole.Administrator].username),
      [UserRole.SalesStaff]: await loginAs(roleUsers[UserRole.SalesStaff].username),
      [UserRole.StoreStaff]: await loginAs(roleUsers[UserRole.StoreStaff].username),
    };

    const existingCategory = await prisma.category.findFirst({ select: { id: true } });
    if (existingCategory) {
      existingCategoryId = existingCategory.id;
    } else {
      const created = await prisma.category.create({
        data: { name: `IMS53 Seed Category ${RUN}` },
      });
      existingCategoryId = created.id;
      createdCategoryIds.push(created.id);
    }
  });

  afterAll(async () => {
    if (prisma) {
      if (createdCategoryIds.length > 0) {
        await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
      }
      const testUsers = await prisma.user.findMany({
        where: { username: { startsWith: PREFIX } },
        select: { id: true },
      });
      const ids = testUsers.map((u) => u.id);
      if (ids.length > 0) {
        await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
        for (const id of ids) {
          await prisma.user.delete({ where: { id } }).catch(() => {});
        }
      }
    }
    if (app) {
      await app.close();
    }
  });

  describe('1. Authentication Lifecycle (Login, Refresh, Logout)', () => {
    it('completes a full login -> refresh -> logout lifecycle with HttpOnly cookie rotation', async () => {
      const session = await loginAs(roleUsers[UserRole.SalesStaff].username);
      expect(session.accessToken.split('.')).toHaveLength(3);
      expect(session.user.role).toBe(UserRole.SalesStaff);

      // Access protected endpoint with initial access token
      const meBefore = await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.accessToken}`);
      expect(meBefore.status).toBe(200);
      expect(meBefore.body.username).toBe(roleUsers[UserRole.SalesStaff].username);

      // Refresh using HttpOnly cookie
      const refreshRes = await http()
        .post('/api/auth/refresh')
        .set('Cookie', session.refreshCookie);
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body).not.toHaveProperty('refreshToken');
      const rotated = extractRefreshCookie(refreshRes);
      expect(rotated.token).not.toBe(session.refreshToken);

      // Replaying old refresh token is rejected
      const replayRes = await http().post('/api/auth/refresh').set('Cookie', session.refreshCookie);
      expect(replayRes.status).toBe(401);
      expect(replayRes.body.message).toBe('Refresh token has already been revoked');

      // Logout revokes the rotated session
      const logoutRes = await http().post('/api/auth/logout').set('Cookie', rotated.cookiePair);
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe('Logged out successfully');

      // Both new access token and rotated refresh token are rejected after logout
      const meAfter = await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refreshRes.body.accessToken}`);
      expect(meAfter.status).toBe(401);
      expect(meAfter.body.message).toBe('Token has been revoked');

      const refreshAfterLogout = await http()
        .post('/api/auth/refresh')
        .set('Cookie', rotated.cookiePair);
      expect(refreshAfterLogout.status).toBe(401);
      expect(refreshAfterLogout.body.message).toBe('Refresh token has already been revoked');
    });
  });

  describe('2. Role-Based Access Control across Every Protected Endpoint Group', () => {
    it.each([
      // Public & Shared Authenticated Read Routes
      [UserRole.Administrator, 'get', '/api/health', 200],
      [UserRole.SalesStaff, 'get', '/api/health', 200],
      [UserRole.StoreStaff, 'get', '/api/health', 200],

      [UserRole.Administrator, 'get', '/api/auth/me', 200],
      [UserRole.SalesStaff, 'get', '/api/auth/me', 200],
      [UserRole.StoreStaff, 'get', '/api/auth/me', 200],

      [UserRole.Administrator, 'get', '/api/inventory', 200],
      [UserRole.SalesStaff, 'get', '/api/inventory', 200],
      [UserRole.StoreStaff, 'get', '/api/inventory', 200],

      [UserRole.Administrator, 'get', '/api/categories', 200],
      [UserRole.SalesStaff, 'get', '/api/categories', 200],
      [UserRole.StoreStaff, 'get', '/api/categories', 200],

      // Sales Endpoint Group (Admin + Sales Staff only)
      [UserRole.Administrator, 'get', '/api/sales', 200],
      [UserRole.SalesStaff, 'get', '/api/sales', 200],
      [UserRole.StoreStaff, 'get', '/api/sales', 403],

      // Users Endpoint Group (Admin only)
      [UserRole.Administrator, 'get', '/api/users', 200],
      [UserRole.SalesStaff, 'get', '/api/users', 403],
      [UserRole.StoreStaff, 'get', '/api/users', 403],
    ] as const)('%s %s %s -> %i', async (role, method, path, expectedStatus) => {
      const res = await http()
        [method](path)
        .set('Authorization', `Bearer ${roleSessions[role].accessToken}`);
      expect(res.status).toBe(expectedStatus);
      if (expectedStatus === 403) {
        expect(res.body.code).toBe('FORBIDDEN_ROLE');
      }
    });

    it('enforces Admin-only permissions on /api/users/:id, /audit, POST, and PATCH', async () => {
      const adminToken = roleSessions[UserRole.Administrator].accessToken;
      const targetId = roleUsers[UserRole.StoreStaff].id;

      // Admin succeeds on read & audit
      const getOne = await http()
        .get(`/api/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getOne.status).toBe(200);

      const getAudit = await http()
        .get(`/api/users/${targetId}/audit`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getAudit.status).toBe(200);

      // Non-admins get 403 FORBIDDEN_ROLE on all /api/users mutations and reads
      for (const role of [UserRole.SalesStaff, UserRole.StoreStaff]) {
        const token = roleSessions[role].accessToken;
        const calls = [
          http().get(`/api/users/${targetId}`).set('Authorization', `Bearer ${token}`),
          http().get(`/api/users/${targetId}/audit`).set('Authorization', `Bearer ${token}`),
          http().post('/api/users').set('Authorization', `Bearer ${token}`).send({}),
          http().patch(`/api/users/${targetId}`).set('Authorization', `Bearer ${token}`).send({}),
        ];
        for (const call of calls) {
          const res = await call;
          expect(res.status).toBe(403);
          expect(res.body.code).toBe('FORBIDDEN_ROLE');
        }
      }
    });

    it('enforces Admin & Store Staff permissions on /api/categories write operations', async () => {
      // Sales Staff cannot POST, PATCH, or DELETE categories
      const salesToken = roleSessions[UserRole.SalesStaff].accessToken;
      const salesCalls = [
        http()
          .post('/api/categories')
          .set('Authorization', `Bearer ${salesToken}`)
          .send({ name: `Forbidden_${RUN}` }),
        http()
          .patch(`/api/categories/${existingCategoryId}`)
          .set('Authorization', `Bearer ${salesToken}`)
          .send({ name: `ForbiddenPatch_${RUN}` }),
        http()
          .delete(`/api/categories/${existingCategoryId}`)
          .set('Authorization', `Bearer ${salesToken}`),
      ];
      for (const call of salesCalls) {
        const res = await call;
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN_ROLE');
      }

      // Admin and Store Staff can POST, PATCH, DELETE a category
      for (const role of [UserRole.Administrator, UserRole.StoreStaff]) {
        const token = roleSessions[role].accessToken;
        const createRes = await http()
          .post('/api/categories')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `IMS53_${role}_${RUN}` });
        expect(createRes.status).toBe(201);
        const catId = createRes.body.id;

        const patchRes = await http()
          .patch(`/api/categories/${catId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ description: 'Regression updated' });
        expect(patchRes.status).toBe(200);

        const delRes = await http()
          .delete(`/api/categories/${catId}`)
          .set('Authorization', `Bearer ${token}`);
        expect(delRes.status).toBe(204);
      }
    });
  });

  describe('3. Negative Regression Cases across All Protected Endpoint Groups', () => {
    const protectedEndpoints: Array<{
      method: 'get' | 'post' | 'patch' | 'delete';
      path: () => string;
      body?: Record<string, unknown>;
    }> = [
      { method: 'get', path: () => '/api/auth/me' },
      { method: 'get', path: () => '/api/inventory' },
      { method: 'get', path: () => '/api/categories' },
      { method: 'get', path: () => `/api/categories/${existingCategoryId}` },
      { method: 'post', path: () => '/api/categories', body: { name: 'ShouldFail' } },
      {
        method: 'patch',
        path: () => `/api/categories/${existingCategoryId}`,
        body: { name: 'ShouldFail' },
      },
      { method: 'delete', path: () => `/api/categories/${existingCategoryId}` },
      { method: 'get', path: () => '/api/sales' },
      { method: 'get', path: () => '/api/users' },
      { method: 'get', path: () => `/api/users/${roleUsers[UserRole.Administrator].id}` },
      { method: 'get', path: () => `/api/users/${roleUsers[UserRole.Administrator].id}/audit` },
      { method: 'post', path: () => '/api/users', body: {} },
      {
        method: 'patch',
        path: () => `/api/users/${roleUsers[UserRole.Administrator].id}`,
        body: {},
      },
    ];

    it('rejects requests without a Bearer token with 401 on every protected endpoint group', async () => {
      for (const endpoint of protectedEndpoints) {
        const req = http()[endpoint.method](endpoint.path());
        const res = endpoint.body ? await req.send(endpoint.body) : await req;
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Authorization header is missing');
      }
    });

    it('rejects expired access tokens with 401 "Token has expired" on every protected endpoint group', async () => {
      const adminSession = roleSessions[UserRole.Administrator];
      const expiredToken = authService.signAccessToken(adminSession.user, -60);

      for (const endpoint of protectedEndpoints) {
        const req = http()
          [endpoint.method](endpoint.path())
          .set('Authorization', `Bearer ${expiredToken}`);
        const res = endpoint.body ? await req.send(endpoint.body) : await req;
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Token has expired');
      }
    });

    it('rejects deactivated user across login, refresh, and all protected endpoint groups', async () => {
      const deactSession = await loginAs(deactUser.username);
      const adminToken = roleSessions[UserRole.Administrator].accessToken;

      // Deactivate user via Admin API
      const deactivateRes = await http()
        .patch(`/api/users/${deactUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.isActive).toBe(false);

      // 1. Login rejected
      const loginAttempt = await http()
        .post('/api/auth/login')
        .send({ usernameOrEmail: deactUser.username, password: PASSWORD });
      expect(loginAttempt.status).toBe(401);
      expect(loginAttempt.body.message).toBe('Invalid username or password');

      // 2. Refresh rejected
      const refreshAttempt = await http()
        .post('/api/auth/refresh')
        .set('Cookie', deactSession.refreshCookie);
      expect(refreshAttempt.status).toBe(401);
      expect(refreshAttempt.body.message).toBe('Invalid or expired refresh token');

      // 3. Existing access token rejected across every protected endpoint group
      for (const endpoint of protectedEndpoints) {
        const req = http()
          [endpoint.method](endpoint.path())
          .set('Authorization', `Bearer ${deactSession.accessToken}`);
        const res = endpoint.body ? await req.send(endpoint.body) : await req;
        expect(res.status).toBe(401);
      }
    });
  });
});
