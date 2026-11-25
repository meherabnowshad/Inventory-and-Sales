import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

// Logic of ProductsService with a fake Prisma, so no database is needed (IMS-10)
// The same rules are also tried against the real database in test/products.e2e.spec.ts
describe('ProductsService (IMS-10 | FR-PRD-01 to FR-PRD-05)', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    category: { findUnique: ReturnType<typeof vi.fn> };
    stockMovement: { count: ReturnType<typeof vi.fn> };
  };

  const row = (overrides: Partial<Product> = {}): Product => ({
    id: 41n,
    sku: 'KB-K120',
    name: 'Logitech K120 Keyboard',
    categoryId: 1,
    purchasePrice: new Prisma.Decimal('700.00'),
    sellingPrice: new Prisma.Decimal('950.00'),
    minStock: 10,
    stockQty: 47,
    isActive: true,
    createdAt: new Date('2026-11-05T00:00:00Z'),
    updatedAt: new Date('2026-11-05T00:00:00Z'),
    createdBy: 3n,
    ...overrides,
  });

  const createDto = {
    sku: 'KB-K120',
    name: 'Logitech K120 Keyboard',
    categoryId: 1,
    purchasePrice: 700,
    sellingPrice: 950,
    minStock: 10,
  };

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });

  const rejection = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (e) {
      return e as { getStatus?: () => number; getResponse?: () => Record<string, unknown> };
    }
    throw new Error('expected the call to fail');
  };

  beforeEach(() => {
    prisma = {
      product: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve(
            row({
              sku: data.sku,
              name: data.name,
              categoryId: data.categoryId,
              purchasePrice: new Prisma.Decimal(data.purchasePrice),
              sellingPrice: new Prisma.Decimal(data.sellingPrice),
              minStock: data.minStock,
              stockQty: 0,
            }),
          ),
        ),
        findUnique: vi.fn().mockResolvedValue(row()),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve(
            row({
              ...(data.sellingPrice !== undefined && {
                sellingPrice: new Prisma.Decimal(data.sellingPrice),
              }),
              ...(data.purchasePrice !== undefined && {
                purchasePrice: new Prisma.Decimal(data.purchasePrice),
              }),
              ...(data.isActive !== undefined && { isActive: data.isActive }),
            }),
          ),
        ),
      },
      category: { findUnique: vi.fn().mockResolvedValue({ id: 1, isActive: true }) },
      stockMovement: { count: vi.fn().mockResolvedValue(0) },
    };
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  describe('create (FR-PRD-01, FR-PRD-02, FR-PRD-03)', () => {
    it('saves the product with prices as 2-decimal strings and the logged-in user as creator', async () => {
      await service.create({ ...createDto, sellingPrice: 950.5 }, 7n);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          sku: 'KB-K120',
          name: 'Logitech K120 Keyboard',
          categoryId: 1,
          purchasePrice: '700.00',
          sellingPrice: '950.50',
          minStock: 10,
          createdBy: 7n,
        },
      });
    });

    it('answers with plain JSON values: numeric id, price strings, no createdBy, no warning', async () => {
      const res = await service.create(createDto, 7n);

      expect(res).toMatchObject({
        id: 41,
        sku: 'KB-K120',
        categoryId: 1,
        purchasePrice: '700.00',
        sellingPrice: '950.00',
        minStock: 10,
        stockQty: 0,
        isActive: true,
        warnings: [],
      });
      expect(res).not.toHaveProperty('createdBy');
      expect(() => JSON.stringify(res)).not.toThrow(); // a BigInt would throw here
    });

    it('saves with a warning when the selling price is below the purchase price', async () => {
      const res = await service.create({ ...createDto, purchasePrice: 700, sellingPrice: 650 }, 7n);

      expect(prisma.product.create).toHaveBeenCalled(); // a warning never blocks the save
      expect(res!.warnings).toEqual([
        { code: 'SELLING_BELOW_PURCHASE', message: 'Selling price is below purchase price' },
      ]);
    });

    it.each([
      ['equal to', 700],
      ['above', 701],
    ])(
      'gives no warning when the selling price is %s the purchase price',
      async (_label, selling) => {
        const res = await service.create({ ...createDto, sellingPrice: selling }, 7n);
        expect(res!.warnings).toEqual([]);
      },
    );

    it('rejects a category that does not exist with 422 CATEGORY_NOT_FOUND, and saves nothing', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      const err = await rejection(service.create(createDto, 7n));
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      expect(err.getResponse!()).toMatchObject({ code: 'CATEGORY_NOT_FOUND', field: 'categoryId' });
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive category with 422 CATEGORY_INACTIVE (BR-11), and saves nothing', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 1, isActive: false });

      const err = await rejection(service.create(createDto, 7n));
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      expect(err.getResponse!()).toMatchObject({ code: 'CATEGORY_INACTIVE' });
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('turns a unique violation (P2002) into 409 SKU_TAKEN', async () => {
      prisma.product.create.mockRejectedValue(prismaError('P2002'));

      const err = await rejection(service.create(createDto, 7n));
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse!()).toMatchObject({ code: 'SKU_TAKEN' });
    });

    it('lets any other database error pass, so it ends as a 500 and is not hidden as SKU_TAKEN', async () => {
      const failure = new Error('connection lost');
      prisma.product.create.mockRejectedValue(failure);

      await expect(service.create(createDto, 7n)).rejects.toBe(failure);
    });
  });

  describe('findOne', () => {
    it('returns the product', async () => {
      const res = await service.findOne(41);
      expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { id: 41n } });
      expect(res.sku).toBe('KB-K120');
    });

    it('answers 404 when it does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update (FR-PRD-02, FR-PRD-03, FR-PRD-04, FR-PRD-05)', () => {
    it('answers 404 when the product does not exist, and changes nothing', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('sends only the fields that were given; prices go as 2-decimal strings', async () => {
      await service.update(41, { sellingPrice: 990 });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 41n },
        data: {
          sku: undefined,
          name: undefined,
          categoryId: undefined,
          purchasePrice: undefined,
          sellingPrice: '990.00',
          minStock: undefined,
          isActive: undefined,
        },
      });
    });

    describe('SKU lock (FR-PRD-02)', () => {
      it('rejects a SKU change with 422 SKU_LOCKED once the product has a stock movement', async () => {
        prisma.stockMovement.count.mockResolvedValue(3);

        const err = await rejection(service.update(41, { sku: 'KB-K121' }));
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        expect(err.getResponse!()).toMatchObject({ code: 'SKU_LOCKED' });
        expect(prisma.stockMovement.count).toHaveBeenCalledWith({ where: { productId: 41n } });
        expect(prisma.product.update).not.toHaveBeenCalled();
      });

      it('also locks a change of letter case only, as the database trigger does', async () => {
        prisma.stockMovement.count.mockResolvedValue(1);

        const err = await rejection(service.update(41, { sku: 'kb-k120' }));
        expect(err.getResponse!()).toMatchObject({ code: 'SKU_LOCKED' });
      });

      it('allows a SKU change while the product has no stock movement', async () => {
        prisma.stockMovement.count.mockResolvedValue(0);

        await service.update(41, { sku: 'KB-K121' });
        expect(prisma.product.update).toHaveBeenCalled();
      });

      it('does not even look at movements when the SKU is not changed', async () => {
        await service.update(41, { sku: 'KB-K120', name: 'Renamed' });
        await service.update(41, { name: 'Renamed' });

        expect(prisma.stockMovement.count).not.toHaveBeenCalled();
        expect(prisma.product.update).toHaveBeenCalledTimes(2);
      });

      it('answers SKU_LOCKED when a movement appears between the check and the update (database trigger)', async () => {
        prisma.product.update.mockRejectedValue(
          new Error('SKU is locked after the first stock movement (BR-12)'),
        );

        const err = await rejection(service.update(41, { sku: 'KB-K121' }));
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        expect(err.getResponse!()).toMatchObject({ code: 'SKU_LOCKED' });
      });
    });

    it('turns a unique violation (P2002) into 409 SKU_TAKEN', async () => {
      prisma.product.update.mockRejectedValue(prismaError('P2002'));

      const err = await rejection(service.update(41, { sku: 'KB-K121' }));
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse!()).toMatchObject({ code: 'SKU_TAKEN' });
    });

    it('answers 404, not 500, when the row is deleted between the lookup and the update (P2025)', async () => {
      prisma.product.update.mockRejectedValue(prismaError('P2025'));
      await expect(service.update(41, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets any other database error pass', async () => {
      const failure = new Error('connection lost');
      prisma.product.update.mockRejectedValue(failure);
      await expect(service.update(41, { name: 'x' })).rejects.toBe(failure);
    });

    describe('category (BR-11)', () => {
      it('checks the new category when it changes: inactive gives 422 CATEGORY_INACTIVE', async () => {
        prisma.category.findUnique.mockResolvedValue({ id: 2, isActive: false });

        const err = await rejection(service.update(41, { categoryId: 2 }));
        expect(err.getResponse!()).toMatchObject({ code: 'CATEGORY_INACTIVE' });
        expect(prisma.product.update).not.toHaveBeenCalled();
      });

      it('does not check the category when it is unchanged: a product keeps an inactive category', async () => {
        prisma.category.findUnique.mockResolvedValue({ id: 1, isActive: false });

        await service.update(41, { categoryId: 1, name: 'Renamed' });
        expect(prisma.category.findUnique).not.toHaveBeenCalled();
        expect(prisma.product.update).toHaveBeenCalled();
      });
    });

    describe('price warning (FR-PRD-03)', () => {
      it('warns when the new selling price is below the stored purchase price', async () => {
        const res = await service.update(41, { sellingPrice: 600 }); // stored purchase price is 700
        expect(res!.warnings).toHaveLength(1);
        expect(res!.warnings[0].code).toBe('SELLING_BELOW_PURCHASE');
      });

      it('warns when the new purchase price rises above the stored selling price', async () => {
        const res = await service.update(41, { purchasePrice: 1000 }); // stored selling price is 950
        expect(res!.warnings).toHaveLength(1);
      });

      it('gives no warning when the prices are fine', async () => {
        const res = await service.update(41, { sellingPrice: 990 });
        expect(res!.warnings).toEqual([]);
      });
    });

    describe('deactivate and reactivate (FR-PRD-05, BR-14)', () => {
      it('passes isActive=false through, also for a product that has stock and history', async () => {
        prisma.stockMovement.count.mockResolvedValue(5); // history exists
        const res = await service.update(41, { isActive: false });

        expect(prisma.product.update.mock.calls[0][0].data.isActive).toBe(false);
        expect(res!.isActive).toBe(false);
        expect(res!.stockQty).toBe(47); // stock is kept
      });

      it('passes isActive=true through to reactivate', async () => {
        prisma.product.findUnique.mockResolvedValue(row({ isActive: false }));
        const res = await service.update(41, { isActive: true });

        expect(prisma.product.update.mock.calls[0][0].data.isActive).toBe(true);
        expect(res!.isActive).toBe(true);
      });

      it('lets an inactive product be edited', async () => {
        prisma.product.findUnique.mockResolvedValue(row({ isActive: false }));
        await expect(service.update(41, { name: 'Renamed' })).resolves.toBeDefined();
      });

      it('has no way to delete a product: the service offers no remove method (BR-14)', () => {
        expect((service as unknown as Record<string, unknown>).remove).toBeUndefined();
        expect(prisma.product).not.toHaveProperty('delete');
      });
    });
  });
});
