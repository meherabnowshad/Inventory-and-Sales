import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // createdBy is a BigInt, which JSON cannot serialise, so it is left out of responses
  private toResponse(c: Category) {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  // P2002 = Prisma unique violation. Only categories_name_ci can fire it here, so it means the name is taken
  private rethrowIfNameTaken(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException({
        code: 'CATEGORY_NAME_TAKEN',
        message: 'A category with this name already exists (case is ignored)',
      });
    }
    throw e;
  }

  // P2025 = Prisma "record not found": the row was deleted after we looked it up (IMS-08.3)
  private isRecordMissing(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';
  }

  // 409 CATEGORY_IN_USE (FR-CAT-03); productCount lets the UI say "used by N products" (IMS-09.3)
  private inUse(productCount: number): ConflictException {
    return new ConflictException({
      code: 'CATEGORY_IN_USE',
      message: `This category is used by ${productCount} product(s) and cannot be deleted. Deactivate it instead.`,
      productCount,
    });
  }

  // createdBy = id of the logged-in user, passed in by CategoriesController (was a stub before IMS-08.3)
  async create(dto: CreateCategoryDto, createdBy: bigint) {
    try {
      const category = await this.prisma.category.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          createdBy,
        },
      });
      return this.toResponse(category);
    } catch (e) {
      this.rethrowIfNameTaken(e);
    }
  }

  // FR-CAT-04: every category with its product count (active and inactive products), optional status filter
  async findAll(query: ListCategoriesQueryDto) {
    const where: Prisma.CategoryWhereInput =
      query.status === 'active'
        ? { isActive: true }
        : query.status === 'inactive'
          ? { isActive: false }
          : {};
    const categories = await this.prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return categories.map((c) => ({ ...this.toResponse(c), productCount: c._count.products }));
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return this.toResponse(category);
  }

  // PATCH is always allowed, also isActive=false while products use the category (IMS-08.3, BR-11)
  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id); // 404 if it does not exist
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          isActive: dto.isActive,
        },
      });
      return this.toResponse(category);
    } catch (e) {
      // the row can be deleted between findOne and update: answer 404, not 500
      if (this.isRecordMissing(e)) {
        throw new NotFoundException(`Category ${id} not found`);
      }
      this.rethrowIfNameTaken(e);
    }
  }

  // IMS-08.3 (FR-CAT-03): delete only when no product, active or inactive, uses the category
  async remove(id: number): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    if (category._count.products > 0) {
      throw this.inUse(category._count.products);
    }
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (e) {
      // two requests racing: the database (ON DELETE RESTRICT) can still refuse. Same 409, never a 500
      if (this.isRecordMissing(e)) {
        throw new NotFoundException(`Category ${id} not found`);
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        const productCount = await this.prisma.product.count({ where: { categoryId: id } });
        throw this.inUse(productCount);
      }
      throw e;
    }
  }
}
