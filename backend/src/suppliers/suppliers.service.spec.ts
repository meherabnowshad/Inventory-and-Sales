import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  const prisma = {
    $transaction: vi.fn(),
    supplier: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
    prisma.supplier.findFirst.mockResolvedValue(null);
    prisma.supplier.findMany.mockResolvedValue([supplier]);
    prisma.supplier.count.mockResolvedValue(1);
    tx.supplier.findUnique.mockResolvedValue({ id: supplierId, name: supplier.name });
    tx.supplier.findFirst.mockResolvedValue(null);
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
      service.create({ name: 'Acme Supply', phone: '01712345678' } as never, createdBy),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    '0171234567',
    '017123456789',
    '01712abc678',
    '+8801712345678',
    '02712345678',
    '01712 45678',
  ])('rejects invalid phone %s before writing', async (phone) => {
    await expect(
      service.create({ name: 'Acme Supply', phone } as never, createdBy),
    ).rejects.toThrow(new BadRequestException('Phone must be 11 digits and start with 01'));
    expect(prisma.supplier.create).not.toHaveBeenCalled();
  });

  it('rejects invalid update phones before writing', async () => {
    await expect(
      service.update(Number(supplierId), { phone: '+8801712345678' } as never),
    ).rejects.toThrow(new BadRequestException('Phone must be 11 digits and start with 01'));
    expect(tx.supplier.update).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed', 'not-an-email'],
    ['too long', `${'a'.repeat(243)}@example.com`],
  ])('rejects a %s email', async (_label, email) => {
    await expect(
      service.create({ name: 'Acme Supply', phone: '01712345678', email } as never, createdBy),
    ).rejects.toThrow(new BadRequestException('Enter a valid email address'));
    expect(prisma.supplier.create).not.toHaveBeenCalled();
  });

  it('converts an empty email to null', async () => {
    await service.create(
      { name: 'Acme Supply', phone: '01712345678', email: '  ' } as never,
      createdBy,
    );
    expect(prisma.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: null }) }),
    );
  });

  it.each([
    ['', 'Supplier name is required'],
    ['   ', 'Supplier name is required'],
    ['a'.repeat(121), 'Supplier name must be 120 characters or fewer'],
  ])('rejects invalid supplier name', async (name, message) => {
    await expect(
      service.create({ name, phone: '01712345678' } as never, createdBy),
    ).rejects.toThrow(new BadRequestException(message));
    expect(prisma.supplier.create).not.toHaveBeenCalled();
  });

  it('warns on a duplicate supplier name and does not create it', async () => {
    const existing = { id: BigInt(18), name: 'Existing Supplier', isActive: true };
    prisma.supplier.findFirst.mockResolvedValue(existing);

    await expect(
      service.create({ name: '  eXisting Supplier  ', phone: '01712345678' } as never, createdBy),
    ).rejects.toThrow(
      new ConflictException({
        code: 'SUPPLIER_NAME_EXISTS',
        message:
          'A supplier with this name already exists. Send confirmDuplicate=true to save anyway.',
        existing: { id: 18, name: 'Existing Supplier', isActive: true },
      }),
    );
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { equals: 'eXisting Supplier', mode: 'insensitive' } },
      }),
    );
    expect(prisma.supplier.create).not.toHaveBeenCalled();
  });

  it('allows creating a duplicate when explicitly confirmed', async () => {
    prisma.supplier.findFirst.mockResolvedValue({
      id: BigInt(18),
      name: 'Existing Supplier',
      isActive: true,
    });

    await service.create(
      {
        name: 'Existing Supplier',
        phone: '01712345678',
        confirmDuplicate: true,
      } as never,
      createdBy,
    );

    expect(prisma.supplier.findFirst).not.toHaveBeenCalled();
    expect(prisma.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ confirmDuplicate: true }),
      }),
    );
  });

  it('checks a renamed supplier for duplicates and excludes itself', async () => {
    const existing = { id: BigInt(18), name: 'Another Supplier', isActive: true };
    tx.supplier.findFirst.mockResolvedValue(existing);

    await expect(
      service.update(Number(supplierId), { name: 'Another Supplier' } as never),
    ).rejects.toThrow(
      new ConflictException({
        code: 'SUPPLIER_NAME_EXISTS',
        message:
          'A supplier with this name already exists. Send confirmDuplicate=true to save anyway.',
        existing: { id: 18, name: 'Another Supplier', isActive: true },
      }),
    );
    expect(tx.supplier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          name: { equals: 'Another Supplier', mode: 'insensitive' },
          id: { not: supplierId },
        },
        orderBy: { id: 'asc' },
      }),
    );
    expect(tx.supplier.update).not.toHaveBeenCalled();
  });

  it('reports the lowest id when multiple suppliers match an updated name', async () => {
    const matches = [
      { id: BigInt(18), name: 'Another Supplier', isActive: true },
      { id: BigInt(5), name: 'Another Supplier', isActive: false },
    ] as const;
    tx.supplier.findFirst.mockResolvedValue(matches[1]);

    await expect(
      service.update(Number(supplierId), { name: 'Another Supplier' } as never),
    ).rejects.toThrow(
      new ConflictException({
        code: 'SUPPLIER_NAME_EXISTS',
        message:
          'A supplier with this name already exists. Send confirmDuplicate=true to save anyway.',
        existing: { id: 5, name: 'Another Supplier', isActive: false },
      }),
    );
    expect(tx.supplier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: 'asc' } }),
    );
  });

  it('does not check for a duplicate when keeping the current name', async () => {
    await service.update(Number(supplierId), { name: supplier.name } as never);

    expect(tx.supplier.findFirst).not.toHaveBeenCalled();
    expect(tx.supplier.update).toHaveBeenCalled();
  });

  it('allows a duplicate name update when explicitly confirmed', async () => {
    tx.supplier.findFirst.mockResolvedValue({
      id: BigInt(18),
      name: 'Another Supplier',
      isActive: true,
    });

    await service.update(Number(supplierId), {
      name: 'Another Supplier',
      confirmDuplicate: true,
    } as never);

    expect(tx.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ confirmDuplicate: true }),
      }),
    );
  });

  it('warns when the matching supplier is inactive', async () => {
    const inactive = { id: BigInt(18), name: 'Inactive Supplier', isActive: false };
    prisma.supplier.findFirst.mockResolvedValue(inactive);

    await expect(
      service.create({ name: 'Inactive Supplier', phone: '01712345678' } as never, createdBy),
    ).rejects.toThrow(
      new ConflictException({
        code: 'SUPPLIER_NAME_EXISTS',
        message:
          'A supplier with this name already exists. Send confirmDuplicate=true to save anyway.',
        existing: { id: 18, name: 'Inactive Supplier', isActive: false },
      }),
    );
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
