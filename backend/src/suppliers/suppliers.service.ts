import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isEmail } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { mapSupplierToResponse } from './supplier.mapper';

const SUPPLIER_SELECT = {
  id: true,
  name: true,
  contactPerson: true,
  phone: true,
  email: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as Prisma.SupplierSelect;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  private validateName(name: unknown): string {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestException('Supplier name is required');
    }
    const trimmed = name.trim();
    if (trimmed.length > 120) {
      throw new BadRequestException('Supplier name must be 120 characters or fewer');
    }
    return trimmed;
  }

  private validatePhone(phone: unknown): string {
    const trimmed = typeof phone === 'string' ? phone.trim() : '';
    if (!/^01[0-9]{9}$/.test(trimmed)) {
      throw new BadRequestException('Phone must be 11 digits and start with 01');
    }
    return trimmed;
  }

  private validateEmail(email: unknown): string | null {
    if (email === undefined || email === null) {
      return null;
    }
    if (typeof email !== 'string') {
      throw new BadRequestException('Enter a valid email address');
    }
    const trimmed = email.trim();
    if (trimmed === '') {
      return null;
    }
    if (trimmed.length > 254 || !isEmail(trimmed)) {
      throw new BadRequestException('Enter a valid email address');
    }
    return trimmed;
  }

  private async findDuplicate(name: string) {
    return this.prisma.supplier.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true, name: true, isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  private duplicateName(existing: { id: bigint; name: string; isActive: boolean }) {
    return new ConflictException({
      code: 'SUPPLIER_NAME_EXISTS',
      message:
        'A supplier with this name already exists. Send confirmDuplicate=true to save anyway.',
      existing: {
        id: Number(existing.id),
        name: existing.name,
        isActive: existing.isActive,
      },
    });
  }

  private rethrowConstraint(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2004') {
      throw new BadRequestException('Supplier data violates a database constraint');
    }
    throw e;
  }

  async create(dto: CreateSupplierDto, createdBy: bigint) {
    const name = this.validateName(dto.name);
    const phone = this.validatePhone(dto.phone);
    const email = this.validateEmail(dto.email);

    if (dto.confirmDuplicate !== true) {
      const existing = await this.findDuplicate(name);
      if (existing) {
        throw this.duplicateName(existing);
      }
    }

    try {
      const supplier = await this.prisma.supplier.create({
        data: {
          name,
          contactPerson: dto.contactPerson ?? null,
          phone,
          email,
          address: dto.address ?? null,
          isActive: true,
          createdBy,
        },
        select: SUPPLIER_SELECT,
      });
      return mapSupplierToResponse(supplier);
    } catch (e) {
      this.rethrowConstraint(e);
    }
  }

  async findAll(query: ListSuppliersQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const where: Prisma.SupplierWhereInput =
      query.status === 'active'
        ? { isActive: true }
        : query.status === 'inactive'
          ? { isActive: false }
          : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        select: SUPPLIER_SELECT,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      items: items.map(mapSupplierToResponse),
      page,
      size,
      total,
    };
  }

  async findOne(id: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: BigInt(id) },
      select: SUPPLIER_SELECT,
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }
    return mapSupplierToResponse(supplier);
  }

  async update(id: number, dto: UpdateSupplierDto) {
    const { confirmDuplicate, ...fields } = dto;
    if (Object.keys(fields).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    const name = dto.name === undefined ? undefined : this.validateName(dto.name);
    const phone = dto.phone === undefined ? undefined : this.validatePhone(dto.phone);
    const email = dto.email === undefined ? undefined : this.validateEmail(dto.email);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.findUnique({
          where: { id: BigInt(id) },
          select: { id: true, name: true },
        });
        if (!supplier) {
          throw new NotFoundException(`Supplier ${id} not found`);
        }

        if (name !== undefined && name !== supplier.name && confirmDuplicate !== true) {
          const existing = await tx.supplier.findFirst({
            where: {
              name: { equals: name, mode: 'insensitive' },
              id: { not: supplier.id },
            },
            select: { id: true, name: true, isActive: true },
            orderBy: { id: 'asc' },
          });
          if (existing) {
            throw this.duplicateName(existing);
          }
        }

        const updated = await tx.supplier.update({
          where: { id: BigInt(id) },
          data: {
            name,
            contactPerson: dto.contactPerson,
            phone,
            email,
            address: dto.address,
            isActive: dto.isActive,
          },
          select: SUPPLIER_SELECT,
        });
        return mapSupplierToResponse(updated);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Supplier ${id} not found`);
      }
      this.rethrowConstraint(e);
    }
  }
}
