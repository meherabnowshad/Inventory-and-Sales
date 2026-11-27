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
  let dedicatedCategoryId: number;
  let dedicatedProductId: number;
  const createdCategoryIds: number[] = [];
  const createdProductIds: number[] = [];
  const createdUserIds: bigint[] = [];

  const http = () => request(app.getHttpServer());

  const trackUnexpectedCreate = (path: string, res: { status: number; body?: { id?: number } }) => {
    if (res.status !== 201 || res.body?.id === undefined) return;
    if (path === '/api/categories') createdCategoryIds.push(res.body.id);
    if (path === '/api/products') createdProductIds.push(res.body.id);
    if (path === '/api/users') createdUserIds.push(BigInt(res.body.id));
  };

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

    const dedicatedCat = await prisma.category.create({
      data: {
        name: `IMS53 Dedicated Category ${RUN}`,
        createdBy: sadia.id,
      },
    });
    dedicatedCategoryId = dedicatedCat.id;
    createdCategoryIds.push(dedicatedCat.id);

    const dedicatedProd = await prisma.product.create({
      data: {
        sku: `IMS53-SKU-${RUN}`,
        name: `IMS53 Dedicated Product ${RUN}`,
        categoryId: dedicatedCategoryId,
        purchasePrice: 100,
        sellingPrice: 150,
        minStock: 5,
        createdBy: sadia.id,
      },
    });
    dedicatedProductId = Number(dedicatedProd.id);
    createdProductIds.push(dedicatedProductId);
  }, 15_000);

  afterAll(async () => {
    if (prisma) {
      if (createdProductIds.length > 0) {
        await prisma.product.deleteMany({
          where: { id: { in: createdProductIds.map((id) => BigInt(id)) } },
        });
      }
      if (createdCategoryIds.length > 0) {
        await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
      }
      const testUsers = await prisma.user.findMany({
        where: { username: { startsWith: PREFIX } },
        select: { id: true },
      });
      const ids = [...testUsers.map((u) => u.id), ...createdUserIds];
      if (ids.length > 0) {
        await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    }
    if (app) {
      await app.close();
    }
  }, 15_000);

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
      [UserRole.Administrator, 'get', '/api/health', 200, () => '/api/health'],
      [UserRole.SalesStaff, 'get', '/api/health', 200, () => '/api/health'],
      [UserRole.StoreStaff, 'get', '/api/health', 200, () => '/api/health'],

      [UserRole.Administrator, 'get', '/api/auth/me', 200, () => '/api/auth/me'],
      [UserRole.SalesStaff, 'get', '/api/auth/me', 200, () => '/api/auth/me'],
      [UserRole.StoreStaff, 'get', '/api/auth/me', 200, () => '/api/auth/me'],

      [UserRole.Administrator, 'get', '/api/inventory', 200, () => '/api/inventory'],
      [UserRole.SalesStaff, 'get', '/api/inventory', 200, () => '/api/inventory'],
      [UserRole.StoreStaff, 'get', '/api/inventory', 200, () => '/api/inventory'],

      [UserRole.Administrator, 'get', '/api/categories', 200, () => '/api/categories'],
      [UserRole.SalesStaff, 'get', '/api/categories', 200, () => '/api/categories'],
      [UserRole.StoreStaff, 'get', '/api/categories', 200, () => '/api/categories'],

      [
        UserRole.Administrator,
        'get',
        '/api/categories/:id',
        200,
        () => `/api/categories/${dedicatedCategoryId}`,
      ],
      [
        UserRole.SalesStaff,
        'get',
        '/api/categories/:id',
        200,
        () => `/api/categories/${dedicatedCategoryId}`,
      ],
      [
        UserRole.StoreStaff,
        'get',
        '/api/categories/:id',
        200,
        () => `/api/categories/${dedicatedCategoryId}`,
      ],

      [
        UserRole.Administrator,
        'get',
        '/api/products/:id',
        200,
        () => `/api/products/${dedicatedProductId}`,
      ],
      [
        UserRole.SalesStaff,
        'get',
        '/api/products/:id',
        200,
        () => `/api/products/${dedicatedProductId}`,
      ],
      [
        UserRole.StoreStaff,
        'get',
        '/api/products/:id',
        200,
        () => `/api/products/${dedicatedProductId}`,
      ],

      // Sales Endpoint Group (Admin + Sales Staff only)
      [UserRole.Administrator, 'get', '/api/sales', 200, () => '/api/sales'],
      [UserRole.SalesStaff, 'get', '/api/sales', 200, () => '/api/sales'],
      [UserRole.StoreStaff, 'get', '/api/sales', 403, () => '/api/sales'],

      // Users Endpoint Group (Admin only)
      [UserRole.Administrator, 'get', '/api/users', 200, () => '/api/users'],
      [UserRole.SalesStaff, 'get', '/api/users', 403, () => '/api/users'],
      [UserRole.StoreStaff, 'get', '/api/users', 403, () => '/api/users'],
    ] as const)('%s %s %s -> %i', async (role, method, _label, expectedStatus, buildPath) => {
      const res = await http()
        [method](buildPath())
        .set('Authorization', `Bearer ${roleSessions[role].accessToken}`);
      expect(res.status).toBe(expectedStatus);
      if (expectedStatus === 403) {
        expect(res.body.code).toBe('FORBIDDEN_ROLE');
      }
    });

    it('enforces Admin-only permissions on /api/users (GET/:id, GET/:id/audit, POST, PATCH)', async () => {
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

      // Admin succeeds on POST /api/users (201) and PATCH /api/users/:id (200)
      const createdUsername = `${PREFIX}created_staff`;
      const createRes = await http()
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'IMS53 Created Staff',
          username: createdUsername,
          email: `${createdUsername}@example.local`,
          role: UserRole.SalesStaff,
          temporaryPassword: 'Temporary!1',
        });
      expect(createRes.status).toBe(201);
      createdUserIds.push(BigInt(createRes.body.id));

      const patchRes = await http()
        .patch(`/api/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'IMS53 Updated Staff' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.name).toBe('IMS53 Updated Staff');

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
        {
          path: '/api/categories',
          pending: http()
            .post('/api/categories')
            .set('Authorization', `Bearer ${salesToken}`)
            .send({ name: `Forbidden_${RUN}` }),
        },
        {
          path: `/api/categories/${dedicatedCategoryId}`,
          pending: http()
            .patch(`/api/categories/${dedicatedCategoryId}`)
            .set('Authorization', `Bearer ${salesToken}`)
            .send({ name: `ForbiddenPatch_${RUN}` }),
        },
        {
          path: `/api/categories/${dedicatedCategoryId}`,
          pending: http()
            .delete(`/api/categories/${dedicatedCategoryId}`)
            .set('Authorization', `Bearer ${salesToken}`),
        },
      ];
      for (const call of salesCalls) {
        const res = await call.pending;
        trackUnexpectedCreate(call.path, res);
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
        const catId: number = createRes.body.id;
        createdCategoryIds.push(catId);

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

    it('enforces Admin & Store Staff permissions on /api/products write operations', async () => {
      // Sales Staff cannot POST or PATCH products
      const salesToken = roleSessions[UserRole.SalesStaff].accessToken;
      const salesCalls = [
        {
          path: '/api/products',
          pending: http()
            .post('/api/products')
            .set('Authorization', `Bearer ${salesToken}`)
            .send({
              sku: `FORBIDDEN-${RUN}`,
              name: 'Forbidden Product',
              categoryId: dedicatedCategoryId,
              purchasePrice: 10,
              sellingPrice: 20,
              minStock: 1,
            }),
        },
        {
          path: `/api/products/${dedicatedProductId}`,
          pending: http()
            .patch(`/api/products/${dedicatedProductId}`)
            .set('Authorization', `Bearer ${salesToken}`)
            .send({ name: 'Forbidden Update' }),
        },
      ];
      for (const call of salesCalls) {
        const res = await call.pending;
        trackUnexpectedCreate(call.path, res);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN_ROLE');
      }

      // Admin and Store Staff can POST and PATCH products
      for (const [index, role] of [UserRole.Administrator, UserRole.StoreStaff].entries()) {
        const token = roleSessions[role].accessToken;
        const createRes = await http()
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send({
            sku: `IMS53-${index}-${RUN}`,
            name: `IMS53 Product ${role} ${RUN}`,
            categoryId: dedicatedCategoryId,
            purchasePrice: 50,
            sellingPrice: 75,
            minStock: 2,
          });
        expect(createRes.status).toBe(201);
        const productId: number = createRes.body.id;
        createdProductIds.push(productId);

        const patchRes = await http()
          .patch(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ sellingPrice: 80 });
        expect(patchRes.status).toBe(200);
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
      { method: 'get', path: () => `/api/categories/${dedicatedCategoryId}` },
      { method: 'post', path: () => '/api/categories', body: { name: 'ShouldFail' } },
      {
        method: 'patch',
        path: () => `/api/categories/${dedicatedCategoryId}`,
        body: { name: 'ShouldFail' },
      },
      { method: 'delete', path: () => `/api/categories/${dedicatedCategoryId}` },
      { method: 'get', path: () => `/api/products/${dedicatedProductId}` },
      { method: 'post', path: () => '/api/products', body: {} },
      { method: 'patch', path: () => `/api/products/${dedicatedProductId}`, body: {} },
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

    it('allows public /api/health without a token and with an expired token', async () => {
      const noToken = await http().get('/api/health');
      expect(noToken.status).toBe(200);

      const expiredToken = authService.signAccessToken(
        roleSessions[UserRole.Administrator].user,
        -60,
      );
      const withExpired = await http()
        .get('/api/health')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(withExpired.status).toBe(200);
    });

    it('rejects requests without a Bearer token with 401 on every protected endpoint group', async () => {
      for (const endpoint of protectedEndpoints) {
        const path = endpoint.path();
        const req = http()[endpoint.method](path);
        const res = endpoint.body ? await req.send(endpoint.body) : await req;
        trackUnexpectedCreate(path, res);
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Authorization header is missing');
      }
    });

    it('rejects expired access tokens with 401 "Token has expired" on every protected endpoint group', async () => {
      const adminSession = roleSessions[UserRole.Administrator];
      const expiredToken = authService.signAccessToken(adminSession.user, -60);

      for (const endpoint of protectedEndpoints) {
        const path = endpoint.path();
        const req = http()[endpoint.method](path).set('Authorization', `Bearer ${expiredToken}`);
        const res = endpoint.body ? await req.send(endpoint.body) : await req;
        trackUnexpectedCreate(path, res);
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
        const path = endpoint.path();
        const req = http()
          [endpoint.method](path)
          .set('Authorization', `Bearer ${deactSession.accessToken}`);
        const res = endpoint.body ? await req.send(endpoint.body) : await req;
        trackUnexpectedCreate(path, res);
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Account is deactivated');
      }
    });
  });
});
