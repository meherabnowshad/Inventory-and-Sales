import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('API Integration Tests against Test Database (IMS-51.2 | NFR-OPS-01)', () => {
  let app: INestApplication;
  let createdCategoryId: number;
  let authToken: string;

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
  });

  describe('Category API test cases (IMS-08.5 | FR-CAT-01–04)', () => {
    const tag = `IMS085-${Date.now()}`;
    let prisma: PrismaService;
    let adminId: bigint;
    let createdCatId: number;

    const makeCategory = async (
      suffix: string,
      extra: Record<string, unknown> = {},
    ): Promise<request.Response> => {
      return request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `${tag} ${suffix}`, ...extra });
    };

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

    afterAll(async () => {
      await prisma.product.deleteMany({ where: { sku: { startsWith: tag } } }).catch(() => {});
      await prisma.category.deleteMany({ where: { name: { startsWith: tag } } }).catch(() => {});
      if (createdCatId) {
        await prisma.category.delete({ where: { id: createdCatId } }).catch(() => {});
      }
    });

    describe('FR-CAT-01: Category Creation, Read & Validation', () => {
      it('POST /api/categories creates category with trimmed name and default isActive: true', async () => {
        const rawName = `  ${tag} Padded Category  `;
        const res = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: rawName, description: 'Trimming test' });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe(`${tag} Padded Category`);
        expect(res.body.description).toBe('Trimming test');
        expect(res.body.isActive).toBe(true);
        expect(res.body).toHaveProperty('createdAt');
        expect(res.body).toHaveProperty('updatedAt');

        createdCatId = res.body.id;
      });

      it('POST /api/categories rejects empty or whitespace-only name with 400 Bad Request', async () => {
        const resEmpty = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: '' });
        expect(resEmpty.status).toBe(400);

        const resSpaces = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: '     ' });
        expect(resSpaces.status).toBe(400);
      });

      it('POST /api/categories rejects name exceeding 80 characters with 400 Bad Request', async () => {
        const longName = 'A'.repeat(81);
        const res = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: longName });
        expect(res.status).toBe(400);
      });

      it('POST /api/categories captures authenticated user ID in database createdBy column', async () => {
        expect(createdCatId).toBeDefined();
        const dbRecord = await prisma.category.findUnique({ where: { id: createdCatId } });
        expect(dbRecord).not.toBeNull();
        expect(dbRecord?.createdBy).toBe(adminId);
      });

      it('GET /api/categories/:id returns the category details', async () => {
        expect(createdCatId).toBeDefined();
        const res = await request(app.getHttpServer())
          .get(`/api/categories/${createdCatId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(createdCatId);
        expect(res.body.name).toBe(`${tag} Padded Category`);
      });

      it('GET /api/categories/999999 returns 404 Not Found', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/categories/999999')
          .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(404);
      });

      it('POST /api/categories allows creating a category without a description', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: `${tag} No Desc Category` });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe(`${tag} No Desc Category`);
        expect(res.body.description).toBeNull();
      });

      it('POST /api/categories accepts description with 255 chars but rejects 256 chars with 400', async () => {
        const desc255 = 'D'.repeat(255);
        const okRes = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: `${tag} Desc 255`, description: desc255 });
        expect(okRes.status).toBe(201);
        expect(okRes.body.description).toBe(desc255);

        const desc256 = 'D'.repeat(256);
        const failRes = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: `${tag} Desc 256`, description: desc256 });
        expect(failRes.status).toBe(400);
      });

      it('PATCH /api/categories/:id rejects empty name or name exceeding 80 characters with 400', async () => {
        const cat = await makeCategory('Patch Validation');

        const emptyRes = await request(app.getHttpServer())
          .patch(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: '' });
        expect(emptyRes.status).toBe(400);

        const longRes = await request(app.getHttpServer())
          .patch(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: 'L'.repeat(81) });
        expect(longRes.status).toBe(400);
      });

      it('PATCH /api/categories/999999 returns 404 Not Found', async () => {
        const res = await request(app.getHttpServer())
          .patch('/api/categories/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: `${tag} Nonexistent` });
        expect(res.status).toBe(404);
      });
    });

    describe('FR-CAT-02: Unique Category Name Enforcement (BR-12)', () => {
      it('POST /api/categories rejects duplicate category name with 409 CATEGORY_NAME_TAKEN', async () => {
        const name = `${tag} Unique Name`;
        const first = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name });
        expect(first.status).toBe(201);

        const duplicate = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name });
        expect(duplicate.status).toBe(409);
        expect(duplicate.body.code).toBe('CATEGORY_NAME_TAKEN');
      });

      it('POST /api/categories rejects duplicate category name case-insensitively with 409', async () => {
        const baseName = `${tag} Case Test`;
        await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: baseName.toUpperCase() });

        const duplicate = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: baseName.toLowerCase() });
        expect(duplicate.status).toBe(409);
        expect(duplicate.body.code).toBe('CATEGORY_NAME_TAKEN');
      });

      it('POST /api/categories rejects duplicate category name with surrounding whitespace with 409', async () => {
        const baseName = `${tag} Space Dup`;
        await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: baseName });

        const duplicate = await request(app.getHttpServer())
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: `   ${baseName}   ` });
        expect(duplicate.status).toBe(409);
        expect(duplicate.body.code).toBe('CATEGORY_NAME_TAKEN');
      });

      it('PATCH /api/categories/:id rejects renaming to an existing category name with 409', async () => {
        const catA = await makeCategory('Rename Target A');
        const catB = await makeCategory('Rename Target B');

        const conflict = await request(app.getHttpServer())
          .patch(`/api/categories/${catB.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: catA.body.name });

        expect(conflict.status).toBe(409);
        expect(conflict.body.code).toBe('CATEGORY_NAME_TAKEN');
      });

      it('PATCH /api/categories/:id allows updating fields without changing name (no self-conflict)', async () => {
        const cat = await makeCategory('Self Update');
        const res = await request(app.getHttpServer())
          .patch(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: cat.body.name, description: 'Updated description' });

        expect(res.status).toBe(200);
        expect(res.body.description).toBe('Updated description');
      });

      it('PATCH /api/categories/:id renames category to a new free name and keeps linked products', async () => {
        const cat = await makeCategory('Rename Free Target');
        await makeProduct(cat.body.id, 'rf1', true);
        await makeProduct(cat.body.id, 'rf2', true);

        const newName = `${tag} Renamed Free Name`;
        const renameRes = await request(app.getHttpServer())
          .patch(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: newName });

        expect(renameRes.status).toBe(200);
        expect(renameRes.body.name).toBe(newName);

        // Verify productCount remains preserved in GET /api/categories
        const listRes = await request(app.getHttpServer())
          .get('/api/categories')
          .set('Authorization', `Bearer ${authToken}`);
        const updatedInList = listRes.body.find((c: { id: number }) => c.id === cat.body.id);
        expect(updatedInList).toBeDefined();
        expect(updatedInList.name).toBe(newName);
        expect(updatedInList.productCount).toBe(2);
      });
    });

    describe('FR-CAT-03: Deactivate & In-Use Delete Guard Rules', () => {
      it('deactivating an in-use category is allowed (200 OK)', async () => {
        const cat = await makeCategory('deact-inuse');
        await makeProduct(cat.body.id, 'd1', true);

        const res = await request(app.getHttpServer())
          .patch(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ isActive: false });

        expect(res.status).toBe(200);
        expect(res.body.isActive).toBe(false);
      });

      it('reactivating an inactive category is allowed (200 OK and status updates)', async () => {
        const cat = await makeCategory('reactivate-test');

        // Deactivate
        const deactRes = await request(app.getHttpServer())
          .patch(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ isActive: false });
        expect(deactRes.status).toBe(200);
        expect(deactRes.body.isActive).toBe(false);

        // Reactivate
        const reactRes = await request(app.getHttpServer())
          .patch(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ isActive: true });
        expect(reactRes.status).toBe(200);
        expect(reactRes.body.isActive).toBe(true);

        // Verify in GET /api/categories/:id
        const getRes = await request(app.getHttpServer())
          .get(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(getRes.status).toBe(200);
        expect(getRes.body.isActive).toBe(true);
      });

      it('deleting a category with an active product returns 409 CATEGORY_IN_USE', async () => {
        const cat = await makeCategory('act-prod');
        await makeProduct(cat.body.id, 'ap1', true);

        const res = await request(app.getHttpServer())
          .delete(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('CATEGORY_IN_USE');
        expect(res.body.productCount).toBe(1);
      });

      it('deleting a category with only an inactive product returns 409 CATEGORY_IN_USE', async () => {
        const cat = await makeCategory('inact-prod');
        await makeProduct(cat.body.id, 'ip1', false);

        const res = await request(app.getHttpServer())
          .delete(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('CATEGORY_IN_USE');
      });

      it('deleting an unused category returns 204 and category is removed', async () => {
        const cat = await makeCategory('unused-del');

        const res = await request(app.getHttpServer())
          .delete(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(204);

        const check = await request(app.getHttpServer())
          .get(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(check.status).toBe(404);
      });

      it('deleting a non-existent category returns 404', async () => {
        const res = await request(app.getHttpServer())
          .delete('/api/categories/999999')
          .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(404);
      });
    });

    describe('FR-CAT-04: Product Counts & Status Filtering', () => {
      it('GET /api/categories returns productCount for every category', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/categories')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        for (const cat of res.body) {
          expect(typeof cat.productCount).toBe('number');
        }
      });

      it('GET /api/categories includes productCount: 0 for categories with no products', async () => {
        const cat = await makeCategory('zero-count');
        const res = await request(app.getHttpServer())
          .get('/api/categories')
          .set('Authorization', `Bearer ${authToken}`);

        const row = res.body.find((c: { id: number }) => c.id === cat.body.id);
        expect(row).toBeDefined();
        expect(row.productCount).toBe(0);
      });

      it('GET /api/categories includes both active and inactive products in productCount', async () => {
        const cat = await makeCategory('mixed-count');
        await makeProduct(cat.body.id, 'm1', true);
        await makeProduct(cat.body.id, 'm2', true);
        await makeProduct(cat.body.id, 'm3', false);

        const res = await request(app.getHttpServer())
          .get('/api/categories')
          .set('Authorization', `Bearer ${authToken}`);

        const row = res.body.find((c: { id: number }) => c.id === cat.body.id);
        expect(row).toBeDefined();
        expect(row.productCount).toBe(3);
      });

      it('GET /api/categories?status=active returns only active categories', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/categories?status=active')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body.every((c: { isActive: boolean }) => c.isActive === true)).toBe(true);
      });

      it('GET /api/categories?status=inactive returns only inactive categories', async () => {
        // Ensure at least one inactive category exists
        const cat = await makeCategory('inact-filter');
        await request(app.getHttpServer())
          .patch(`/api/categories/${cat.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ isActive: false });

        const res = await request(app.getHttpServer())
          .get('/api/categories?status=inactive')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body.every((c: { isActive: boolean }) => c.isActive === false)).toBe(true);
      });

      it('GET /api/categories?status=all returns all categories regardless of active status', async () => {
        const resAll = await request(app.getHttpServer())
          .get('/api/categories?status=all')
          .set('Authorization', `Bearer ${authToken}`);

        const resDefault = await request(app.getHttpServer())
          .get('/api/categories')
          .set('Authorization', `Bearer ${authToken}`);

        expect(resAll.status).toBe(200);
        expect(resAll.body.length).toBe(resDefault.body.length);
      });

      it('GET /api/categories?status=invalid returns 400 Bad Request', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/categories?status=invalid')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain(
          'status must be one of the following values: active, inactive, all',
        );
      });

      it('GET /api/categories returns categories sorted alphabetically by name ASC', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/categories')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        const names: string[] = res.body.map((c: { name: string }) => c.name);
        const sortedNames = [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        expect(names).toEqual(sortedNames);
      });
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
