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
    refreshToken: { updateMany: vi.fn() },
  };

  const prisma = {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
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

  it('blocks the last active administrator', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: userId,
      isActive: true,
      role: { name: 'Administrator' },
    });
    tx.user.count.mockResolvedValue(1);

    await expect(
      service.update(Number(userId), { isActive: false } as never, adminId),
    ).rejects.toMatchObject({ response: { code: 'LAST_ADMIN' } });
  });
});
