import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

// Validation rules of POST and PATCH /products, run through the same ValidationPipe as main.ts
// (IMS-10 | FR-PRD-01, FR-PRD-03, FR-PRD-05). No database needed
describe('Product DTO validation (IMS-10)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const createMeta: ArgumentMetadata = { type: 'body', metatype: CreateProductDto };
  const updateMeta: ArgumentMetadata = { type: 'body', metatype: UpdateProductDto };

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    sku: 'KB-K120',
    name: 'Logitech K120 Keyboard',
    categoryId: 1,
    purchasePrice: 700,
    sellingPrice: 950,
    minStock: 10,
    ...overrides,
  });

  // the 400 body lists one message per broken rule; the field name must be in it (NFR-USE-02)
  const messagesOf = async (promise: Promise<unknown>): Promise<string> => {
    try {
      await promise;
    } catch (e) {
      if (e instanceof BadRequestException) {
        return JSON.stringify(e.getResponse());
      }
      throw e;
    }
    throw new Error('expected a 400 but the value was accepted');
  };

  describe('CreateProductDto (POST /products)', () => {
    it('accepts a complete valid body and builds a CreateProductDto', async () => {
      const dto = await pipe.transform(validBody(), createMeta);
      expect(dto).toBeInstanceOf(CreateProductDto);
      expect(dto).toMatchObject({ sku: 'KB-K120', purchasePrice: 700, minStock: 10 });
    });

    it('trims sku and name', async () => {
      const dto = await pipe.transform(
        validBody({ sku: '  KB-1  ', name: '  Mouse ' }),
        createMeta,
      );
      expect(dto).toMatchObject({ sku: 'KB-1', name: 'Mouse' });
    });

    it('drops fields that are not in the DTO, so stockQty cannot be set (whitelist)', async () => {
      const dto = (await pipe.transform(
        validBody({ stockQty: 99, isActive: false, createdBy: 5 }),
        createMeta,
      )) as Record<string, unknown>;
      expect(dto.stockQty).toBeUndefined();
      expect(dto.isActive).toBeUndefined();
      expect(dto.createdBy).toBeUndefined();
    });

    it('accepts the lowest values: price 0, minStock 0 (FR-PRD-03 says >= 0)', async () => {
      const dto = await pipe.transform(
        validBody({ purchasePrice: 0, sellingPrice: 0, minStock: 0 }),
        createMeta,
      );
      expect(dto).toMatchObject({ purchasePrice: 0, sellingPrice: 0, minStock: 0 });
    });

    it('accepts the highest price the database allows, 9999999.99', async () => {
      await expect(
        pipe.transform(validBody({ sellingPrice: 9999999.99 }), createMeta),
      ).resolves.toBeDefined();
    });

    it.each(['sku', 'name', 'categoryId', 'purchasePrice', 'sellingPrice', 'minStock'])(
      'rejects a missing %s, naming the field (FR-PRD-01)',
      async (field) => {
        const body: Record<string, unknown> = validBody();
        delete body[field];
        expect(await messagesOf(pipe.transform(body, createMeta))).toContain(field);
      },
    );

    it.each([
      ['sku', ''],
      ['sku', '   '], // trimmed to empty
      ['sku', 'x'.repeat(41)],
      ['sku', 123],
      ['name', ''],
      ['name', 'x'.repeat(121)],
      ['categoryId', 0],
      ['categoryId', 1.5],
      ['categoryId', '1'],
      ['purchasePrice', -1],
      ['purchasePrice', 10000000],
      ['purchasePrice', '700'],
      ['purchasePrice', null],
      ['sellingPrice', -0.01],
      ['sellingPrice', 950.555], // more than 2 decimals
      ['sellingPrice', Number.NaN],
      ['minStock', 2.5],
      ['minStock', -1],
      ['minStock', '5'],
      ['minStock', 2147483648],
    ])('rejects %s = %j, naming the field', async (field, value) => {
      const messages = await messagesOf(pipe.transform(validBody({ [field]: value }), createMeta));
      expect(messages).toContain(field);
    });
  });

  describe('UpdateProductDto (PATCH /products/:id)', () => {
    it('accepts an empty body: nothing to change', async () => {
      const dto = await pipe.transform({}, updateMeta);
      expect(dto).toBeInstanceOf(UpdateProductDto);
    });

    it('accepts any single field on its own', async () => {
      await expect(pipe.transform({ sellingPrice: 990 }, updateMeta)).resolves.toBeDefined();
      await expect(pipe.transform({ minStock: 0 }, updateMeta)).resolves.toBeDefined();
      await expect(pipe.transform({ name: ' Renamed ' }, updateMeta)).resolves.toMatchObject({
        name: 'Renamed',
      });
    });

    it('drops stockQty and other unknown fields', async () => {
      const dto = (await pipe.transform({ name: 'x', stockQty: 5 }, updateMeta)) as Record<
        string,
        unknown
      >;
      expect(dto.stockQty).toBeUndefined();
    });

    it.each([
      ['sku', ''],
      ['sku', 'x'.repeat(41)],
      ['name', '   '],
      ['categoryId', 0],
      ['purchasePrice', -1],
      ['sellingPrice', 950.555],
      ['minStock', 2.5],
    ])('applies the create rules to a field that is sent: %s = %j', async (field, value) => {
      expect(await messagesOf(pipe.transform({ [field]: value }, updateMeta))).toContain(field);
    });

    // @IsOptional would let null through to Prisma and end as a 500; null must be a 400
    it.each(['sku', 'name', 'categoryId', 'purchasePrice', 'sellingPrice', 'minStock', 'isActive'])(
      'rejects %s sent as null',
      async (field) => {
        expect(await messagesOf(pipe.transform({ [field]: null }, updateMeta))).toContain(field);
      },
    );

    it.each([true, false])('accepts isActive = %j (FR-PRD-05)', async (isActive) => {
      await expect(pipe.transform({ isActive }, updateMeta)).resolves.toMatchObject({ isActive });
    });

    it.each(['false', 'true', 'no', 0, 1])(
      'rejects isActive = %j: only true or false',
      async (v) => {
        expect(await messagesOf(pipe.transform({ isActive: v }, updateMeta))).toContain('isActive');
      },
    );
  });
});
