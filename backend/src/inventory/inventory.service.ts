import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts() {
    try {
      const products = await this.prisma.product.findMany({
        include: {
          category: {
            select: { name: true },
          },
        },
        orderBy: { id: 'asc' },
      });

      const formatted = products.map((p) => ({
        id: p.id.toString(),
        sku: p.sku,
        name: p.name,
        category: p.category.name,
        purchasePrice: p.purchasePrice.toString(),
        price: p.sellingPrice.toString(),
        stock: p.stockQty,
        minStock: p.minStock,
        isActive: p.isActive,
      }));

      return {
        success: true,
        data: formatted,
        message: 'Products fetched successfully from database',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Database error';
      return {
        success: false,
        data: [],
        error: message,
      };
    }
  }
}
