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

      expect(res.status).toBe(999);
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
