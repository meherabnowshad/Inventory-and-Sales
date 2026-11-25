import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Algorithm, hash } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { mapUserToResponse } from './user.mapper';

const USER_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  isActive: true,
  mustResetPw: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
} as Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private rethrowUnique(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const targets = e.meta?.target as string[] | string | undefined;
      const target = Array.isArray(targets) ? targets.join(',') : (targets ?? '');
      if (target.includes('users_username_ci') || target.includes('username')) {
        throw new ConflictException({
          code: 'USERNAME_TAKEN',
          message: 'A user with this username already exists (case is ignored)',
        });
      }
      if (target.includes('users_email_ci') || target.includes('email')) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'A user with this email already exists (case is ignored)',
        });
      }
    }
    throw e;
  }

  private async getRole(tx: Prisma.TransactionClient, roleName: string) {
    const role = await tx.role.findUnique({
      where: { name: roleName },
      select: { id: true, name: true },
    });
    if (!role) {
      throw new BadRequestException(`Unknown role: ${roleName}`);
    }
    return role;
  }

  async findAll(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const where: Prisma.UserWhereInput = {
      ...(query.status === 'active'
        ? { isActive: true }
        : query.status === 'inactive'
          ? { isActive: false }
          : {}),
      ...(query.role ? { role: { name: query.role } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { username: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(mapUserToResponse),
      page,
      size,
      total,
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return mapUserToResponse(user);
  }

  async create(dto: CreateUserDto, createdBy: bigint) {
    const passwordHash = await hash(dto.temporaryPassword, {
      algorithm: Algorithm.Argon2id,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await this.getRole(tx, dto.role);
        const user = await tx.user.create({
          data: {
            name: dto.name,
            username: dto.username,
            email: dto.email,
            passwordHash,
            roleId: role.id,
            ...({ mustResetPw: true } as object),
            isActive: true,
            createdBy,
          },
          select: USER_SELECT,
        });
        return mapUserToResponse(user);
      });
    } catch (e) {
      this.rethrowUnique(e);
    }
  }

  async update(id: number, dto: UpdateUserDto, currentAdminId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: BigInt(id) },
        select: {
          id: true,
          isActive: true,
          role: { select: { name: true } },
        },
      });
      if (!existing) {
        throw new NotFoundException(`User ${id} not found`);
      }

      if (existing.id === currentAdminId) {
        if (dto.isActive === false || (dto.role !== undefined && dto.role !== existing.role.name)) {
          throw new ConflictException({
            code: 'CANNOT_MODIFY_OWN_ACCOUNT',
            message: 'You cannot deactivate or change the role of your own administrator account',
          });
        }
      }

      const roleName = dto.role ?? existing.role.name;
      let roleId: number | undefined;
      if (dto.role !== undefined) {
        roleId = (await this.getRole(tx, dto.role)).id;
      }

      if (dto.isActive === false && existing.isActive && roleName === 'Administrator') {
        const activeAdminCount = await tx.user.count({
          where: {
            isActive: true,
            role: { name: 'Administrator' },
          },
        });
        if (activeAdminCount <= 1) {
          throw new ConflictException({
            code: 'LAST_ADMIN',
            message: 'The last active Administrator cannot be deactivated',
          });
        }
      }

      if (
        dto.role !== undefined &&
        dto.role !== 'Administrator' &&
        existing.role.name === 'Administrator' &&
        existing.isActive
      ) {
        const activeAdminCount = await tx.user.count({
          where: {
            isActive: true,
            role: { name: 'Administrator' },
          },
        });
        if (activeAdminCount <= 1) {
          throw new ConflictException({
            code: 'LAST_ADMIN',
            message: 'The last active Administrator cannot be demoted',
          });
        }
      }

      try {
        const updated = await tx.user.update({
          where: { id: BigInt(id) },
          data: {
            name: dto.name,
            email: dto.email,
            ...(roleId !== undefined ? { roleId } : {}),
            isActive: dto.isActive,
          },
          select: USER_SELECT,
        });

        if (dto.isActive === false && existing.isActive) {
          await tx.refreshToken.updateMany({
            where: { userId: BigInt(id), revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        return mapUserToResponse(updated);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new NotFoundException(`User ${id} not found`);
        }
        this.rethrowUnique(e);
      }
    });
  }
}
