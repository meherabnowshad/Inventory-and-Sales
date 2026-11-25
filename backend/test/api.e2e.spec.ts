import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '../src/auth/constants/roles';

describe('API Integration Tests against Test Database (IMS-51.2 | NFR-OPS-01)', () => {
  let app: INestApplication;
  let createdCategoryId: number;
  let authToken: string;
  let refreshToken: string;
  let roleTokens: Record<UserRole, string>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    // Authenticate with seeded user (sadia) to obtain Bearer token for protected routes (IMS-05.5)
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ usernameOrEmail: 'sadia', password: 'Smart@1234' });
    authToken = loginRes.body.accessToken || loginRes.body.token;

    expect(loginRes.body).not.toHaveProperty('refreshToken');
    const refreshCookie = loginRes.headers['set-cookie']?.find((cookie) =>
      cookie.startsWith('refreshToken='),
    );
    expect(refreshCookie).toBeDefined();
    refreshToken = refreshCookie?.split(';', 1)[0].slice('refreshToken='.length) ?? '';

    roleTokens = {} as Record<UserRole, string>;
    for (const [role, username] of [
      [UserRole.Administrator, 'sadia'],
      [UserRole.SalesStaff, 'rafi'],
      [UserRole.StoreStaff, 'mitu'],
    ] as const) {
      const roleLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ usernameOrEmail: username, password: 'Smart@1234' });
      roleTokens[role] = roleLogin.body.accessToken || roleLogin.body.token;
    }
  });

  afterAll(async () => {
    if (app) {
      if (createdCategoryId) {
        try {
          const prisma = app.get(PrismaService);
          await prisma.category.delete({ where: { id: createdCategoryId } }).catch(() => {});
        } catch {
          // ignore cleanup errors
        }
      }
      await app.close();
    }
  });

  describe('Health API (GET /api/health)', () => {
    it('returns status UP and reports database connected', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'UP',
        service: 'Inventory and Sales Backend API (NestJS 10)',
        version: '1.0.0',
        database: {
          connected: true,
        },
      });
    });
  });

  describe('Authentication Enforcement (IMS-05.5 | NFR-SEC-01)', () => {
    it('rejects unauthenticated requests to protected endpoints with HTTP 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/categories');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authorization header is missing');
    });

    it('rejects requests with invalid Bearer token with HTTP 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', 'Bearer invalid_token_123');
      expect(res.status).toBe(401);
    });

    it('rejects requests using a refresh token as Bearer token on protected endpoints with HTTP 401 (TC-API-081 | NFR-SEC-01, NFR-SEC-05)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${refreshToken}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or expired token');
    });
  });

  describe('Role Permission Matrix (IMS-07)', () => {
    const roles = [UserRole.Administrator, UserRole.SalesStaff, UserRole.StoreStaff];

    it.each(
      roles.flatMap((role) => [
        [role, 'health', 200],
        [role, 'auth/me', 200],
        [role, 'categories', 200],
        [role, 'inventory', 200],
        [role, 'sales', role === UserRole.StoreStaff ? 403 : 200],
      ]),
    )('%s can access /api/%s with status %i', async (role, endpoint, expectedStatus) => {
      const res = await request(app.getHttpServer())
        .get(`/api/${endpoint}`)
        .set('Authorization', `Bearer ${roleTokens[role as UserRole]}`);

      expect(res.status).toBe(expectedStatus);
      if (expectedStatus === 200 && endpoint === 'auth/me') {
        expect(res.body.mustResetPassword).toEqual(expect.any(Boolean));
        expect(res.body).not.toHaveProperty('passwordHash');
      }
      if (expectedStatus === 403) {
        expect(res.body).toEqual({
          statusCode: 403,
          code: 'FORBIDDEN_ROLE',
          message: 'You do not have permission to perform this action',
        });
      }
    });

    it.each([
      [UserRole.Administrator, 201],
      [UserRole.SalesStaff, 403],
      [UserRole.StoreStaff, 201],
    ])('role %s category POST status %i', async (role, expectedStatus) => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${roleTokens[role as UserRole]}`)
        .send({ name: `IMS07 Matrix ${role} ${Date.now()}` });

      expect(res.status).toBe(expectedStatus);
      if (expectedStatus === 403) {
        expect(res.body.code).toBe('FORBIDDEN_ROLE');
      } else if (res.body.id) {
        const prisma = app.get(PrismaService);
        await prisma.category.delete({ where: { id: res.body.id } });
      }
    });

    it('forbidden Sales Staff POST, PATCH, and DELETE do not change categories', async () => {
      const prisma = app.get(PrismaService);
      const category = await prisma.category.findFirstOrThrow();
      const before = await prisma.category.count();

      const postRes = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${roleTokens[UserRole.SalesStaff]}`)
        .send({ name: `Forbidden IMS07 ${Date.now()}` });
      expect(postRes.status).toBe(403);
      expect(postRes.body.code).toBe('FORBIDDEN_ROLE');
      expect(await prisma.category.count()).toBe(before);

      const patchRes = await request(app.getHttpServer())
        .patch(`/api/categories/${category.id}`)
        .set('Authorization', `Bearer ${roleTokens[UserRole.SalesStaff]}`)
        .send({ description: 'Forbidden role patch' });
      expect(patchRes.status).toBe(403);
      expect(patchRes.body.code).toBe('FORBIDDEN_ROLE');
      expect(
        (await prisma.category.findUniqueOrThrow({ where: { id: category.id } })).description,
      ).toBe(category.description);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/categories/${category.id}`)
        .set('Authorization', `Bearer ${roleTokens[UserRole.SalesStaff]}`);
      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.code).toBe('FORBIDDEN_ROLE');
      expect(await prisma.category.findUnique({ where: { id: category.id } })).not.toBeNull();
    });
  });

  describe('Categories API (/api/categories)', () => {
    it('GET /api/categories returns seeded categories sorted by name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const names = res.body.map((c: { name: string }) => c.name);
      expect(names).toContain('Keyboards');
    });

    it('POST /api/categories creates a new category in the database', async () => {
      const newCategory = {
        name: `CI Test Category ${Date.now()}`,
        description: 'Created by automated CI API test suite',
      };

      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newCategory);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(newCategory.name);
      expect(res.body.description).toBe(newCategory.description);
      expect(res.body.isActive).toBe(true);

      createdCategoryId = res.body.id;
    });

    it('GET /api/categories/:id returns the created category', async () => {
      expect(createdCategoryId).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdCategoryId);
    });

    it('PATCH /api/categories/:id updates the category details', async () => {
      expect(createdCategoryId).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/api/categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Updated by CI API test' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdCategoryId);
      expect(res.body.description).toBe('Updated by CI API test');
    });

    it('GET /api/categories/999999 returns 404 Not Found', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories/999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Category delete and deactivate rules (IMS-08.3 | FR-CAT-03)', () => {
    const tag = `IMS083-${Date.now()}`;
    let prisma: PrismaService;
    let adminId: bigint;

    // Creates a category through the API and returns its id
    const makeCategory = async (suffix: string): Promise<number> => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `${tag} ${suffix}` });
      return res.body.id;
    };

    // Adds a product straight in the database (there is no products API yet)
    const makeProduct = (categoryId: number, suffix: string, isActive: boolean) =>
      prisma.product.create({
        data: {
          sku: `${tag}-${suffix}`,
          name: `${tag} ${suffix}`,
          categoryId,
          purchasePrice: '10.00',
          sellingPrice: '15.00',
          isActive,
          createdBy: adminId,
        },
      });

    beforeAll(async () => {
      prisma = app.get(PrismaService);
      adminId = (await prisma.user.findFirstOrThrow({ where: { username: 'sadia' } })).id;
    });

    // remove everything this block created: products first, then the categories
    afterAll(async () => {
      await prisma.product.deleteMany({ where: { sku: { startsWith: tag } } });
      await prisma.category.deleteMany({ where: { name: { startsWith: tag } } });
    });

    it('deactivating a category that products use is allowed (200)', async () => {
      const id = await makeCategory('deactivate');
      await makeProduct(id, 'd1', true);

      const res = await request(app.getHttpServer())
        .patch(`/api/categories/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });

    it('deleting a category with an active product returns 409 CATEGORY_IN_USE', async () => {
      const id = await makeCategory('active-product');
      await makeProduct(id, 'a1', true);

      const res = await request(app.getHttpServer())
        .delete(`/api/categories/${id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CATEGORY_IN_USE');
      expect(res.body.productCount).toBe(1);
    });

    it('deleting a category with only an inactive product returns 409 CATEGORY_IN_USE', async () => {
      const id = await makeCategory('inactive-product');
      await makeProduct(id, 'i1', false);

      const res = await request(app.getHttpServer())
        .delete(`/api/categories/${id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CATEGORY_IN_USE');
    });

    it('deleting an unused category returns 204 and the category is gone', async () => {
      const id = await makeCategory('unused');

      const res = await request(app.getHttpServer())
        .delete(`/api/categories/${id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(204);

      const again = await request(app.getHttpServer())
        .get(`/api/categories/${id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(again.status).toBe(404);
    });

    it('deleting a category that does not exist returns 404', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/categories/999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('productCount in the list includes inactive products (IMS-08.4)', async () => {
      const id = await makeCategory('count');
      await makeProduct(id, 'c1', true);
      await makeProduct(id, 'c2', false);

      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${authToken}`);

      const row = res.body.find((c: { id: number }) => c.id === id);
      expect(row.productCount).toBe(2);
    });
  });

  describe('Users API (/api/users)', () => {
    const tag = `IMS07-${Date.now()}`;
    const createdUsernames: string[] = [];
    let createdUserId: number;

    afterAll(async () => {
      const prisma = app.get(PrismaService);
      if (createdUsernames.length > 0) {
        const users = await prisma.user.findMany({
          where: { username: { in: createdUsernames } },
          select: { id: true },
        });
        for (const user of users) {
          await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
          await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
        }
      }
    });

    it('rafi and mitu get 403 on every users route', async () => {
      for (const role of [UserRole.SalesStaff, UserRole.StoreStaff]) {
        const token = roleTokens[role];
        const requests = [
          request(app.getHttpServer()).get('/api/users').set('Authorization', `Bearer ${token}`),
          request(app.getHttpServer()).get('/api/users/1').set('Authorization', `Bearer ${token}`),
          request(app.getHttpServer())
            .get('/api/users/1/audit')
            .set('Authorization', `Bearer ${token}`),
          request(app.getHttpServer())
            .post('/api/users')
            .set('Authorization', `Bearer ${token}`)
            .send({}),
          request(app.getHttpServer())
            .patch('/api/users/1')
            .set('Authorization', `Bearer ${token}`)
            .send({}),
        ];
        for (const pending of requests) {
          const res = await pending;
          expect(res.status).toBe(403);
          expect(res.body.code).toBe('FORBIDDEN_ROLE');
        }
      }
    });

    it('sadia can create a user and the created user can log in', async () => {
      const username = `${tag}-create`.toLowerCase();
      createdUsernames.push(username);
      const temporaryPassword = 'Temporary!1';

      const createRes = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'IMS07 Created User',
          username,
          email: `${tag}@example.local`.toLowerCase(),
          role: UserRole.SalesStaff,
          temporaryPassword,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.username).toBe(username);
      expect(createRes.body.mustResetPw).toBe(true);
      expect(createRes.body).not.toHaveProperty('passwordHash');
      expect(createRes.body).not.toHaveProperty('temporaryPassword');
      createdUserId = createRes.body.id;

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ usernameOrEmail: username, password: temporaryPassword });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.username).toBe(username);
      expect(loginRes.body.user.mustResetPassword).toBe(true);
      expect(loginRes.body.user).not.toHaveProperty('passwordHash');
    });

    it('sadia can edit and deactivate the created user', async () => {
      expect(createdUserId).toBeDefined();

      const editRes = await request(app.getHttpServer())
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'IMS07 Updated User', role: UserRole.StoreStaff });
      expect(editRes.status).toBe(200);
      expect(editRes.body.name).toBe('IMS07 Updated User');
      expect(editRes.body.role).toBe(UserRole.StoreStaff);

      const deactivateRes = await request(app.getHttpServer())
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false });
      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.isActive).toBe(false);

      const reactivateRes = await request(app.getHttpServer())
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: true });
      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.isActive).toBe(true);

      const auditRes = await request(app.getHttpServer())
        .get(`/api/users/${createdUserId}/audit`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(auditRes.status).toBe(200);
      const items = auditRes.body.items;
      expect(items.map((item: { action: string }) => item.action)).toEqual([
        'USER_REACTIVATED',
        'USER_DEACTIVATED',
        'USER_UPDATED',
        'ROLE_CHANGED',
        'USER_CREATED',
      ]);

      const prisma = app.get(PrismaService);
      const sadia = await prisma.user.findFirstOrThrow({ where: { username: 'sadia' } });
      expect(
        items.every(
          (item: { actorUserId: number; actorName: string }) =>
            item.actorUserId === Number(sadia.id) && item.actorName === 'sadia',
        ),
      ).toBe(true);
      expect(items[0].before).toEqual({ isActive: false });
      expect(items[0].after).toEqual({ isActive: true });
      expect(items[1].before).toEqual({ isActive: true });
      expect(items[1].after).toEqual({ isActive: false });
      expect(items[2].before).toEqual({ name: 'IMS07 Created User' });
      expect(items[2].after).toEqual({ name: 'IMS07 Updated User' });
      expect(items[3].before).toEqual({ role: UserRole.SalesStaff });
      expect(items[3].after).toEqual({ role: UserRole.StoreStaff });
      expect(items[4].before).toBeNull();
      expect(items[4].after).toEqual({
        id: createdUserId,
        name: 'IMS07 Created User',
        username: `${tag}-create`.toLowerCase(),
        email: `${tag}@example.local`.toLowerCase(),
        role: UserRole.SalesStaff,
        isActive: true,
      });
      expect(items[4].after).not.toHaveProperty('passwordHash');
      expect(items[4].after).not.toHaveProperty('temporaryPassword');
    });

    it('deactivated users cannot log in, refresh, or use access tokens, and can log in after reactivation', async () => {
      const prisma = app.get(PrismaService);
      const rafi = await prisma.user.findFirstOrThrow({ where: { username: 'rafi' } });

      try {
        const loginRes = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ usernameOrEmail: 'rafi', password: 'Smart@1234' });
        expect(loginRes.status).toBe(200);

        const rafiRefreshCookie = loginRes.headers['set-cookie']?.find((cookie) =>
          cookie.startsWith('refreshToken='),
        );
        expect(rafiRefreshCookie).toBeDefined();
        const rafiRefreshToken =
          rafiRefreshCookie?.split(';', 1)[0].slice('refreshToken='.length) ?? '';

        const deactivateRes = await request(app.getHttpServer())
          .patch(`/api/users/${rafi.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ isActive: false });
        expect(deactivateRes.status).toBe(200);

        for (const password of ['Smart@1234', 'WrongPassword999']) {
          const rejectedLogin = await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ usernameOrEmail: 'rafi', password });
          expect(rejectedLogin.status).toBe(401);
          expect(rejectedLogin.body.message).toBe('Invalid username or password');
        }

        const rejectedRefresh = await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken: rafiRefreshToken });
        expect(rejectedRefresh.status).toBe(401);
        expect(rejectedRefresh.body.message).toBe('Invalid or expired refresh token');

        const userTokens = await prisma.refreshToken.findMany({
          where: { userId: rafi.id },
        });
        expect(userTokens.length).toBeGreaterThan(0);
        expect(userTokens.every((token) => token.revokedAt !== null)).toBe(true);

        for (const path of ['/api/auth/me', '/api/categories']) {
          const rejectedRequest = await request(app.getHttpServer())
            .get(path)
            .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
          expect(rejectedRequest.status).toBe(401);
        }

        const reactivateRes = await request(app.getHttpServer())
          .patch(`/api/users/${rafi.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ isActive: true });
        expect(reactivateRes.status).toBe(200);

        const reactivatedLogin = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ usernameOrEmail: 'rafi', password: 'Smart@1234' });
        expect(reactivatedLogin.status).toBe(200);
        expect(reactivatedLogin.body.user.username).toBe('rafi');
        expect(reactivatedLogin.body.user.mustResetPassword).toEqual(expect.any(Boolean));
      } finally {
        await prisma.user.update({
          where: { id: rafi.id },
          data: { isActive: true },
        });
      }
    });

    it('duplicate username and email differing only by case return 409', async () => {
      const username = `${tag}-duplicate`.toLowerCase();
      const email = `${tag}-duplicate@example.local`.toLowerCase();
      createdUsernames.push(username);
      const body = {
        name: 'Duplicate Test',
        username,
        email,
        role: UserRole.StoreStaff,
        temporaryPassword: 'Temporary!1',
      };
      const first = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);
      expect(first.status).toBe(201);

      const secondUsername = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...body, email: `${tag}-other@example.local`, username: username.toUpperCase() });
      expect(secondUsername.status).toBe(409);
      expect(secondUsername.body.code).toBe('USERNAME_TAKEN');

      const secondEmail = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...body,
          username: `${tag}-other`,
          email: email.toUpperCase(),
        });
      expect(secondEmail.status).toBe(409);
      expect(secondEmail.body.code).toBe('EMAIL_TAKEN');
    });
  });

  describe('Inventory API (GET /api/inventory)', () => {
    it('returns seeded products with stock information', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Sales API (GET /api/sales)', () => {
    it('returns sales transaction records', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sales')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
