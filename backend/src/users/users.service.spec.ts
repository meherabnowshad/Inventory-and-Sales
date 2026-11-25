import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const adminId = BigInt(1);
  const userId = BigInt(2);
  let service: UsersService;

  const baseUser = {
    id: userId,
    name: 'Test User',
    username: 'test.user',
    email: 'test@smartmart.local',
    isActive: true,
    mustResetPw: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    role: { name: 'Sales Staff' },
  };

  const tx = {
    role: { findUnique: vi.fn() },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  };

  const prisma = {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { findMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => unknown)(tx)
        : Promise.all(arg as unknown[]),
    );
    tx.role.findUnique.mockResolvedValue({ id: 2, name: 'Sales Staff' });
    tx.user.create.mockResolvedValue(baseUser);
    tx.user.update.mockResolvedValue(baseUser);
    tx.auditLog.create.mockResolvedValue({});
    tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    service = new UsersService(prisma as never);
  });

  it('creates a user with Argon2 hash and never exposes password data', async () => {
    const result = await service.create(
      {
        name: ' Test User ',
        username: 'test.user',
        email: 'test@smartmart.local',
        role: 'Sales Staff',
        temporaryPassword: 'Temporary1!',
      } as never,
      adminId,
    );

    expect(tx.user.create).toHaveBeenCalled();
    const createArgs = tx.user.create.mock.calls[0][0];
    expect(createArgs.data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(createArgs.data.mustResetPw).toBe(true);
    expect(createArgs.data.createdBy).toBe(adminId);
    expect(result).not.toHaveProperty('passwordHash');
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entity: 'USER',
        entityId: userId,
        action: 'USER_CREATED',
        beforeJson: Prisma.DbNull,
        afterJson: {
          id: Number(userId),
          name: baseUser.name,
          username: baseUser.username,
          email: baseUser.email,
          role: baseUser.role.name,
          isActive: baseUser.isActive,
        },
        userId: adminId,
      },
    });
    const savedJson = JSON.stringify(tx.auditLog.create.mock.calls[0][0].data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    expect(savedJson).not.toContain('Temporary1!');
    expect(savedJson).not.toContain('passwordHash');
    expect(savedJson).not.toContain('tokenHash');
  });

  it.each([
    ['users_username_ci', 'USERNAME_TAKEN'],
    ['users_email_ci', 'EMAIL_TAKEN'],
  ])('maps P2002 for %s to %s', async (target, code) => {
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '5',
        meta: { target: [target] },
      }),
    );

    await expect(
      service.create(
        {
          name: 'Test',
          username: 'test',
          email: 'test@smartmart.local',
          role: 'Sales Staff',
          temporaryPassword: 'Temporary1!',
        } as never,
        adminId,
      ),
    ).rejects.toMatchObject({ response: { code } });
  });

  it('changes role and protects own account', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: userId,
      name: baseUser.name,
      email: baseUser.email,
      isActive: true,
      role: { name: 'Sales Staff' },
    });
    tx.user.count.mockResolvedValue(2);

    await service.update(Number(userId), { role: 'Administrator' } as never, adminId);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ roleId: 2 }) }),
    );

    tx.user.findUnique.mockResolvedValue({
      id: adminId,
      name: 'Admin',
      email: 'admin@smartmart.local',
      isActive: true,
      role: { name: 'Administrator' },
    });
    await expect(
      service.update(Number(adminId), { role: 'Sales Staff' } as never, adminId),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.update(Number(adminId), { isActive: false } as never, adminId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revokes refresh tokens when deactivated', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: userId,
      name: baseUser.name,
      email: baseUser.email,
      isActive: true,
      role: { name: 'Sales Staff' },
    });

    await service.update(Number(userId), { isActive: false } as never, adminId);

    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, revokedAt: null },
      }),
    );
  });

  it('writes one audit row per changed role, status, and detail action', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Before',
      email: 'before@smartmart.local',
      isActive: true,
      role: { name: 'Sales Staff' },
    });
    tx.role.findUnique.mockResolvedValue({ id: 3, name: 'Store Staff' });
    tx.user.update.mockResolvedValue({
      ...baseUser,
      name: 'After',
      email: 'after@smartmart.local',
      isActive: false,
      role: { name: 'Store Staff' },
    });

    await service.update(
      Number(userId),
      {
        role: 'Store Staff',
        isActive: false,
        name: 'After',
        email: 'after@smartmart.local',
      } as never,
      adminId,
    );

    expect(tx.auditLog.create).toHaveBeenCalledTimes(3);
    expect(tx.auditLog.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          entity: 'USER',
          entityId: userId,
          action: 'ROLE_CHANGED',
          beforeJson: { role: 'Sales Staff' },
          afterJson: { role: 'Store Staff' },
          userId: adminId,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'USER_DEACTIVATED',
          beforeJson: { isActive: true },
          afterJson: { isActive: false },
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'USER_UPDATED',
          beforeJson: { name: 'Before', email: 'before@smartmart.local' },
          afterJson: { name: 'After', email: 'after@smartmart.local' },
        }),
      }),
    );
  });

  it('audits reactivation and writes no row when nothing changes', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: userId,
      name: baseUser.name,
      email: baseUser.email,
      isActive: false,
      role: { name: 'Sales Staff' },
    });
    tx.user.update.mockResolvedValue({ ...baseUser, isActive: true });

    await service.update(Number(userId), { isActive: true } as never, adminId);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'USER_REACTIVATED',
          beforeJson: { isActive: false },
          afterJson: { isActive: true },
        }),
      }),
    );

    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => unknown)(tx)
        : Promise.all(arg as unknown[]),
    );
    tx.user.findUnique.mockResolvedValue({
      id: userId,
      name: baseUser.name,
      email: baseUser.email,
      isActive: true,
      role: { name: 'Sales Staff' },
    });
    tx.user.update.mockResolvedValue(baseUser);

    await service.update(Number(userId), { name: baseUser.name } as never, adminId);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects the transaction when an audit insert fails', async () => {
    let committed = false;
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      const result = await (arg as (client: typeof tx) => unknown)(tx);
      committed = true;
      return result;
    });
    tx.user.findUnique.mockResolvedValue({
      id: userId,
      name: baseUser.name,
      email: baseUser.email,
      isActive: true,
      role: { name: 'Sales Staff' },
    });
    tx.auditLog.create.mockRejectedValue(new Error('audit insert failed'));

    await expect(
      service.update(Number(userId), { isActive: false } as never, adminId),
    ).rejects.toThrow('audit insert failed');
    expect(tx.user.update).toHaveBeenCalled();
    expect(committed).toBe(false);
  });

  it('blocks the last active administrator', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: userId,
      name: baseUser.name,
      email: baseUser.email,
      isActive: true,
      role: { name: 'Administrator' },
    });
    tx.user.count.mockResolvedValue(1);

    await expect(
      service.update(Number(userId), { isActive: false } as never, adminId),
    ).rejects.toMatchObject({ response: { code: 'LAST_ADMIN' } });
  });
});
