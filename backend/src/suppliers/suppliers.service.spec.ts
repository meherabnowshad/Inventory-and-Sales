import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SuppliersService } from './suppliers.service';

describe('SuppliersService', () => {
  const createdBy = BigInt(7);
  const supplierId = BigInt(12);
  const supplier = {
    id: supplierId,
    name: 'Acme Supply',
    contactPerson: 'Alex',
    phone: '01712345678',
    email: 'alex@example.local',
    address: 'Dhaka',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const tx = {
    supplier: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  const prisma = {
    $transaction: vi.fn(),
    supplier: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
  let service: SuppliersService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => unknown)(tx)
        : Promise.all(arg as unknown[]),
    );
    prisma.supplier.create.mockResolvedValue(supplier);
    prisma.supplier.findUnique.mockResolvedValue(supplier);
    prisma.supplier.findMany.mockResolvedValue([supplier]);
    prisma.supplier.count.mockResolvedValue(1);
    tx.supplier.findUnique.mockResolvedValue({ id: supplierId });
    tx.supplier.update.mockResolvedValue(supplier);
    service = new SuppliersService(prisma as never);
  });

  it('creates a supplier with the creator id and nullable optional fields', async () => {
    const result = await service.create(
      { name: 'Acme Supply', phone: '01712345678' } as never,
      createdBy,
    );

    expect(prisma.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Acme Supply',
          phone: '01712345678',
          contactPerson: null,
          email: null,
          address: null,
          isActive: true,
          createdBy,
        }),
      }),
    );
    expect(result.id).toBe(Number(supplierId));
  });

  it('returns a validation error instead of a server error for database check failures', async () => {
    prisma.supplier.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('constraint failed', {
        code: 'P2004',
        clientVersion: '5',
      }),
    );

    await expect(
      service.create({ name: 'Acme Supply', phone: 'invalid' } as never, createdBy),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists with paging, name/id sort, and active or inactive status filters', async () => {
    const active = await service.findAll({ status: 'active', page: 2, size: 5 } as never);
    expect(active).toMatchObject({ page: 2, size: 5, total: 1 });
    expect(prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: 5,
        take: 5,
      }),
    );

    await service.findAll({ status: 'inactive' } as never);
    expect(prisma.supplier.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { isActive: false }, skip: 0, take: 20 }),
    );

    await service.findAll({} as never);
    expect(prisma.supplier.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 20 }),
    );
  });

  it('returns 404 when a supplier does not exist', async () => {
    prisma.supplier.findUnique.mockResolvedValue(null);
    await expect(service.findOne(Number(supplierId))).rejects.toThrow(
      new NotFoundException(`Supplier ${supplierId} not found`),
    );
  });

  it('updates supplier fields transactionally', async () => {
    const result = await service.update(Number(supplierId), {
      name: 'Updated Supply',
    } as never);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: supplierId },
        data: expect.objectContaining({ name: 'Updated Supply' }),
      }),
    );
    expect(result.id).toBe(Number(supplierId));
  });

  it.each([
    ['deactivate', false],
    ['reactivate', true],
  ] as const)('%s supplier', async (_action, next) => {
    tx.supplier.update.mockResolvedValue({ ...supplier, isActive: next });
    const result = await service.update(Number(supplierId), { isActive: next } as never);

    expect(result.isActive).toBe(next);
    expect(tx.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: next }) }),
    );
  });

  it('rejects an update with no fields', async () => {
    await expect(service.update(Number(supplierId), {} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
