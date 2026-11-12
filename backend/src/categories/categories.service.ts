import { Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
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

  async create(dto: CreateCategoryDto) {
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        createdBy: STUB_USER_ID,
      },
    });
    return this.toResponse(category);
  }

  async findAll() {
    const categories = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return categories.map((c) => this.toResponse(c));
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
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
      },
    });
    return this.toResponse(category);
  }
}
