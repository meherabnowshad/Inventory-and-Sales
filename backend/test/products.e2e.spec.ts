import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// API tests for the product endpoints, against the real test database (IMS-10 | FR-PRD-01 to FR-PRD-05).
// Only what needs the real database or the real HTTP stack is here: unique index, SKU lock trigger,
// stored values, routes, 401/404. The field-by-field validation rules and the service logic are
// unit tests: src/products/dto/product.dto.spec.ts and src/products/products.service.spec.ts
describe('Products API (IMS-10 | FR-PRD-01 to FR-PRD-05)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let categoryId: number;
  const createdProductIds: number[] = [];
  const run = Date.now(); // keeps SKUs and category names unique between test runs
  let counter = 0;
  const nextSku = () => `T10-${run}-${++counter}`;

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    sku: nextSku(),
    name: 'Test product',
    categoryId,
    purchasePrice: 700,
    sellingPrice: 950,
    minStock: 5,
    ...overrides,
  });

  const createProduct = async (overrides: Record<string, unknown> = {}) => {
    const res = await auth(http().post('/api/products')).send(validBody(overrides));
    if (res.status === 201) {
      createdProductIds.push(res.body.id);
    }
    return res;
  };

  // a seeded product that has a stock movement, that is a received purchase order
  const productWithHistory = async () => {
    const movement = await prisma.stockMovement.findFirst({ include: { product: true } });
    expect(movement, 'the seed data should contain a received purchase order').toBeTruthy();
    return movement!.product;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const login = await http()
      .post('/api/auth/login')
      .send({ usernameOrEmail: 'sadia', password: 'Smart@1234' });
    token = login.body.accessToken || login.body.token;

    const category = await auth(http().post('/api/categories')).send({ name: `T10 ${run}` });
    categoryId = category.body.id;
  });

  afterAll(async () => {
    if (app) {
      // test products have no stock movements, so they can be removed; then their category
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds.map(BigInt) } } });
      await prisma.category.deleteMany({ where: { id: categoryId } }).catch(() => {});
      await app.close();
    }
  });

  describe('POST /api/products (FR-PRD-01, FR-PRD-02, FR-PRD-03)', () => {
    it('rejects a request without a token with 401', async () => {
      const res = await http().post('/api/products').send(validBody());
      expect(res.status).toBe(401);
    });

    it('creates a product and stores it: 201, 2-decimal price strings, stock 0, active', async () => {
      const body = validBody({ name: '  Logitech Test  ' });
      const res = await createProduct(body);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        sku: body.sku,
        name: 'Logitech Test', // trimmed by the real ValidationPipe
        categoryId,
        purchasePrice: '700.00',
        sellingPrice: '950.00',
        minStock: 5,
        stockQty: 0,
        isActive: true,
        warnings: [],
      });
      expect(res.body).not.toHaveProperty('createdBy');

      const stored = await prisma.product.findUnique({ where: { id: BigInt(res.body.id) } });
      expect(stored).toMatchObject({ sku: body.sku, stockQty: 0, isActive: true });
      expect(stored!.createdBy).toBeTypeOf('bigint'); // the logged-in user, taken from the token
    });

    it('accepts the lowest and the highest values: the DTO limits match the database checks', async () => {
      const low = await createProduct({ purchasePrice: 0, sellingPrice: 0, minStock: 0 });
      expect(low.status).toBe(201);
      expect(low.body).toMatchObject({ purchasePrice: '0.00', sellingPrice: '0.00', minStock: 0 });

      const high = await createProduct({ purchasePrice: 9999999.99, sellingPrice: 9999999.99 });
      expect(high.status).toBe(201);
      expect(high.body.sellingPrice).toBe('9999999.99');
    });

    it('answers 400 naming the field when the body breaks a rule: the ValidationPipe is on this route', async () => {
      const res = await auth(http().post('/api/products')).send(
        validBody({ sellingPrice: 950.555 }),
      );
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('sellingPrice');
    });

    it('rejects a SKU that exists, ignoring case, with 409 SKU_TAKEN: the database unique index (FR-PRD-02)', async () => {
      const first = await createProduct();
      const res = await createProduct({ sku: first.body.sku.toLowerCase() });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SKU_TAKEN');
    });
  });

  describe('GET /api/products/:id', () => {
    it('returns the product, 404 when it does not exist', async () => {
      const created = await createProduct();
      const found = await auth(http().get(`/api/products/${created.body.id}`));
      expect(found.status).toBe(200);
      expect(found.body.sku).toBe(created.body.sku);

      const missing = await auth(http().get('/api/products/2000000000'));
      expect(missing.status).toBe(404);
    });
  });

  describe('PATCH /api/products/:id (FR-PRD-02, FR-PRD-03, FR-PRD-04)', () => {
    it('changes only the fields that are sent, and stores them', async () => {
      const created = await createProduct();
      const res = await auth(http().patch(`/api/products/${created.body.id}`)).send({
        name: 'Renamed',
        sellingPrice: 990,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        sku: created.body.sku,
        name: 'Renamed',
        sellingPrice: '990.00',
        purchasePrice: '700.00', // untouched
        minStock: 5,
      });

      const stored = await prisma.product.findUnique({ where: { id: BigInt(created.body.id) } });
      expect(stored!.sellingPrice.toFixed(2)).toBe('990.00');
    });

    it('answers 400, never a 500, for a field sent as null: the ValidationPipe is on this route', async () => {
      const created = await createProduct();
      const res = await auth(http().patch(`/api/products/${created.body.id}`)).send({ name: null });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('name');
    });

    it('lets the SKU change while the product has no stock movement', async () => {
      const created = await createProduct();
      const newSku = nextSku();
      const res = await auth(http().patch(`/api/products/${created.body.id}`)).send({
        sku: newSku,
      });
      expect(res.status).toBe(200);
      expect(res.body.sku).toBe(newSku);
    });

    it('rejects a SKU that another product has, ignoring case, with 409 SKU_TAKEN', async () => {
      const a = await createProduct();
      const b = await createProduct();
      const res = await auth(http().patch(`/api/products/${b.body.id}`)).send({
        sku: a.body.sku.toLowerCase(),
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SKU_TAKEN');
    });

    it('rejects a SKU change once the product has a stock movement with 422 SKU_LOCKED', async () => {
      const product = await productWithHistory();

      const res = await auth(http().patch(`/api/products/${product.id}`)).send({
        sku: `${product.sku}-X`,
      });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('SKU_LOCKED');

      const after = await prisma.product.findUnique({ where: { id: product.id } });
      expect(after!.sku).toBe(product.sku);
    });

    it('the database trigger refuses the same change even without the API, with the text the service looks for', async () => {
      const product = await productWithHistory();

      await expect(
        prisma.product.update({ where: { id: product.id }, data: { sku: `${product.sku}-Y` } }),
      ).rejects.toThrow(/SKU is locked/);
    });

    it('still lets a product with movements keep its SKU while other fields change', async () => {
      const product = await productWithHistory();
      const res = await auth(http().patch(`/api/products/${product.id}`)).send({
        sku: product.sku, // same SKU is not a change
        minStock: product.minStock,
      });
      expect(res.status).toBe(200);
    });

    it('answers 404 for a product that does not exist', async () => {
      const res = await auth(http().patch('/api/products/2000000000')).send({ name: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('Price changes apply to new documents only (FR-PRD-04)', () => {
    it('leaves the unit cost on an existing purchase order line untouched', async () => {
      // seeded products sit on received purchase orders; their line keeps its own unit_cost
      const line = await prisma.purchaseOrderLine.findFirst({ include: { product: true } });
      expect(line, 'the seed data should contain a purchase order line').toBeTruthy();
      const product = line!.product;
      const newPrice = Number(product.purchasePrice) + 123.45;

      try {
        const res = await auth(http().patch(`/api/products/${product.id}`)).send({
          purchasePrice: newPrice,
        });
        expect(res.status).toBe(200);
        expect(res.body.purchasePrice).toBe(newPrice.toFixed(2));

        const lineAfter = await prisma.purchaseOrderLine.findUnique({ where: { id: line!.id } });
        expect(lineAfter!.unitCost.toString()).toBe(line!.unitCost.toString());
      } finally {
        // put the seeded product back as it was
        await prisma.product.update({
          where: { id: product.id },
          data: { purchasePrice: product.purchasePrice },
        });
      }
    });
  });

  describe('Deactivate a product (FR-PRD-05, BR-14)', () => {
    it('deactivates with isActive=false and reactivates with true; the product stays readable', async () => {
      const created = await createProduct();

      const off = await auth(http().patch(`/api/products/${created.body.id}`)).send({
        isActive: false,
      });
      expect(off.status).toBe(200);
      expect(off.body.isActive).toBe(false);

      const found = await auth(http().get(`/api/products/${created.body.id}`));
      expect(found.status).toBe(200);
      expect(found.body.isActive).toBe(false);

      const on = await auth(http().patch(`/api/products/${created.body.id}`)).send({
        isActive: true,
      });
      expect(on.body.isActive).toBe(true);
    });

    it('deactivates a product that has stock and history instead of deleting it', async () => {
      const product = await productWithHistory();
      expect(product.isActive).toBe(true);

      try {
        const res = await auth(http().patch(`/api/products/${product.id}`)).send({
          isActive: false,
        });
        expect(res.status).toBe(200);
        expect(res.body.isActive).toBe(false);
        expect(res.body.stockQty).toBe(product.stockQty); // stock is kept
      } finally {
        await prisma.product.update({ where: { id: product.id }, data: { isActive: true } });
      }
    });

    it('offers no DELETE: a product is never hard-deleted (BR-14)', async () => {
      const created = await createProduct();
      const res = await auth(http().delete(`/api/products/${created.body.id}`));
      expect(res.status).toBe(404); // the route does not exist

      const still = await auth(http().get(`/api/products/${created.body.id}`));
      expect(still.status).toBe(200);
    });
  });
});
