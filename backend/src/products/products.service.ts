import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// FR-PRD-03: shown to the user, never blocks the save
const BELOW_COST_WARNING = {
  code: 'SELLING_BELOW_PURCHASE',
  message: 'Selling price is below purchase price',
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // id and createdBy are BigInt, which JSON cannot serialise: id becomes a number, createdBy is left out.
  // Prices are sent as strings with 2 decimals ("950.00"), as in the SRS examples
  private toResponse(p: Product) {
    return {
      id: Number(p.id),
      sku: p.sku,
      name: p.name,
      categoryId: p.categoryId,
      purchasePrice: p.purchasePrice.toFixed(2),
      sellingPrice: p.sellingPrice.toFixed(2),
      minStock: p.minStock,
      stockQty: p.stockQty,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      // FR-PRD-03: selling below purchase is allowed, the client only gets a warning
      warnings: p.sellingPrice.lt(p.purchasePrice) ? [BELOW_COST_WARNING] : [],
    };
  }

  // P2002 = Prisma unique violation. Only products_sku_ci can fire it here, so it means the SKU is taken
  private rethrowIfSkuTaken(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException({
        code: 'SKU_TAKEN',
        message: 'A product with this SKU already exists (case is ignored)',
      });
    }
    throw e;
  }

  private skuLocked(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      code: 'SKU_LOCKED',
      message: 'The SKU cannot change once the product has a stock movement',
    });
  }

  // The category must exist and be active (BR-11: inactive categories cannot be used for new things)
  private async assertCategoryUsable(categoryId: number) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new UnprocessableEntityException({
        code: 'CATEGORY_NOT_FOUND',
        message: `Category ${categoryId} does not exist`,
        field: 'categoryId',
      });
    }
    if (!category.isActive) {
      throw new UnprocessableEntityException({
        code: 'CATEGORY_INACTIVE',
        message: `Category ${categoryId} is inactive`,
        field: 'categoryId',
      });
    }
  }

  // createdBy = id of the logged-in user, passed in by ProductsController
  async create(dto: CreateProductDto, createdBy: bigint) {
    await this.assertCategoryUsable(dto.categoryId);
    try {
      const product = await this.prisma.product.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          categoryId: dto.categoryId,
          purchasePrice: dto.purchasePrice.toFixed(2),
          sellingPrice: dto.sellingPrice.toFixed(2),
          minStock: dto.minStock,
          createdBy,
        },
      });
      return this.toResponse(product);
    } catch (e) {
      this.rethrowIfSkuTaken(e);
    }
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id: BigInt(id) } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return this.toResponse(product);
  }

  // PATCH covers three requirements:
  // - FR-PRD-02: the SKU is fixed once the product has any stock movement (422 SKU_LOCKED).
  //   The database trigger products_sku_locked enforces the same rule as a second layer
  // - FR-PRD-04: a price change touches only this row. Purchase order lines and invoice lines keep
  //   their own unit_cost / unit_price, so old documents never change
  // - FR-PRD-05: isActive=false deactivates. There is no DELETE (BR-14); inactive products are
  //   refused in new invoices and orders by those modules (BR-11), not here
  async update(id: number, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    if (dto.sku !== undefined && dto.sku !== existing.sku) {
      const movements = await this.prisma.stockMovement.count({
        where: { productId: existing.id },
      });
      if (movements > 0) {
        throw this.skuLocked();
      }
    }
    // Check the category when it changes, and also on reactivation (inactive -> active) with the
    // category the product will have. An edit that keeps an inactive category is still allowed
    const categoryChanges = dto.categoryId !== undefined && dto.categoryId !== existing.categoryId;
    const reactivating = dto.isActive === true && !existing.isActive;
    if (categoryChanges || reactivating) {
      await this.assertCategoryUsable(dto.categoryId ?? existing.categoryId);
    }

    try {
      const product = await this.prisma.product.update({
        where: { id: existing.id },
        data: {
          sku: dto.sku,
          name: dto.name,
          categoryId: dto.categoryId,
          purchasePrice: dto.purchasePrice?.toFixed(2),
          sellingPrice: dto.sellingPrice?.toFixed(2),
          minStock: dto.minStock,
          isActive: dto.isActive,
        },
      });
      return this.toResponse(product);
    } catch (e) {
      // the row can be deleted between findUnique and update: answer 404, not 500
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`Product ${id} not found`);
      }
      // a movement can be written between our count and the update: the trigger then refuses
      if (e instanceof Error && e.message.includes('SKU is locked')) {
        throw this.skuLocked();
      }
      this.rethrowIfSkuTaken(e);
    }
  }
}
