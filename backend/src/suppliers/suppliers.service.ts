import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  private rethrowConstraint(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2004') {
      throw new BadRequestException('Supplier data violates a database constraint');
    }
    throw e;
  }

  async create(dto: CreateSupplierDto, createdBy: bigint) {
    try {
      const supplier = await this.prisma.supplier.create({
        data: {
          name: dto.name,
          contactPerson: dto.contactPerson ?? null,
          phone: dto.phone,
          email: dto.email ?? null,
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
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.findUnique({
          where: { id: BigInt(id) },
          select: { id: true },
        });
        if (!supplier) {
          throw new NotFoundException(`Supplier ${id} not found`);
        }

        const updated = await tx.supplier.update({
          where: { id: BigInt(id) },
          data: {
            name: dto.name,
            contactPerson: dto.contactPerson,
            phone: dto.phone,
            email: dto.email,
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
