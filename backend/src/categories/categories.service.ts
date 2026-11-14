import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// TODO(IMS-05): replace with the logged-in user's id from the auth guard
const STUB_USER_ID = 1n;

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

  async create(dto: CreateCategoryDto) {
    try {
      const category = await this.prisma.category.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          createdBy: STUB_USER_ID,
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
      this.rethrowIfNameTaken(e);
    }
  }
}
